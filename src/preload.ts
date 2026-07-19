import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IPC_CHANNELS } from "./shared/ipcChannels";
import type { ChatRequest, ChatStreamEvent } from "./shared/types";

contextBridge.exposeInMainWorld("electron", {
    platform: process.platform,
    workspace: {
        getPath: () => ipcRenderer.invoke(IPC_CHANNELS.workspace.getPath),
        pickExisting: () =>
            ipcRenderer.invoke(IPC_CHANNELS.workspace.pickExisting),
        createNew: () => ipcRenderer.invoke(IPC_CHANNELS.workspace.createNew),
        clear: () => ipcRenderer.invoke(IPC_CHANNELS.workspace.clear),
        listFiles: (workspacePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.workspace.listFiles, workspacePath),
        revealFile: (filePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.workspace.revealFile, filePath),
        reconcileIndex: (workspacePath: string) =>
            ipcRenderer.invoke(
                IPC_CHANNELS.workspace.reconcileIndex,
                workspacePath,
            ),
    },
    notes: {
        create: (workspacePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.notes.create, workspacePath),
        read: (filePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.notes.read, filePath),
        write: (workspacePath: string, filePath: string, content: string) =>
            ipcRenderer.invoke(
                IPC_CHANNELS.notes.write,
                workspacePath,
                filePath,
                content,
            ),
        rename: (workspacePath: string, oldPath: string, newBaseName: string) =>
            ipcRenderer.invoke(
                IPC_CHANNELS.notes.rename,
                workspacePath,
                oldPath,
                newBaseName,
            ),
        delete: (workspacePath: string, filePath: string) =>
            ipcRenderer.invoke(
                IPC_CHANNELS.notes.delete,
                workspacePath,
                filePath,
            ),
    },
    sources: {
        list: (workspacePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.sources.list, workspacePath),
        addPdf: (workspacePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.sources.addPdf, workspacePath),
        remove: (workspacePath: string, fileName: string) =>
            ipcRenderer.invoke(
                IPC_CHANNELS.sources.remove,
                workspacePath,
                fileName,
            ),
        rename: (
            workspacePath: string,
            oldFileName: string,
            newBaseName: string,
        ) =>
            ipcRenderer.invoke(
                IPC_CHANNELS.sources.rename,
                workspacePath,
                oldFileName,
                newBaseName,
            ),
        open: (filePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.sources.open, filePath),
        readFile: (filePath: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.sources.readFile, filePath),
    },
    chat: {
        ask: (request: ChatRequest) =>
            ipcRenderer.send(IPC_CHANNELS.chat.ask, request),
        cancel: (requestId: string) =>
            ipcRenderer.send(IPC_CHANNELS.chat.cancel, requestId),
        onStream: (callback: (event: ChatStreamEvent) => void) => {
            const listener = (
                _event: IpcRendererEvent,
                payload: ChatStreamEvent,
            ) => callback(payload);
            ipcRenderer.on(IPC_CHANNELS.chat.stream, listener);
            return () =>
                ipcRenderer.removeListener(IPC_CHANNELS.chat.stream, listener);
        },
    },
});
