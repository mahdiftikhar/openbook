import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";

import { WORKSPACE_DIRS, WORKSPACE_FILES } from "../../workspaceLayout";
import {
    chunkEmbeddings,
    chunks as chunksTable,
    documents,
    indexMetadata,
} from "../../main/services/index/indexSchema";
import type {
    IndexingErrorCode,
    IndexingIssue,
    IndexReconciliationResult,
} from "../../shared/types";
import { createContentHash } from "./contentHash";
import {
    chunkTextSegments,
    type IndexedChunkInput,
    type TextSegment,
} from "./documentChunker";
import { EmbeddingProviderError, embedTexts } from "./embeddingProvider";
import {
    withIndexDatabase,
    type IndexDatabase,
} from "../../main/services/index/indexDatabase";
import { extractPdfText } from "../../main/services/pdfTextService";

type DocumentKind = "pdf" | "note";
type DocumentStatus =
    "pending" | "chunking" | "embedding" | "ready" | "error" | "stale";

interface DocumentInput {
    workspacePath: string;
    kind: DocumentKind;
    filePath: string;
    fileName: string;
    sourceFileName: string | null;
    segments: TextSegment[];
    metadata: Record<string, unknown>;
    requireText: boolean;
}

interface StoredDocument {
    id: number;
}

interface StoredDocumentRecord extends StoredDocument {
    kind: DocumentKind;
    filePath: string;
    contentHash: string | null;
    metadataJson: string;
    status: DocumentStatus;
}

interface ExpectedDocument {
    input: DocumentInput;
    contentHash: string;
    chunks: IndexedChunkInput[];
    sourceHash: string | null;
}

interface IndexDocumentResult {
    success: boolean;
    issue?: IndexingIssue;
}

interface SourceEntryRecord {
    fileName: string;
    totalPages?: number;
    status?: string;
}

export interface SourceTextPage {
    page: number;
    text: string;
}

const VECTOR_TABLE_NAME = "chunk_embedding_vectors";
const activeReconciliations = new Map<
    string,
    Promise<IndexReconciliationResult>
>();

function nowIso(): string {
    return new Date().toISOString();
}

function numberToSqliteInteger(value: number | null): number | null {
    return value === null ? null : value;
}

function embeddingToBlob(embedding: number[]): Buffer {
    const array = new Float32Array(embedding);
    return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function getMetadata(db: IndexDatabase, key: string): string | null {
    const row = db.orm
        .select({ value: indexMetadata.value })
        .from(indexMetadata)
        .where(eq(indexMetadata.key, key))
        .get();
    return row?.value ?? null;
}

function setMetadata(db: IndexDatabase, key: string, value: string): void {
    db.orm
        .insert(indexMetadata)
        .values({ key, value, updatedAt: nowIso() })
        .onConflictDoUpdate({
            target: indexMetadata.key,
            set: { value, updatedAt: nowIso() },
        })
        .run();
}

function ensureVectorTable(db: IndexDatabase, dimensions: number): void {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
        throw new Error("Embedding dimensions must be a positive integer.");
    }

    const storedDimensions = getMetadata(db, "embedding_dimensions");
    if (storedDimensions && Number(storedDimensions) !== dimensions) {
        throw new Error(
            `Embedding dimension mismatch. Existing index uses ${storedDimensions}, but provider returned ${dimensions}. Rebuild the index to change embedding dimensions.`,
        );
    }

    setMetadata(db, "embedding_dimensions", String(dimensions));
    db.sqlite.exec(
        `CREATE VIRTUAL TABLE IF NOT EXISTS ${VECTOR_TABLE_NAME} USING vec0(embedding float[${dimensions}])`,
    );
}

function vectorTableExists(db: IndexDatabase): boolean {
    const row = db.sqlite
        .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(VECTOR_TABLE_NAME) as { name: string } | undefined;
    return row !== undefined;
}

function upsertDocument(
    db: IndexDatabase,
    input: DocumentInput,
    status: DocumentStatus,
    contentHash: string | null,
    error: string | null,
): StoredDocument {
    const timestamp = nowIso();
    const values = {
        kind: input.kind,
        filePath: input.filePath,
        fileName: input.fileName,
        sourceFileName: input.sourceFileName,
        status,
        contentHash,
        error,
        metadataJson: JSON.stringify(input.metadata),
        createdAt: timestamp,
        updatedAt: timestamp,
        indexedAt: status === "ready" ? timestamp : null,
    };

    const existing = db.orm
        .select({ id: documents.id })
        .from(documents)
        .where(
            and(
                eq(documents.kind, input.kind),
                eq(documents.filePath, input.filePath),
            ),
        )
        .get();

    if (existing) {
        db.orm
            .update(documents)
            .set({
                fileName: values.fileName,
                sourceFileName: values.sourceFileName,
                status: values.status,
                contentHash: values.contentHash,
                error: values.error,
                metadataJson: values.metadataJson,
                updatedAt: values.updatedAt,
                indexedAt: values.indexedAt,
            })
            .where(eq(documents.id, existing.id))
            .run();
        return existing;
    }

    const inserted = db.orm
        .insert(documents)
        .values(values)
        .returning({ id: documents.id })
        .get();
    if (!inserted) throw new Error("Failed to create indexed document.");
    return inserted;
}

function updateDocumentStatus(
    db: IndexDatabase,
    documentId: number,
    status: DocumentStatus,
    error: string | null = null,
): void {
    const timestamp = nowIso();
    db.orm
        .update(documents)
        .set(
            status === "ready"
                ? { status, error, updatedAt: timestamp, indexedAt: timestamp }
                : { status, error, updatedAt: timestamp },
        )
        .where(eq(documents.id, documentId))
        .run();
}

function deleteExistingDocumentRows(
    db: IndexDatabase,
    documentId: number,
): void {
    const vectorRows = db.orm
        .select({ vectorRowid: chunkEmbeddings.vectorRowid })
        .from(chunkEmbeddings)
        .innerJoin(chunksTable, eq(chunksTable.id, chunkEmbeddings.chunkId))
        .where(eq(chunksTable.documentId, documentId))
        .all();

    if (vectorTableExists(db)) {
        const deleteVector = db.sqlite.prepare(
            `DELETE FROM ${VECTOR_TABLE_NAME} WHERE rowid = ?`,
        );
        for (const row of vectorRows) deleteVector.run(row.vectorRowid);
    }

    db.sqlite
        .prepare("DELETE FROM chunks_fts WHERE document_id = ?")
        .run(documentId);
    db.orm
        .delete(chunksTable)
        .where(eq(chunksTable.documentId, documentId))
        .run();
}

function insertIndexedRows(
    db: IndexDatabase,
    documentId: number,
    chunks: IndexedChunkInput[],
    embeddings: number[][],
    embeddingModel: string,
    embeddingDimensions: number,
): void {
    const insertFts = db.sqlite.prepare(
        "INSERT INTO chunks_fts (text, chunk_id, document_id) VALUES (?, ?, ?)",
    );
    const insertVector = db.sqlite.prepare(
        `INSERT INTO ${VECTOR_TABLE_NAME} (embedding) VALUES (?)`,
    );

    for (const chunk of chunks) {
        const embedding = embeddings[chunk.chunkIndex];
        if (!embedding) throw new Error("Missing embedding for chunk.");

        const timestamp = nowIso();
        const insertedChunk = db.orm
            .insert(chunksTable)
            .values({
                documentId,
                chunkIndex: chunk.chunkIndex,
                text: chunk.text,
                page: numberToSqliteInteger(chunk.page),
                startOffset: numberToSqliteInteger(chunk.startOffset),
                endOffset: numberToSqliteInteger(chunk.endOffset),
                contentHash: chunk.contentHash,
                tokenEstimate: chunk.tokenEstimate,
                createdAt: timestamp,
            })
            .returning({ id: chunksTable.id })
            .get();
        const chunkId = insertedChunk.id;
        const embeddingBlob = embeddingToBlob(embedding);
        const vectorResult = insertVector.run(embeddingBlob);
        const vectorRowId = Number(vectorResult.lastInsertRowid);

        insertFts.run(chunk.text, chunkId, documentId);
        db.orm
            .insert(chunkEmbeddings)
            .values({
                chunkId,
                vectorRowid: vectorRowId,
                embeddingModel,
                embeddingDimensions,
                embedding: embeddingBlob,
                contentHash: chunk.contentHash,
                createdAt: timestamp,
            })
            .run();
    }
}

function createIndexingIssue(error: unknown): IndexingIssue {
    if (error instanceof EmbeddingProviderError) {
        return {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
        };
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message === "No text content was found to index.") {
        return {
            code: "content",
            message: "OpenBook could not find readable text in this PDF.",
            retryable: false,
        };
    }

    const code: IndexingErrorCode = "database";
    return {
        code,
        message: "OpenBook could not update the local search index.",
        retryable: true,
    };
}

function getDebugError(error: unknown): Record<string, string> {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            ...(error.stack ? { stack: error.stack } : {}),
        };
    }
    return { message: String(error) };
}

function getDocumentText(input: DocumentInput): string {
    return input.segments.map((segment) => segment.text).join("\n\n");
}

async function indexDocument(
    input: DocumentInput,
): Promise<IndexDocumentResult> {
    const startedAt = Date.now();
    const fullText = getDocumentText(input);
    const contentHash = createContentHash(fullText);

    console.info("[index] Starting document indexing", {
        kind: input.kind,
        fileName: input.fileName,
        segments: input.segments.length,
        characters: fullText.length,
    });

    let document: StoredDocument | null = null;
    let stage = "saving document metadata";

    try {
        document = withIndexDatabase(input.workspacePath, (db) =>
            upsertDocument(db, input, "pending", contentHash, null),
        );
        stage = "chunking document text";
        const chunks = chunkTextSegments(input.segments);
        console.info("[index] Chunking complete", {
            fileName: input.fileName,
            chunks: chunks.length,
        });
        if (input.requireText && chunks.length === 0) {
            throw new Error("No text content was found to index.");
        }

        stage = "recording chunking status";
        withIndexDatabase(input.workspacePath, (db) => {
            updateDocumentStatus(db, document.id, "chunking");
        });

        if (chunks.length === 0) {
            stage = "writing empty document index";
            withIndexDatabase(input.workspacePath, (db) => {
                const writeRows = db.sqlite.transaction(() => {
                    deleteExistingDocumentRows(db, document.id);
                    updateDocumentStatus(db, document.id, "ready");
                });
                writeRows();
            });
            console.info("[index] Empty document indexed", {
                fileName: input.fileName,
                durationMs: Date.now() - startedAt,
            });
            return { success: true };
        }

        stage = "recording embedding status";
        withIndexDatabase(input.workspacePath, (db) => {
            updateDocumentStatus(db, document.id, "embedding");
        });
        stage = "requesting embeddings";
        console.info("[index] Requesting embeddings", {
            fileName: input.fileName,
            chunks: chunks.length,
        });
        const embeddingResult = await embedTexts(
            chunks.map((chunk) => chunk.text),
        );
        console.info("[index] Embeddings received", {
            fileName: input.fileName,
            model: embeddingResult.model,
            dimensions: embeddingResult.dimensions,
        });

        stage = "writing embeddings and index rows";
        withIndexDatabase(input.workspacePath, (db) => {
            ensureVectorTable(db, embeddingResult.dimensions);
            setMetadata(db, "embedding_model", embeddingResult.model);

            const writeRows = db.sqlite.transaction(() => {
                console.info("[index] Writing index records", {
                    fileName: input.fileName,
                    chunks: chunks.length,
                });
                deleteExistingDocumentRows(db, document.id);
                insertIndexedRows(
                    db,
                    document.id,
                    chunks,
                    embeddingResult.embeddings,
                    embeddingResult.model,
                    embeddingResult.dimensions,
                );
                updateDocumentStatus(db, document.id, "ready");
            });

            writeRows();
        });
        console.info("[index] Document indexing complete", {
            fileName: input.fileName,
            chunks: chunks.length,
            durationMs: Date.now() - startedAt,
        });
        return { success: true };
    } catch (err) {
        const issue = createIndexingIssue(err);
        console.error("[index] Document indexing failed", {
            kind: input.kind,
            fileName: input.fileName,
            stage,
            error: issue.message,
            cause: getDebugError(err),
            durationMs: Date.now() - startedAt,
        });
        if (document) {
            try {
                withIndexDatabase(input.workspacePath, (db) => {
                    updateDocumentStatus(
                        db,
                        document.id,
                        "error",
                        issue.message,
                    );
                });
            } catch (statusError) {
                console.error("[index] Could not record indexing failure", {
                    fileName: input.fileName,
                    error:
                        statusError instanceof Error
                            ? statusError.message
                            : String(statusError),
                });
            }
        }
        return { success: false, issue };
    }
}

function getSourcePath(workspacePath: string, fileName: string): string {
    return path.join(workspacePath, WORKSPACE_DIRS.sources, fileName);
}

function getFileContentHash(filePath: string): string | null {
    try {
        return createContentHash(fs.readFileSync(filePath));
    } catch {
        return null;
    }
}

function getPageTextSidecarPath(
    workspacePath: string,
    fileName: string,
): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_DIRS.text,
        fileName.replace(/\.pdf$/i, ".pages.json"),
    );
}

function getTextSidecarPath(workspacePath: string, fileName: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_DIRS.text,
        fileName.replace(/\.pdf$/i, ".txt"),
    );
}

function getSourcesIndexPath(workspacePath: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_FILES.sourcesIndex,
    );
}

function readSourcePages(
    workspacePath: string,
    fileName: string,
): SourceTextPage[] {
    try {
        const parsed: unknown = JSON.parse(
            fs.readFileSync(
                getPageTextSidecarPath(workspacePath, fileName),
                "utf-8",
            ),
        );
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((item): item is SourceTextPage => {
            if (typeof item !== "object" || item === null) return false;
            const page = (item as SourceTextPage).page;
            const text = (item as SourceTextPage).text;
            return typeof page === "number" && typeof text === "string";
        });
    } catch {
        return [];
    }
}

function writeSourcePages(
    workspacePath: string,
    fileName: string,
    pages: SourceTextPage[],
): void {
    const textPath = getTextSidecarPath(workspacePath, fileName);
    fs.mkdirSync(path.dirname(textPath), { recursive: true });
    fs.writeFileSync(
        textPath,
        pages.map((page) => page.text).join("\n\n"),
        "utf-8",
    );
    fs.writeFileSync(
        getPageTextSidecarPath(workspacePath, fileName),
        JSON.stringify(pages, null, 2),
        "utf-8",
    );
}

function readSourceEntries(workspacePath: string): SourceEntryRecord[] {
    try {
        const parsed: unknown = JSON.parse(
            fs.readFileSync(getSourcesIndexPath(workspacePath), "utf-8"),
        );
        if (typeof parsed !== "object" || parsed === null) return [];

        return Object.values(parsed).filter(
            (item): item is SourceEntryRecord => {
                if (typeof item !== "object" || item === null) return false;
                return typeof (item as SourceEntryRecord).fileName === "string";
            },
        );
    } catch {
        return [];
    }
}

function listMarkdownFiles(dir: string): string[] {
    try {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory()) return listMarkdownFiles(entryPath);
            return entry.isFile() && /\.md$/i.test(entry.name)
                ? [entryPath]
                : [];
        });
    } catch {
        return [];
    }
}

export async function indexSource(
    workspacePath: string,
    fileName: string,
    pages: SourceTextPage[],
): Promise<IndexDocumentResult> {
    return indexDocument({
        workspacePath,
        kind: "pdf",
        filePath: getSourcePath(workspacePath, fileName),
        fileName,
        sourceFileName: fileName,
        segments: pages.map((page) => ({ text: page.text, page: page.page })),
        metadata: {
            workspacePath,
            totalPages: pages.length,
            sourceHash: getFileContentHash(
                getSourcePath(workspacePath, fileName),
            ),
        },
        requireText: true,
    });
}

export async function indexNote(
    workspacePath: string,
    filePath: string,
    content: string,
): Promise<IndexDocumentResult> {
    return indexDocument({
        workspacePath,
        kind: "note",
        filePath,
        fileName: path.basename(filePath),
        sourceFileName: null,
        segments: [{ text: content, page: null }],
        metadata: { workspacePath },
        requireText: false,
    });
}

export function removeSourceIndex(
    workspacePath: string,
    fileName: string,
): void {
    console.info("[index] Removing source index", { fileName });
    const filePath = getSourcePath(workspacePath, fileName);
    withIndexDatabase(workspacePath, (db) => {
        const document = db.orm
            .select({ id: documents.id })
            .from(documents)
            .where(
                and(
                    eq(documents.kind, "pdf"),
                    eq(documents.filePath, filePath),
                ),
            )
            .get();
        if (!document) return;
        deleteExistingDocumentRows(db, document.id);
        db.orm.delete(documents).where(eq(documents.id, document.id)).run();
    });
    console.info("[index] Source index removed", { fileName });
}

export function removeNoteIndex(workspacePath: string, filePath: string): void {
    console.info("[index] Removing note index", {
        fileName: path.basename(filePath),
    });
    withIndexDatabase(workspacePath, (db) => {
        const document = db.orm
            .select({ id: documents.id })
            .from(documents)
            .where(
                and(
                    eq(documents.kind, "note"),
                    eq(documents.filePath, filePath),
                ),
            )
            .get();
        if (!document) return;
        deleteExistingDocumentRows(db, document.id);
        db.orm.delete(documents).where(eq(documents.id, document.id)).run();
    });
    console.info("[index] Note index removed", {
        fileName: path.basename(filePath),
    });
}

export function renameSourceIndex(
    workspacePath: string,
    oldFileName: string,
    newFileName: string,
): void {
    console.info("[index] Renaming source index", {
        oldFileName,
        newFileName,
    });
    withIndexDatabase(workspacePath, (db) => {
        db.orm
            .update(documents)
            .set({
                filePath: getSourcePath(workspacePath, newFileName),
                fileName: newFileName,
                sourceFileName: newFileName,
                updatedAt: nowIso(),
            })
            .where(
                and(
                    eq(documents.kind, "pdf"),
                    eq(
                        documents.filePath,
                        getSourcePath(workspacePath, oldFileName),
                    ),
                ),
            )
            .run();
    });
}

export function renameNoteIndex(
    workspacePath: string,
    oldPath: string,
    newPath: string,
): void {
    console.info("[index] Renaming note index", {
        oldFileName: path.basename(oldPath),
        newFileName: path.basename(newPath),
    });
    withIndexDatabase(workspacePath, (db) => {
        db.orm
            .update(documents)
            .set({
                filePath: newPath,
                fileName: path.basename(newPath),
                updatedAt: nowIso(),
            })
            .where(
                and(
                    eq(documents.kind, "note"),
                    eq(documents.filePath, oldPath),
                ),
            )
            .run();
    });
}

function documentKey(kind: DocumentKind, filePath: string): string {
    return `${kind}:${filePath}`;
}

function createExpectedDocument(
    input: DocumentInput,
    sourceHash: string | null = null,
): ExpectedDocument {
    return {
        input,
        contentHash: createContentHash(getDocumentText(input)),
        chunks: chunkTextSegments(input.segments),
        sourceHash,
    };
}

function getStoredSourceHash(
    document: StoredDocumentRecord | undefined,
): string | null {
    if (!document) return null;
    try {
        const metadata: unknown = JSON.parse(document.metadataJson);
        if (typeof metadata !== "object" || metadata === null) return null;
        const sourceHash = (metadata as Record<string, unknown>).sourceHash;
        return typeof sourceHash === "string" ? sourceHash : null;
    } catch {
        return null;
    }
}

async function getExpectedDocuments(
    workspacePath: string,
    storedByKey: Map<string, StoredDocumentRecord>,
): Promise<ExpectedDocument[]> {
    const expected: ExpectedDocument[] = [];

    for (const source of readSourceEntries(workspacePath)) {
        if (source.status !== "ready") continue;

        const filePath = getSourcePath(workspacePath, source.fileName);
        if (!fs.existsSync(filePath)) {
            console.warn("[index] Skipping missing source file", {
                fileName: source.fileName,
            });
            continue;
        }

        const sourceHash = createContentHash(fs.readFileSync(filePath));
        const stored = storedByKey.get(documentKey("pdf", filePath));
        let pages = readSourcePages(workspacePath, source.fileName);
        if (getStoredSourceHash(stored) !== sourceHash) {
            console.info("[index] Source file changed; extracting text", {
                fileName: source.fileName,
            });
            try {
                const extracted = await extractPdfText(filePath);
                pages = extracted.pages;
                writeSourcePages(workspacePath, source.fileName, pages);
            } catch (error) {
                console.error("[index] Source text extraction failed", {
                    fileName: source.fileName,
                    error:
                        error instanceof Error ? error.message : String(error),
                });
                pages = [];
            }
        }
        expected.push(
            createExpectedDocument(
                {
                    workspacePath,
                    kind: "pdf",
                    filePath,
                    fileName: source.fileName,
                    sourceFileName: source.fileName,
                    segments: pages.map((page) => ({
                        text: page.text,
                        page: page.page,
                    })),
                    metadata: {
                        workspacePath,
                        totalPages: pages.length,
                        sourceHash,
                    },
                    requireText: true,
                },
                sourceHash,
            ),
        );
    }

    const notesDir = path.join(workspacePath, WORKSPACE_DIRS.notes);
    for (const filePath of listMarkdownFiles(notesDir)) {
        expected.push(
            createExpectedDocument({
                workspacePath,
                kind: "note",
                filePath,
                fileName: path.basename(filePath),
                sourceFileName: null,
                segments: [
                    { text: fs.readFileSync(filePath, "utf-8"), page: null },
                ],
                metadata: { workspacePath },
                requireText: false,
            }),
        );
    }

    return expected;
}

function getStoredDocuments(workspacePath: string): StoredDocumentRecord[] {
    return withIndexDatabase(
        workspacePath,
        (db) =>
            db.orm
                .select({
                    id: documents.id,
                    kind: documents.kind,
                    filePath: documents.filePath,
                    contentHash: documents.contentHash,
                    metadataJson: documents.metadataJson,
                    status: documents.status,
                })
                .from(documents)
                .all() as StoredDocumentRecord[],
    );
}

function getRowCount(
    db: IndexDatabase,
    statement: string,
    documentId: number,
): number {
    const row = db.sqlite.prepare(statement).get(documentId) as {
        count: number;
    };
    return row.count;
}

function hasCompleteDocumentIndex(
    db: IndexDatabase,
    documentId: number,
    expectedChunks: number,
): boolean {
    const chunkCount = getRowCount(
        db,
        "SELECT COUNT(*) AS count FROM chunks WHERE document_id = ?",
        documentId,
    );
    if (chunkCount !== expectedChunks) return false;
    if (expectedChunks === 0) return true;

    const ftsCount = getRowCount(
        db,
        "SELECT COUNT(*) AS count FROM chunks_fts WHERE document_id = ?",
        documentId,
    );
    const embeddingCount = getRowCount(
        db,
        "SELECT COUNT(*) AS count FROM chunk_embeddings e INNER JOIN chunks c ON c.id = e.chunk_id WHERE c.document_id = ?",
        documentId,
    );
    if (
        ftsCount !== expectedChunks ||
        embeddingCount !== expectedChunks ||
        !vectorTableExists(db)
    ) {
        return false;
    }

    const missingVectors = getRowCount(
        db,
        `SELECT COUNT(*) AS count FROM chunk_embeddings e INNER JOIN chunks c ON c.id = e.chunk_id LEFT JOIN ${VECTOR_TABLE_NAME} v ON v.rowid = e.vector_rowid WHERE c.document_id = ? AND v.rowid IS NULL`,
        documentId,
    );
    return missingVectors === 0;
}

function removeStoredDocument(workspacePath: string, documentId: number): void {
    withIndexDatabase(workspacePath, (db) => {
        const removeRows = db.sqlite.transaction(() => {
            deleteExistingDocumentRows(db, documentId);
            db.orm.delete(documents).where(eq(documents.id, documentId)).run();
        });
        removeRows();
    });
}

function isBlockingIssue(issue: IndexingIssue): boolean {
    return issue.code !== "content";
}

async function reconcileWorkspaceIndexInternal(
    workspacePath: string,
): Promise<IndexReconciliationResult> {
    const startedAt = Date.now();
    const result: IndexReconciliationResult = {
        status: "complete",
        indexed: 0,
        updated: 0,
        removed: 0,
        unchanged: 0,
        failed: 0,
    };

    console.info("[index] Checking workspace index");
    const storedDocuments = getStoredDocuments(workspacePath);
    const storedByKey = new Map(
        storedDocuments.map((document) => [
            documentKey(document.kind, document.filePath),
            document,
        ]),
    );
    const expectedDocuments = await getExpectedDocuments(
        workspacePath,
        storedByKey,
    );
    const expectedByKey = new Map(
        expectedDocuments.map((document) => [
            documentKey(document.input.kind, document.input.filePath),
            document,
        ]),
    );

    for (const document of storedDocuments) {
        if (expectedByKey.has(documentKey(document.kind, document.filePath))) {
            continue;
        }
        removeStoredDocument(workspacePath, document.id);
        result.removed += 1;
    }

    for (const expected of expectedDocuments) {
        const key = documentKey(expected.input.kind, expected.input.filePath);
        const stored = storedByKey.get(key);
        const hasCompleteIndex =
            stored !== undefined &&
            withIndexDatabase(workspacePath, (db) =>
                hasCompleteDocumentIndex(db, stored.id, expected.chunks.length),
            );
        const needsIndexing =
            !stored ||
            stored.contentHash !== expected.contentHash ||
            getStoredSourceHash(stored) !== expected.sourceHash ||
            stored.status !== "ready" ||
            !hasCompleteIndex;

        if (!needsIndexing) {
            result.unchanged += 1;
            continue;
        }

        const indexingResult = await indexDocument(expected.input);
        if (indexingResult.success) {
            if (stored) result.updated += 1;
            else result.indexed += 1;
            continue;
        }

        result.failed += 1;
        result.issue ??= indexingResult.issue;
        if (indexingResult.issue && isBlockingIssue(indexingResult.issue)) {
            result.status = "blocked";
            break;
        }
        result.status = "partial";
    }

    if (result.status === "complete" && result.failed > 0) {
        result.status = "partial";
    }
    console.info("[index] Workspace index check complete", {
        ...result,
        durationMs: Date.now() - startedAt,
    });
    return result;
}

export function reconcileWorkspaceIndex(
    workspacePath: string,
): Promise<IndexReconciliationResult> {
    const active = activeReconciliations.get(workspacePath);
    if (active) return active;

    const reconciliation = reconcileWorkspaceIndexInternal(
        workspacePath,
    ).finally(() => {
        activeReconciliations.delete(workspacePath);
    });
    activeReconciliations.set(workspacePath, reconciliation);
    return reconciliation;
}

export async function rebuildWorkspaceIndex(
    workspacePath: string,
): Promise<void> {
    const startedAt = Date.now();
    console.info("[index] Rebuilding workspace index");
    withIndexDatabase(workspacePath, (db) => {
        db.sqlite.exec("DELETE FROM chunks_fts");
        if (vectorTableExists(db)) {
            db.sqlite.exec(`DELETE FROM ${VECTOR_TABLE_NAME}`);
        }
        db.orm.delete(documents).run();
    });

    const sources = readSourceEntries(workspacePath);
    console.info("[index] Rebuilding source indexes", {
        sources: sources.length,
    });
    for (const source of sources) {
        if (source.status === "error") continue;
        await indexSource(
            workspacePath,
            source.fileName,
            readSourcePages(workspacePath, source.fileName),
        );
    }

    const notesDir = path.join(workspacePath, WORKSPACE_DIRS.notes);
    const notePaths = listMarkdownFiles(notesDir);
    console.info("[index] Rebuilding note indexes", {
        notes: notePaths.length,
    });
    for (const notePath of notePaths) {
        const content = fs.readFileSync(notePath, "utf-8");
        await indexNote(workspacePath, notePath, content);
    }
    console.info("[index] Workspace index rebuild complete", {
        durationMs: Date.now() - startedAt,
    });
}
