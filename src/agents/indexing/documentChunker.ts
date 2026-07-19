import { createContentHash } from "./contentHash";

const MAX_CHUNK_CHARS = 1200;

export interface TextSegment {
    text: string;
    page: number | null;
}

export interface IndexedChunkInput {
    chunkIndex: number;
    text: string;
    page: number | null;
    startOffset: number | null;
    endOffset: number | null;
    contentHash: string;
    tokenEstimate: number;
}

function normalizeText(text: string): string {
    // Convert Windows line endings, then collapse all whitespace runs to one space.
    return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
}

function findChunkEnd(text: string, start: number): number {
    const maxEnd = Math.min(text.length, start + MAX_CHUNK_CHARS);
    if (maxEnd === text.length) return maxEnd;

    const breakAt = text.lastIndexOf(" ", maxEnd);
    if (breakAt > start + MAX_CHUNK_CHARS / 2) return breakAt;
    return maxEnd;
}

export function chunkTextSegments(
    segments: TextSegment[],
): IndexedChunkInput[] {
    // Current scheme: split each segment into fixed-size character chunks,
    // preferring the last space before the limit so words are not cut in half.
    const chunks: IndexedChunkInput[] = [];

    for (const segment of segments) {
        const text = normalizeText(segment.text);
        let start = 0;

        while (start < text.length) {
            const end = findChunkEnd(text, start);
            const chunkText = text.slice(start, end).trim();

            if (chunkText) {
                chunks.push({
                    chunkIndex: chunks.length,
                    text: chunkText,
                    page: segment.page,
                    startOffset: start,
                    endOffset: end,
                    contentHash: createContentHash(chunkText),
                    tokenEstimate: estimateTokens(chunkText),
                });
            }

            start = end;
            while (text[start] === " ") start += 1;
        }
    }

    return chunks;
}
