import {
    BrowserWindow,
    dialog,
    ipcMain,
    type IpcMainInvokeEvent,
} from "electron";
import path from "node:path";

import { IPC_CHANNELS } from "../../shared/ipcChannels";
import {
    createNote,
    deleteNote,
    readNote,
    renameNote,
    writeNote,
} from "../services/noteService";

function handleCreateNote(
    _event: IpcMainInvokeEvent,
    workspacePath: string,
): string {
    return createNote(workspacePath);
}

function handleReadNote(
    _event: IpcMainInvokeEvent,
    filePath: string,
): string | null {
    return readNote(filePath);
}

function handleWriteNote(
    _event: IpcMainInvokeEvent,
    filePath: string,
    content: string,
): boolean {
    return writeNote(filePath, content);
}

function handleRenameNote(
    _event: IpcMainInvokeEvent,
    oldPath: string,
    newBaseName: string,
): string | null {
    return renameNote(oldPath, newBaseName);
}

async function handleDeleteNote(
    _event: IpcMainInvokeEvent,
    filePath: string,
): Promise<boolean> {
    const baseName = path.basename(filePath);
    const choice = await dialog.showMessageBox(
        BrowserWindow.getFocusedWindow() ?? undefined,
        {
            type: "warning",
            buttons: ["Delete", "Cancel"],
            defaultId: 1,
            title: "Delete note",
            message: `Delete "${baseName}"?`,
            detail: "This cannot be undone.",
        },
    );
    if (choice.response !== 0) return false;
    return deleteNote(filePath);
}

export function registerNoteHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.notes.create, handleCreateNote);
    ipcMain.handle(IPC_CHANNELS.notes.read, handleReadNote);
    ipcMain.handle(IPC_CHANNELS.notes.write, handleWriteNote);
    ipcMain.handle(IPC_CHANNELS.notes.rename, handleRenameNote);
    ipcMain.handle(IPC_CHANNELS.notes.delete, handleDeleteNote);
}
