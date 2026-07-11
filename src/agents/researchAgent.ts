import {
    buildLocalResponse,
    streamDeepSeekCompletion,
} from "./providers/deepseekProvider";
import { createChatContext } from "./retrieval/sourceRetrieval";
import type { AgentRunResult, ResearchAgentRunOptions } from "./types";

const STREAM_DELAY_MS = 18;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function streamLocalContent({
    content,
    isActive,
    onDelta,
}: {
    content: string;
    isActive: () => boolean;
    onDelta?: (text: string) => void;
}): Promise<boolean> {
    const tokens = content.match(/\S+\s*/g) ?? [content];

    for (const token of tokens) {
        if (!isActive()) return false;
        onDelta?.(token);
        await delay(STREAM_DELAY_MS);
    }

    return true;
}

export async function runResearchAgent({
    request,
    abortSignal,
    isActive = () => true,
    onStart,
    onDelta,
}: ResearchAgentRunOptions): Promise<AgentRunResult | null> {
    const context = await createChatContext(request);
    if (!isActive()) return null;

    onStart?.(context.citations);

    const aiContent = await streamDeepSeekCompletion({
        request,
        context,
        abortSignal,
        isActive,
        onDelta: (text) => onDelta?.(text),
    });

    if (aiContent) {
        return {
            content: aiContent,
            citations: context.citations,
            source: "model",
        };
    }

    const localContent = buildLocalResponse(
        request.question,
        context.citations,
    );
    const completed = await streamLocalContent({
        content: localContent,
        isActive,
        onDelta,
    });
    if (!completed) return null;

    return {
        content: localContent,
        citations: context.citations,
        source: "local",
    };
}
