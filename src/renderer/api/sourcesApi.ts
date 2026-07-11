export const sourcesApi = {
    list: (workspacePath: string) =>
        window.electron.sources.list(workspacePath),
    addPdf: (workspacePath: string) =>
        window.electron.sources.addPdf(workspacePath),
    remove: (workspacePath: string, fileName: string) =>
        window.electron.sources.remove(workspacePath, fileName),
    rename: (workspacePath: string, oldFileName: string, newBaseName: string) =>
        window.electron.sources.rename(workspacePath, oldFileName, newBaseName),
    open: (filePath: string) => window.electron.sources.open(filePath),
    readFile: (filePath: string) => window.electron.sources.readFile(filePath),
};
