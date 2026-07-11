export const workspaceApi = {
    getPath: () => window.electron.workspace.getPath(),
    pickExisting: () => window.electron.workspace.pickExisting(),
    createNew: () => window.electron.workspace.createNew(),
    clear: () => window.electron.workspace.clear(),
    listFiles: (workspacePath: string) =>
        window.electron.workspace.listFiles(workspacePath),
    revealFile: (filePath: string) =>
        window.electron.workspace.revealFile(filePath),
};
