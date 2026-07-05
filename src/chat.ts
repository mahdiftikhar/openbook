import { ipcMain, type WebContents } from "electron";
import fs from "node:fs";
import path from "node:path";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import { extractText, getDocumentProxy } from "unpdf";

import { WORKSPACE_DIRS } from "./workspaceLayout";

const MAX_CHUNKS = 6;
const MAX_CHUNK_CHARS = 1200;
const STREAM_DELAY_MS = 18;
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

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

interface SourceTextPage {
    page: number;
    text: string;
}

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

interface RetrievedSource {
    citation: ChatCitation;
    text: string;
}

interface ChatContext {
    citations: ChatCitation[];
    sources: RetrievedSource[];
}

const activeRequests = new Set<string>();
const activeAbortControllers = new Map<string, AbortController>();

function getSourcePath(workspacePath: string, fileName: string): string {
    return path.join(workspacePath, WORKSPACE_DIRS.sources, fileName);
}

function getTextSidecarPath(workspacePath: string, fileName: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_DIRS.text,
        fileName.replace(/\.pdf$/i, ".txt"),
    );
}

function getPageTextSidecarPath(workspacePath: string, fileName: string): string {
    return path.join(
        workspacePath,
        WORKSPACE_DIRS.metadata,
        WORKSPACE_DIRS.text,
        fileName.replace(/\.pdf$/i, ".pages.json"),
    );
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

function writePageSidecars(
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

function summarizeExcerpt(excerpt: string): string {
    if (excerpt.length <= 260) return excerpt;
    return `${excerpt.slice(0, 257).trim()}...`;
}

function buildLocalResponse(question: string, citations: ChatCitation[]): string {
    const lines = citations.map((citation) => {
        return `- ${summarizeExcerpt(citation.excerpt)} [${citation.id}]`;
    });

    return [
        "LLM provider is not configured yet, so I pulled the most relevant passages from the selected sources.",
        `Question: ${question}`,
        "",
        ...lines,
    ].join("\n");
}

function buildSourceContext(sources: RetrievedSource[]): string {
    return sources
        .map((source) => {
            const citation = source.citation;
            return `[${citation.id}] ${citation.fileName}, page ${citation.page}\n${cleanText(source.text)}`;
        })
        .join("\n\n");
}

function buildRetrievalQuery(request: ChatRequest): string {
    const recentHistory = request.history
        .slice(-6)
        .map((message) => message.content)
        .join("\n");
    return `${recentHistory}\n${request.question}`;
}

function getDeepSeekApiKey(): string | null {
    return process.env.DEEPSEEK_API_KEY?.trim() || null;
}

function getDeepSeekModel(): string {
    return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL;
}

function buildModelMessages(
    request: ChatRequest,
    context: ChatContext,
): { role: "user" | "assistant"; content: string }[] {
    const history = request.history
        .slice(-8)
        .filter((message) => message.content.trim())
        .map((message) => ({
            role: message.role,
            content: message.content,
        }));

    return [
        ...history,
        {
            role: "user",
            content: [
                "Use the source context below to answer the question.",
                "",
                "Source context:",
                buildSourceContext(context.sources),
                "",
                `Question: ${request.question}`,
            ].join("\n"),
        },
    ];
}

async function createChatContext(request: ChatRequest): Promise<ChatContext> {
    const sourceFileNames = uniqueSourceFileNames(request.sourceFileNames);
    if (sourceFileNames.length === 0) {
        throw new Error("Select at least one source before asking a question.");
    }

    const chunks = await loadSourceChunks(request.workspacePath, sourceFileNames);
    if (chunks.length === 0) {
        throw new Error("No extracted text was found for the selected sources.");
    }

    const retrievalQuery = buildRetrievalQuery(request);
    const terms = getSearchTerms(retrievalQuery);
    const rankedChunks = rankChunks(chunks, retrievalQuery);
    const sources = rankedChunks.map((ranked, index) => ({
        citation: citationFromRankedChunk(ranked, index, terms),
        text: ranked.chunk.text,
    }));

    return {
        citations: sources.map((source) => source.citation),
        sources,
    };
}

function sendStreamEvent(sender: WebContents, event: ChatStreamEvent): void {
    if (!sender.isDestroyed()) {
        sender.send("chat:stream", event);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function streamContent(
    sender: WebContents,
    requestId: string,
    content: string,
): Promise<boolean> {
    const tokens = content.match(/\S+\s*/g) ?? [content];

    for (const token of tokens) {
        if (!activeRequests.has(requestId)) return false;
        sendStreamEvent(sender, {
            type: "delta",
            requestId,
            text: token,
        });
        await delay(STREAM_DELAY_MS);
    }

    return true;
}

async function streamDeepSeekAnswer(
    sender: WebContents,
    request: ChatRequest,
    context: ChatContext,
    abortSignal: AbortSignal,
): Promise<string | null> {
    const apiKey = getDeepSeekApiKey();
    if (!apiKey) return null;

    const deepseek = createDeepSeek({ apiKey });
    const result = streamText({
        model: deepseek(getDeepSeekModel()),
        abortSignal,
        temperature: 0.2,
        system: [
            "You are openbook's research assistant.",
            "Answer using only the provided source context and recent conversation.",
            "Cite source-backed claims inline using the exact citation markers from the source context, such as [1].",
            "If the source context is insufficient, say what is missing instead of guessing.",
        ].join(" "),
        messages: buildModelMessages(request, context),
    });

    let content = "";
    for await (const text of result.textStream) {
        if (!activeRequests.has(request.requestId)) return null;
        content += text;
        sendStreamEvent(sender, {
            type: "delta",
            requestId: request.requestId,
            text,
        });
    }

    return content;
}

export function registerChatHandlers(): void {
    ipcMain.on("chat:ask", (event, request: ChatRequest) => {
        const sender = event.sender;
        const abortController = new AbortController();
        activeRequests.add(request.requestId);
        activeAbortControllers.set(request.requestId, abortController);

        void (async () => {
            try {
                const context = await createChatContext(request);
                if (!activeRequests.has(request.requestId)) return;

                sendStreamEvent(sender, {
                    type: "start",
                    requestId: request.requestId,
                    citations: context.citations,
                });

                const aiContent = await streamDeepSeekAnswer(
                    sender,
                    request,
                    context,
                    abortController.signal,
                );
                let content = aiContent;

                if (!content) {
                    content = buildLocalResponse(request.question, context.citations);
                    const completed = await streamContent(
                        sender,
                        request.requestId,
                        content,
                    );
                    if (!completed) return;
                }

                sendStreamEvent(sender, {
                    type: "done",
                    requestId: request.requestId,
                    content,
                });
            } catch (err) {
                if (!activeRequests.has(request.requestId)) return;
                sendStreamEvent(sender, {
                    type: "error",
                    requestId: request.requestId,
                    error: err instanceof Error ? err.message : String(err),
                });
            } finally {
                activeRequests.delete(request.requestId);
                activeAbortControllers.delete(request.requestId);
            }
        })();
    });

    ipcMain.on("chat:cancel", (_event, requestId: string) => {
        activeRequests.delete(requestId);
        activeAbortControllers.get(requestId)?.abort();
        activeAbortControllers.delete(requestId);
    });
}
