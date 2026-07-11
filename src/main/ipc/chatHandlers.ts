import { ipcMain, type IpcMainEvent, type WebContents } from "electron";

import { runResearchAgent } from "../../agents";
import { IPC_CHANNELS } from "../../shared/ipcChannels";
import type { ChatRequest, ChatStreamEvent } from "../../shared/types";

const activeRequests = new Set<string>();
const activeAbortControllers = new Map<string, AbortController>();

function sendStreamEvent(sender: WebContents, event: ChatStreamEvent): void {
    if (!sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.chat.stream, event);
    }
}

async function runChatRequest(
    sender: WebContents,
    request: ChatRequest,
    abortController: AbortController,
): Promise<void> {
    try {
        const result = await runResearchAgent({
            request,
            abortSignal: abortController.signal,
            isActive: () => activeRequests.has(request.requestId),
            onStart: (citations) => {
                sendStreamEvent(sender, {
                    type: "start",
                    requestId: request.requestId,
                    citations,
                });
            },
            onDelta: (text) => {
                sendStreamEvent(sender, {
                    type: "delta",
                    requestId: request.requestId,
                    text,
                });
            },
        });
        if (!result) return;

        sendStreamEvent(sender, {
            type: "done",
            requestId: request.requestId,
            content: result.content,
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
}

function handleAskChat(event: IpcMainEvent, request: ChatRequest): void {
    const sender = event.sender;
    const abortController = new AbortController();
    activeRequests.add(request.requestId);
    activeAbortControllers.set(request.requestId, abortController);

    void runChatRequest(sender, request, abortController);
}

function handleCancelChat(_event: IpcMainEvent, requestId: string): void {
    activeRequests.delete(requestId);
    activeAbortControllers.get(requestId)?.abort();
    activeAbortControllers.delete(requestId);
}

export function registerChatHandlers(): void {
    ipcMain.on(IPC_CHANNELS.chat.ask, handleAskChat);
    ipcMain.on(IPC_CHANNELS.chat.cancel, handleCancelChat);
}
