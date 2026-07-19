export const notesApi = {
    create: (workspacePath: string) =>
        window.electron.notes.create(workspacePath),
    read: (filePath: string) => window.electron.notes.read(filePath),
    write: (workspacePath: string, filePath: string, content: string) =>
        window.electron.notes.write(workspacePath, filePath, content),
    rename: (workspacePath: string, oldPath: string, newBaseName: string) =>
        window.electron.notes.rename(workspacePath, oldPath, newBaseName),
    delete: (workspacePath: string, filePath: string) =>
        window.electron.notes.delete(workspacePath, filePath),
};
