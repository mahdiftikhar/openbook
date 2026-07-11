export const notesApi = {
    create: (workspacePath: string) => window.electron.notes.create(workspacePath),
    read: (filePath: string) => window.electron.notes.read(filePath),
    write: (filePath: string, content: string) =>
        window.electron.notes.write(filePath, content),
    rename: (oldPath: string, newBaseName: string) =>
        window.electron.notes.rename(oldPath, newBaseName),
    delete: (filePath: string) => window.electron.notes.delete(filePath),
};
