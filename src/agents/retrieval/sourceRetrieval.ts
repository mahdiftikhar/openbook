import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

import type { ChatCitation, ChatRequest } from "../../shared/types";
import {
    getPageTextSidecarPath,
    getSourcePath,
    getTextSidecarPath,
    writePageSidecars,
    type SourceTextPage,
} from "../../main/services/sourceService";

const MAX_CHUNKS = 6;
const MAX_CHUNK_CHARS = 1200;

const STOP_WORDS = new Set([
    "about",
    "after",
    "again",
    "also",
    "because",
    "before",
    "between",
    "could",
    "from",
    "have",
    "into",
    "should",
    "that",
    "their",
    "there",
    "these",
    "this",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
]);

interface SourceChunk {
    fileName: string;
    filePath: string;
    page: number;
    text: string;
    order: number;
}

interface RankedChunk {
    chunk: SourceChunk;
    score: number;
}

export interface RetrievedSource {
    citation: ChatCitation;
    text: string;
}

export interface ChatContext {
    citations: ChatCitation[];
    sources: RetrievedSource[];
}

function cleanText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function isSafeSourceFileName(fileName: string): boolean {
    return path.basename(fileName) === fileName && /\.pdf$/i.test(fileName);
}

function uniqueSourceFileNames(fileNames: string[]): string[] {
    const seen = new Set<string>();
    const safeNames: string[] = [];

    for (const fileName of fileNames) {
        if (!isSafeSourceFileName(fileName) || seen.has(fileName)) continue;
        seen.add(fileName);
        safeNames.push(fileName);
    }

    return safeNames;
}

function readSavedPages(filePath: string): SourceTextPage[] {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf-8"));
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

async function extractPdfPages(
    workspacePath: string,
    fileName: string,
): Promise<SourceTextPage[]> {
    const pdfPath = getSourcePath(workspacePath, fileName);
    if (!fs.existsSync(pdfPath)) return [];

    const buffer = fs.readFileSync(pdfPath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: false });
    const pageTexts = Array.isArray(extracted.text)
        ? extracted.text
        : [extracted.text];
    const pages = pageTexts.map((text, index) => ({
        page: index + 1,
        text,
    }));
    writePageSidecars(workspacePath, fileName, pages);
    return pages;
}

async function readSourcePages(
    workspacePath: string,
    fileName: string,
): Promise<SourceTextPage[]> {
    const savedPages = readSavedPages(
        getPageTextSidecarPath(workspacePath, fileName),
    );
    if (savedPages.length > 0) return savedPages;

    try {
        const extractedPages = await extractPdfPages(workspacePath, fileName);
        if (extractedPages.length > 0) return extractedPages;
    } catch {
        // Fall back to the older merged text sidecar below.
    }

    try {
        const text = fs.readFileSync(
            getTextSidecarPath(workspacePath, fileName),
            "utf-8",
        );
        return text.trim() ? [{ page: 1, text }] : [];
    } catch {
        return [];
    }
}

function splitLongText(text: string): string[] {
    const chunks: string[] = [];
    let offset = 0;

    while (offset < text.length) {
        chunks.push(text.slice(offset, offset + MAX_CHUNK_CHARS));
        offset += MAX_CHUNK_CHARS;
    }

    return chunks;
}

function splitPageText(text: string): string[] {
    const paragraphs = text
        .split(/\n{2,}/)
        .map(cleanText)
        .filter(Boolean);
    const chunks: string[] = [];
    let current = "";

    for (const paragraph of paragraphs) {
        if (paragraph.length > MAX_CHUNK_CHARS) {
            if (current) {
                chunks.push(current);
                current = "";
            }
            chunks.push(...splitLongText(paragraph));
            continue;
        }

        const next = current ? `${current}\n\n${paragraph}` : paragraph;
        if (next.length > MAX_CHUNK_CHARS) {
            chunks.push(current);
            current = paragraph;
        } else {
            current = next;
        }
    }

    if (current) chunks.push(current);
    return chunks;
}

async function loadSourceChunks(
    workspacePath: string,
    sourceFileNames: string[],
): Promise<SourceChunk[]> {
    const chunks: SourceChunk[] = [];
    let order = 0;

    for (const fileName of sourceFileNames) {
        const filePath = getSourcePath(workspacePath, fileName);
        const pages = await readSourcePages(workspacePath, fileName);

        for (const page of pages) {
            const pageChunks = splitPageText(page.text);
            for (const text of pageChunks) {
                chunks.push({
                    fileName,
                    filePath,
                    page: page.page,
                    text,
                    order,
                });
                order += 1;
            }
        }
    }

    return chunks;
}

function getSearchTerms(question: string): string[] {
    const words = question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    const terms: string[] = [];
    const seen = new Set<string>();

    for (const word of words) {
        if (STOP_WORDS.has(word) || seen.has(word)) continue;
        seen.add(word);
        terms.push(word);
    }

    return terms.slice(0, 16);
}

function countOccurrences(text: string, term: string): number {
    let count = 0;
    let index = text.indexOf(term);

    while (index !== -1) {
        count += 1;
        index = text.indexOf(term, index + term.length);
    }

    return count;
}

function scoreChunk(text: string, terms: string[]): number {
    const lowerText = text.toLowerCase();
    let score = 0;

    for (const term of terms) {
        score += countOccurrences(lowerText, term) * term.length;
    }

    return score;
}

function rankChunks(chunks: SourceChunk[], question: string): RankedChunk[] {
    const terms = getSearchTerms(question);
    const ranked = chunks.map((chunk) => ({
        chunk,
        score: scoreChunk(chunk.text, terms),
    }));

    ranked.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.chunk.order - b.chunk.order;
    });

    const positiveMatches = ranked.filter((item) => item.score > 0);
    return (positiveMatches.length > 0 ? positiveMatches : ranked).slice(
        0,
        MAX_CHUNKS,
    );
}

function makeExcerpt(text: string, terms: string[]): string {
    const normalized = cleanText(text);
    const lowerText = normalized.toLowerCase();
    let firstMatch = -1;

    for (const term of terms) {
        const index = lowerText.indexOf(term);
        if (index !== -1 && (firstMatch === -1 || index < firstMatch)) {
            firstMatch = index;
        }
    }

    const start = firstMatch === -1 ? 0 : Math.max(0, firstMatch - 120);
    const end = Math.min(normalized.length, start + 520);
    const excerpt = normalized.slice(start, end).trim();
    return `${start > 0 ? "..." : ""}${excerpt}${end < normalized.length ? "..." : ""}`;
}

function citationFromRankedChunk(
    ranked: RankedChunk,
    index: number,
    terms: string[],
): ChatCitation {
    return {
        id: index + 1,
        fileName: ranked.chunk.fileName,
        filePath: ranked.chunk.filePath,
        page: ranked.chunk.page,
        excerpt: makeExcerpt(ranked.chunk.text, terms),
    };
}

function buildRetrievalQuery(request: ChatRequest): string {
    const recentHistory = request.history
        .slice(-6)
        .map((message) => message.content)
        .join("\n");
    const texts = (request.contextTexts ?? [])
        .map((excerpt) => excerpt.text)
        .join("\n");
    return [recentHistory, texts, request.question].filter(Boolean).join("\n");
}

export function normalizeChatContextText(text: string): string {
     return text.replace(/\s+/g, " ").trim();
}

export async function createChatContext(
    request: ChatRequest,
): Promise<ChatContext> {
    const sourceFileNames = uniqueSourceFileNames(request.sourceFileNames);
    const hasSources = sourceFileNames.length > 0;
    const hasTexts =
        request.contextTexts && request.contextTexts.length > 0;

    if (!hasSources && !hasTexts) {
        throw new Error(
            "Select at least one source or add text context before asking a question.",
        );
    }

    const citations: ChatCitation[] = [];
    const sourcesList: RetrievedSource[] = [];
    let nextId = 1;

    if (hasSources) {
        const chunks = await loadSourceChunks(
            request.workspacePath,
            sourceFileNames,
        );
        if (chunks.length === 0) {
            throw new Error(
                "No extracted text was found for the selected sources.",
            );
        }

        const retrievalQuery = buildRetrievalQuery(request);
        const terms = getSearchTerms(retrievalQuery);
        const rankedChunks = rankChunks(chunks, retrievalQuery);

        for (const ranked of rankedChunks) {
            const citation = citationFromRankedChunk(ranked, nextId - 1, terms);
            citations.push(citation);
            sourcesList.push({ citation, text: ranked.chunk.text });
            nextId++;
        }
    }

    if (hasTexts) {
        const excerpts = request.contextTexts;
        for (const excerpt of excerpts) {
            const excerptText = cleanText(excerpt.text);
            const citation: ChatCitation = {
                id: nextId,
                fileName: path.basename(excerpt.filePath),
                filePath: excerpt.filePath,
                page: excerpt.page,
                excerpt:
                    excerptText.length > 520
                        ? `${excerptText.slice(0, 517).trim()}...`
                        : excerptText,
            };
            citations.push(citation);
            sourcesList.push({ citation, text: excerpt.text });
            nextId++;
        }
    }

    return { citations, sources: sourcesList };
}
