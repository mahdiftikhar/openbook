/**
 * Keyword-based semantic search using TF-IDF + cosine similarity.
 * No external APIs, no native binaries needed.
 */

const STOPWORDS = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "shall",
    "you",
    "your",
    "we",
    "our",
    "they",
    "them",
    "their",
    "it",
    "its",
    "he",
    "she",
    "his",
    "her",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "not",
    "no",
    "so",
    "if",
    "then",
    "than",
    "too",
    "very",
    "just",
    "about",
    "also",
    "into",
    "over",
    "after",
    "before",
    "between",
    "up",
    "down",
    "out",
    "off",
    "more",
    "some",
    "such",
    "only",
    "other",
    "new",
    "all",
    "any",
    "each",
    "every",
    "both",
    "few",
    "most",
    "here",
    "there",
    "when",
    "where",
    "why",
    "how",
    "which",
    "who",
    "whom",
    "what",
    "am",
    "don",
    "didn",
    "doesn",
    "won",
    "wouldn",
    "couldn",
    "isn",
    "aren",
    "wasn",
    "weren",
    "haven",
    "hasn",
    "hadn",
    "can",
]);

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

interface TfidfVector {
    terms: Map<string, number>;
    magnitude: number;
}

let idfCache: Map<string, number> | null = null;
let corpusDocCount = 0;

function buildIdfCache(allDocs: string[][]) {
    corpusDocCount = allDocs.length;
    const docFreq = new Map<string, number>();

    for (const tokens of allDocs) {
        const seen = new Set<string>();
        for (const token of tokens) {
            if (!seen.has(token)) {
                docFreq.set(token, (docFreq.get(token) || 0) + 1);
                seen.add(token);
            }
        }
    }

    idfCache = new Map<string, number>();
    for (const [term, count] of docFreq) {
        idfCache.set(term, Math.log((corpusDocCount + 1) / (count + 1)) + 1);
    }
}

function computeTfidfVector(tokens: string[]): TfidfVector {
    // Term frequency (normalized by doc length)
    const tf = new Map<string, number>();
    for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
    }
    const len = tokens.length || 1;
    for (const [key, val] of tf) {
        tf.set(key, val / len);
    }

    // Multiply by IDF
    const terms = new Map<string, number>();
    let magnitude = 0;
    for (const [term, tfVal] of tf) {
        const idf = idfCache?.get(term) || 1;
        const tfidf = tfVal * idf;
        terms.set(term, tfidf);
        magnitude += tfidf * tfidf;
    }

    return { terms, magnitude: Math.sqrt(magnitude) || 1 };
}

function cosineSimilarity(a: TfidfVector, b: TfidfVector): number {
    let dotProduct = 0;
    const [smaller, larger] = a.terms.size < b.terms.size ? [a, b] : [b, a];

    for (const [term, valA] of smaller.terms) {
        const valB = larger.terms.get(term);
        if (valB !== undefined) {
            dotProduct += valA * valB;
        }
    }

    const denominator = a.magnitude * b.magnitude;
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/** Search documents by TF-IDF cosine similarity to the query */
export function searchByTfidf(
    query: string,
    documents: Array<{ id: string; content: string }>,
    topK: number = 5,
    minSimilarity: number = 0.05,
): Array<{ id: string; similarity: number }> {
    // Build IDF from all documents in the corpus
    const allTokens = documents.map((d) => tokenize(d.content));
    buildIdfCache(allTokens);

    // Compute query vector
    const queryTokens = tokenize(query);
    const queryVector = computeTfidfVector(queryTokens);

    // Score each document
    const scored = documents.map((doc) => {
        const docTokens = tokenize(doc.content);
        const docVector = computeTfidfVector(docTokens);
        return {
            id: doc.id,
            similarity: cosineSimilarity(queryVector, docVector),
        };
    });

    return scored
        .filter((s) => s.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
}
