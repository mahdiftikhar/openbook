import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";

import type { ChatCitation, ChatRequest } from "../../shared/types";
import {
    normalizeChatContextText,
    type ChatContext,
    type RetrievedSource,
} from "../retrieval/sourceRetrieval";

const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

function summarizeExcerpt(excerpt: string): string {
    if (excerpt.length <= 260) return excerpt;
    return `${excerpt.slice(0, 257).trim()}...`;
}

export function buildLocalResponse(
    question: string,
    citations: ChatCitation[],
): string {
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
            return `[${citation.id}] ${citation.fileName}, page ${citation.page}\n${normalizeChatContextText(source.text)}`;
        })
        .join("\n\n");
}


// API keys picked from .env file
// Later we'll have some UI to configure API keys and select providers
// in which case API keys will be stored in .openbook folder? (or somewhere safe)
function getDeepSeekApiKey(): string | null {
    return process.env.DEEPSEEK_API_KEY?.trim() || null;
}

// Model picked from .env file
// Later we'll have some UI to configure API keys and select providers
// in which case API keys will be stored in .openbook folder? (or somewhere safe)
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

export async function streamDeepSeekCompletion({
    request,
    context,
    abortSignal,
    isActive,
    onDelta,
}: {
    request: ChatRequest;
    context: ChatContext;
    abortSignal: AbortSignal;
    isActive: () => boolean;
    onDelta: (text: string) => void;
}): Promise<string | null> {
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
        if (!isActive()) return null;
        content += text;
        onDelta(text);
    }

    return content;
}
