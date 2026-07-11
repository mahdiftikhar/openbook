import {
    BrowserWindow,
    dialog,
    ipcMain,
    shell,
    type IpcMainInvokeEvent,
} from "electron";
import fs from "node:fs";

import { IPC_CHANNELS } from "../../shared/ipcChannels";
import {
    addPdfSource,
    listSources,
    readSourceFile,
    removeSource,
    renameSource,
} from "../services/sourceService";

function handleListSources(
    _event: IpcMainInvokeEvent,
    workspacePath: string,
) {
    return listSources(workspacePath);
}

function handleReadSourceFile(
    _event: IpcMainInvokeEvent,
    filePath: string,
): ArrayBuffer | null {
    return readSourceFile(filePath);
}

async function handleOpenSourceFile(
    _event: IpcMainInvokeEvent,
    filePath: string,
): Promise<void> {
    if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
    }
}

async function handleAddPdfSource(
    _event: IpcMainInvokeEvent,
    workspacePath: string,
) {
    const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "PDF Files", extensions: ["pdf"] }],
        title: "Add PDF source",
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    return addPdfSource(workspacePath, result.filePaths[0]);
}

async function handleRemoveSource(
    _event: IpcMainInvokeEvent,
    workspacePath: string,
    fileName: string,
): Promise<boolean> {
    const choice = await dialog.showMessageBox(
        BrowserWindow.getFocusedWindow() ?? undefined,
        {
            type: "warning",
            buttons: ["Delete", "Cancel"],
            defaultId: 1,
            title: "Delete source",
            message: `Delete "${fileName}"?`,
            detail: "This cannot be undone.",
        },
    );
    if (choice.response !== 0) return false;
    return removeSource(workspacePath, fileName);
}

function handleRenameSource(
    _event: IpcMainInvokeEvent,
    workspacePath: string,
    oldFileName: string,
    newBaseName: string,
) {
    return renameSource(workspacePath, oldFileName, newBaseName);
}

export function registerSourceHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.sources.list, handleListSources);
    ipcMain.handle(IPC_CHANNELS.sources.readFile, handleReadSourceFile);
    ipcMain.handle(IPC_CHANNELS.sources.open, handleOpenSourceFile);
    ipcMain.handle(IPC_CHANNELS.sources.addPdf, handleAddPdfSource);
    ipcMain.handle(IPC_CHANNELS.sources.remove, handleRemoveSource);
    ipcMain.handle(IPC_CHANNELS.sources.rename, handleRenameSource);
}
