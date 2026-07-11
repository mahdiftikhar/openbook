import { ipcMain, type IpcMainEvent, type WebContents } from "electron";

import { IPC_CHANNELS } from "../../shared/ipcChannels";
import type { ChatRequest, ChatStreamEvent } from "../../shared/types";
import {
    buildLocalResponse,
    streamDeepSeekAnswer,
} from "../services/chatProviderService";
import { createChatContext } from "../services/chatRetrievalService";

const STREAM_DELAY_MS = 18;

const activeRequests = new Set<string>();
const activeAbortControllers = new Map<string, AbortController>();

function sendStreamEvent(sender: WebContents, event: ChatStreamEvent): void {
    if (!sender.isDestroyed()) {
        sender.send(IPC_CHANNELS.chat.stream, event);
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function streamContent(
    sender: WebContents,
    requestId: string,
    content: string,
): Promise<boolean> {
    const tokens = content.match(/\S+\s*/g) ?? [content];

    for (const token of tokens) {
        if (!activeRequests.has(requestId)) return false;
        sendStreamEvent(sender, {
            type: "delta",
            requestId,
            text: token,
        });
        await delay(STREAM_DELAY_MS);
    }

    return true;
}

async function runChatRequest(
    sender: WebContents,
    request: ChatRequest,
    abortController: AbortController,
): Promise<void> {
    try {
        const context = await createChatContext(request);
        if (!activeRequests.has(request.requestId)) return;

        sendStreamEvent(sender, {
            type: "start",
            requestId: request.requestId,
            citations: context.citations,
        });

        const aiContent = await streamDeepSeekAnswer({
            request,
            context,
            abortSignal: abortController.signal,
            isActive: () => activeRequests.has(request.requestId),
            onDelta: (text) => {
                sendStreamEvent(sender, {
                    type: "delta",
                    requestId: request.requestId,
                    text,
                });
            },
        });
        let content = aiContent;

        if (!content) {
            content = buildLocalResponse(request.question, context.citations);
            const completed = await streamContent(
                sender,
                request.requestId,
                content,
            );
            if (!completed) return;
        }

        sendStreamEvent(sender, {
            type: "done",
            requestId: request.requestId,
            content,
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
