import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

import {
    indexSource,
    removeSourceIndex,
    renameSourceIndex,
} from "../../agents/indexing/indexService";
import { WORKSPACE_DIRS, WORKSPACE_FILES } from "../../workspaceLayout";
import type { SourceEntry } from "../../shared/types";

interface SourcesIndex {
    [fileName: string]: SourceEntry;
}

export interface SourceTextPage {
    page: number;
    text: string;
}

export function getSourcesDir(workspacePath: string): string {
    return path.join(workspacePath, WORKSPACE_DIRS.sources);
}

function getIndexFilePath(workspacePath: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_FILES.sourcesIndex,
    );
}

export function getSourcePath(workspacePath: string, fileName: string): string {
    return path.join(workspacePath, WORKSPACE_DIRS.sources, fileName);
}

export function getTextSidecarPath(
    workspacePath: string,
    fileName: string,
): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_DIRS.text,
        fileName.replace(/\.pdf$/i, ".txt"),
    );
}

export function getPageTextSidecarPath(
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

function readIndex(workspacePath: string): SourcesIndex {
    try {
        return JSON.parse(
            fs.readFileSync(getIndexFilePath(workspacePath), "utf-8"),
        );
    } catch {
        return {};
    }
}

function writeIndex(workspacePath: string, index: SourcesIndex): void {
    fs.mkdirSync(path.dirname(getIndexFilePath(workspacePath)), {
        recursive: true,
    });
    fs.writeFileSync(
        getIndexFilePath(workspacePath),
        JSON.stringify(index, null, 2),
        "utf-8",
    );
}

function uniqueName(dir: string, baseName: string, ext: string): string {
    let candidate = `${baseName}${ext}`;
    let n = 2;
    while (fs.existsSync(path.join(dir, candidate))) {
        candidate = `${baseName}-${n}${ext}`;
        n += 1;
    }
    return candidate;
}

export function listSources(workspacePath: string): SourceEntry[] {
    return Object.values(readIndex(workspacePath));
}

export function writePageSidecars(
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

export async function addPdfSource(
    workspacePath: string,
    originalPath: string,
): Promise<SourceEntry> {
    const originalName = path.basename(originalPath);
    const baseName = originalName.replace(/\.pdf$/i, "");

    const sourcesDir = getSourcesDir(workspacePath);
    fs.mkdirSync(sourcesDir, { recursive: true });

    const fileName = uniqueName(sourcesDir, baseName, ".pdf");
    const destPath = path.join(sourcesDir, fileName);
    fs.copyFileSync(originalPath, destPath);

    let totalPages = 0;
    let extractionError: string | undefined;
    let pages: SourceTextPage[] = [];

    try {
        const buffer = fs.readFileSync(destPath);
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const extracted = await extractText(pdf, { mergePages: false });
        totalPages = extracted.totalPages;
        const pageTexts = Array.isArray(extracted.text)
            ? extracted.text
            : [extracted.text];
        pages = pageTexts.map((text, index) => ({
            page: index + 1,
            text,
        }));
        writePageSidecars(workspacePath, fileName, pages);
    } catch (err) {
        extractionError = err instanceof Error ? err.message : String(err);
    }

    const entry: SourceEntry = {
        fileName,
        fileType: "pdf",
        status: extractionError ? "error" : "ready",
        addedAt: new Date().toISOString(),
        totalPages,
        ...(extractionError ? { error: extractionError } : {}),
    };

    const index = readIndex(workspacePath);
    index[fileName] = entry;
    writeIndex(workspacePath, index);

    if (!extractionError) {
        await indexSource(workspacePath, fileName, pages);
    }

    return entry;
}

export function removeSource(workspacePath: string, fileName: string): boolean {
    const index = readIndex(workspacePath);
    if (!(fileName in index)) return false;

    const paths = [
        getSourcePath(workspacePath, fileName),
        getTextSidecarPath(workspacePath, fileName),
        getPageTextSidecarPath(workspacePath, fileName),
    ];
    for (const filePath of paths) {
        try {
            fs.rmSync(filePath);
        } catch {
            // File may not exist.
        }
    }

    delete index[fileName];
    writeIndex(workspacePath, index);
    removeSourceIndex(workspacePath, fileName);
    return true;
}

export function renameSource(
    workspacePath: string,
    oldFileName: string,
    newBaseName: string,
): SourceEntry | null {
    const index = readIndex(workspacePath);
    const entry = index[oldFileName];
    if (!entry) return null;

    const baseName = newBaseName
        .trim()
        .replace(/\.pdf$/i, "")
        .replace(/[\\/]/g, "-");
    if (!baseName) return null;

    const requestedFileName = `${baseName}.pdf`;
    if (requestedFileName === oldFileName) return entry;

    const sourcesDir = getSourcesDir(workspacePath);
    const newFileName = uniqueName(sourcesDir, baseName, ".pdf");
    if (newFileName === oldFileName) return entry;

    const oldPdfPath = path.join(sourcesDir, oldFileName);
    const newPdfPath = path.join(sourcesDir, newFileName);
    if (!fs.existsSync(oldPdfPath)) return null;

    fs.renameSync(oldPdfPath, newPdfPath);

    const sidecars = [
        [
            getTextSidecarPath(workspacePath, oldFileName),
            getTextSidecarPath(workspacePath, newFileName),
        ],
        [
            getPageTextSidecarPath(workspacePath, oldFileName),
            getPageTextSidecarPath(workspacePath, newFileName),
        ],
    ];
    for (const [oldPath, newPath] of sidecars) {
        if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    }

    const renamed = { ...entry, fileName: newFileName };
    delete index[oldFileName];
    index[newFileName] = renamed;
    writeIndex(workspacePath, index);
    renameSourceIndex(workspacePath, oldFileName, newFileName);
    return renamed;
}

export function readSourceFile(filePath: string): ArrayBuffer | null {
    try {
        const buf = fs.readFileSync(filePath);
        return buf.buffer.slice(
            buf.byteOffset,
            buf.byteOffset + buf.byteLength,
        ) as ArrayBuffer;
    } catch {
        return null;
    }
}
