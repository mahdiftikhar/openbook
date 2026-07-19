import { createGateway, embedMany } from "ai";

import type { IndexingErrorCode } from "../../shared/types";

export interface EmbeddingResult {
    model: string;
    dimensions: number;
    embeddings: number[][];
}

interface EmbeddingConfig {
    apiKey: string | undefined;
    baseUrl: string | undefined;
    model: string;
    teamIdOrSlug: string | undefined;
}

const DEFAULT_GATEWAY_EMBEDDING_MODEL = "voyage/voyage-4-lite";
const MAX_EMBEDDING_ATTEMPTS = 3;

export class EmbeddingProviderError extends Error {
    constructor(
        readonly code: IndexingErrorCode,
        message: string,
        readonly retryable: boolean,
    ) {
        super(message);
        this.name = "EmbeddingProviderError";
    }
}

function getEmbeddingConfig(): EmbeddingConfig {
    const apiKey =
        process.env.OPENBOOK_AI_GATEWAY_API_KEY?.trim() ||
        process.env.AI_GATEWAY_API_KEY?.trim() ||
        undefined;
    const model =
        process.env.OPENBOOK_EMBEDDING_MODEL?.trim() ||
        DEFAULT_GATEWAY_EMBEDDING_MODEL;
    const baseUrl =
        process.env.OPENBOOK_AI_GATEWAY_BASE_URL?.trim() || undefined;
    const teamIdOrSlug =
        process.env.OPENBOOK_AI_GATEWAY_TEAM_ID?.trim() || undefined;

    if (!apiKey) {
        throw new EmbeddingProviderError(
            "configuration",
            "OpenBook needs an AI Gateway API key before it can create the search index.",
            false,
        );
    }

    return { apiKey, baseUrl, model, teamIdOrSlug };
}

function createEmbeddingGateway(config: EmbeddingConfig) {
    return createGateway({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        teamIdOrSlug: config.teamIdOrSlug,
    });
}

function getStatusCode(error: unknown, depth = 0): number | null {
    if (depth > 3 || typeof error !== "object" || error === null) return null;

    const record = error as Record<string, unknown>;
    for (const key of ["status", "statusCode"]) {
        const value = record[key];
        if (typeof value === "number") return value;
    }

    return (
        getStatusCode(record.response, depth + 1) ??
        getStatusCode(record.cause, depth + 1)
    );
}

function isNetworkError(error: unknown, depth = 0): boolean {
    if (depth > 3) return false;
    const message = error instanceof Error ? error.message : String(error);
    if (
        /fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT|socket/i.test(message)
    ) {
        return true;
    }
    if (typeof error !== "object" || error === null) return false;
    return isNetworkError((error as Record<string, unknown>).cause, depth + 1);
}

function toEmbeddingProviderError(error: unknown): EmbeddingProviderError {
    if (error instanceof EmbeddingProviderError) return error;

    const statusCode = getStatusCode(error);
    if (statusCode === 401 || statusCode === 403) {
        return new EmbeddingProviderError(
            "authentication",
            "OpenBook could not authenticate with the configured AI Gateway key.",
            false,
        );
    }
    if (statusCode === 402) {
        return new EmbeddingProviderError(
            "quota",
            "Indexing is paused because the AI Gateway account has no available credits.",
            false,
        );
    }
    if (statusCode === 429) {
        return new EmbeddingProviderError(
            "rate_limit",
            "The embedding service is temporarily rate limited.",
            true,
        );
    }
    if (isNetworkError(error) || (statusCode !== null && statusCode >= 500)) {
        return new EmbeddingProviderError(
            "network",
            "OpenBook could not reach the embedding service.",
            true,
        );
    }

    return new EmbeddingProviderError(
        "provider",
        "The embedding service could not create an index for this document.",
        false,
    );
}

function waitForRetry(attempt: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, 500 * 2 ** (attempt - 1));
    });
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult> {
    const config = getEmbeddingConfig();
    if (texts.length === 0) {
        return { model: config.model, dimensions: 0, embeddings: [] };
    }

    const gateway = createEmbeddingGateway(config);
    let result: Awaited<ReturnType<typeof embedMany>> | null = null;

    for (let attempt = 1; attempt <= MAX_EMBEDDING_ATTEMPTS; attempt += 1) {
        try {
            result = await embedMany({
                model: gateway.embeddingModel(config.model),
                values: texts,
            });
            break;
        } catch (error) {
            const providerError = toEmbeddingProviderError(error);
            if (
                !providerError.retryable ||
                attempt === MAX_EMBEDDING_ATTEMPTS
            ) {
                throw providerError;
            }
            console.warn("[index] Embedding request failed; retrying", {
                attempt,
                error: providerError.message,
            });
            await waitForRetry(attempt);
        }
    }

    if (!result) {
        throw new EmbeddingProviderError(
            "provider",
            "The embedding service did not return a result.",
            false,
        );
    }

    const embeddings = result.embeddings.map((embedding) => [...embedding]);
    const dimensions = embeddings[0]?.length ?? 0;
    if (dimensions === 0) {
        throw new EmbeddingProviderError(
            "provider",
            "The embedding service returned an empty embedding.",
            false,
        );
    }

    if (embeddings.some((embedding) => embedding.length !== dimensions)) {
        throw new EmbeddingProviderError(
            "provider",
            "The embedding service returned inconsistent embeddings.",
            false,
        );
    }

    return {
        model: config.model,
        dimensions,
        embeddings,
    };
}
