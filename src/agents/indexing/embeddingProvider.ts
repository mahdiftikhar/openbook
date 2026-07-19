import { createGateway, embedMany } from "ai";

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
        throw new Error(
            "Embedding provider is not configured. Set OPENBOOK_AI_GATEWAY_API_KEY or AI_GATEWAY_API_KEY.",
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

export async function embedTexts(texts: string[]): Promise<EmbeddingResult> {
    const config = getEmbeddingConfig();
    if (texts.length === 0) {
        return { model: config.model, dimensions: 0, embeddings: [] };
    }

    const gateway = createEmbeddingGateway(config);
    const result = await embedMany({
        model: gateway.embeddingModel(config.model),
        values: texts,
    });

    const embeddings = result.embeddings.map((embedding) => [...embedding]);
    const dimensions = embeddings[0]?.length ?? 0;
    if (dimensions === 0) {
        throw new Error("Embedding provider returned an empty embedding.");
    }

    if (embeddings.some((embedding) => embedding.length !== dimensions)) {
        throw new Error("Embedding provider returned inconsistent dimensions.");
    }

    return {
        model: config.model,
        dimensions,
        embeddings,
    };
}
