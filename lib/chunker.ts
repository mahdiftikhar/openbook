/**
 * Splits text into overlapping chunks for RAG.
 * Targets ~500 characters per chunk with 100 character overlap.
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 500,
  overlap: number = 100
): string[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Split by paragraphs first
  const paragraphs = normalized.split(/\n\n+/).filter((p) => p.trim().length > 0);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    // If paragraph fits in one chunk, use it
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph.trim());
      continue;
    }

    // Split large paragraph by sentences
    const sentences = paragraph.match(/[^.!?]+[.!?]+[\])'"'"]*\s*/g) || [paragraph];

    let currentChunk = "";

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Overlap: keep last portion of previous chunk
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.floor(overlap / 5));
        currentChunk = overlapWords.join(" ") + " ";
      }
      currentChunk += sentence;
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
  }

  // Merge very small adjacent chunks
  const merged: string[] = [];
  for (const chunk of chunks) {
    if (merged.length > 0 && merged[merged.length - 1].length + chunk.length < maxChunkSize) {
      merged[merged.length - 1] += " " + chunk;
    } else {
      merged.push(chunk);
    }
  }

  return merged.filter((c) => c.trim().length > 0);
}
