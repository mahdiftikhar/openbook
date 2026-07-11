import type { ChatCitation, ChatRequest } from "../shared/types";

export interface AgentRunResult {
    content: string;
    citations: ChatCitation[];
    source: "model" | "local";
}

export interface ResearchAgentRunOptions {
    request: ChatRequest;
    abortSignal: AbortSignal;
    isActive?: () => boolean;
    onStart?: (citations: ChatCitation[]) => void;
    onDelta?: (text: string) => void;
}
