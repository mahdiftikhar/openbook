import { dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import fs from "node:fs";

import { IPC_CHANNELS } from "../../shared/ipcChannels";
import { REQUIRED_WORKSPACE_DIRS } from "../../workspaceLayout";
import {
    clearSavedWorkspacePath,
    createWorkspaceStructure,
    getSavedWorkspacePath,
    listWorkspaceFiles,
    saveWorkspacePath,
    validateWorkspace,
} from "../services/workspaceService";

function handleGetWorkspacePath(): string | null {
    return getSavedWorkspacePath();
}

async function handlePickExistingWorkspace(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        title: "Select an existing openbook project",
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const projectPath = result.filePaths[0];
    if (!validateWorkspace(projectPath)) {
        await dialog.showMessageBox({
            type: "error",
            title: "Invalid project",
            message:
                "The selected folder does not follow the openbook project structure.",
            detail: `A valid project must contain:\n${REQUIRED_WORKSPACE_DIRS.map((d) => `  ${d}/`).join("\n")}`,
        });
        return null;
    }

    saveWorkspacePath(projectPath);
    return projectPath;
}

function handleListWorkspaceFiles(
    _event: IpcMainInvokeEvent,
    workspacePath: string,
) {
    return listWorkspaceFiles(workspacePath);
}

function handleRevealWorkspaceFile(
    _event: IpcMainInvokeEvent,
    filePath: string,
): void {
    if (fs.existsSync(filePath)) shell.showItemInFolder(filePath);
}

function handleClearWorkspacePath(): void {
    clearSavedWorkspacePath();
}

async function handleCreateNewWorkspace(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory", "createDirectory"],
        title: "Select a location for your new openbook project",
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const projectPath = result.filePaths[0];
    createWorkspaceStructure(projectPath);
    saveWorkspacePath(projectPath);
    return projectPath;
}

export function registerWorkspaceHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.workspace.getPath, handleGetWorkspacePath);
    ipcMain.handle(
        IPC_CHANNELS.workspace.pickExisting,
        handlePickExistingWorkspace,
    );
    ipcMain.handle(IPC_CHANNELS.workspace.listFiles, handleListWorkspaceFiles);
    ipcMain.handle(
        IPC_CHANNELS.workspace.revealFile,
        handleRevealWorkspaceFile,
    );
    ipcMain.handle(IPC_CHANNELS.workspace.clear, handleClearWorkspacePath);
    ipcMain.handle(IPC_CHANNELS.workspace.createNew, handleCreateNewWorkspace);
}
