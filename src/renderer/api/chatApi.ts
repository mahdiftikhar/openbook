import type { ChatRequest, ChatStreamEvent } from "../../shared/types";

export const chatApi = {
    ask: (request: ChatRequest) => window.electron.chat.ask(request),
    cancel: (requestId: string) => window.electron.chat.cancel(requestId),
    onStream: (callback: (event: ChatStreamEvent) => void) =>
        window.electron.chat.onStream(callback),
};
