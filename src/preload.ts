import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  workspace: {
    getPath: () => ipcRenderer.invoke("workspace:get-path"),
    pickExisting: () => ipcRenderer.invoke("workspace:pick-existing"),
    createNew: () => ipcRenderer.invoke("workspace:create-new"),
    clear: () => ipcRenderer.invoke("workspace:clear"),
    listFiles: (workspacePath: string) =>
      ipcRenderer.invoke("workspace:list-files", workspacePath),
  },
  notes: {
    create: (workspacePath: string) =>
      ipcRenderer.invoke("notes:create", workspacePath),
    read: (filePath: string) => ipcRenderer.invoke("notes:read", filePath),
    write: (filePath: string, content: string) =>
      ipcRenderer.invoke("notes:write", filePath, content),
    rename: (oldPath: string, newBaseName: string) =>
      ipcRenderer.invoke("notes:rename", oldPath, newBaseName),
    delete: (filePath: string) => ipcRenderer.invoke("notes:delete", filePath),
  },
  sources: {
    list: (workspacePath: string) =>
      ipcRenderer.invoke("sources:list", workspacePath),
    addPdf: (workspacePath: string) =>
      ipcRenderer.invoke("sources:add-pdf", workspacePath),
    remove: (workspacePath: string, fileName: string) =>
      ipcRenderer.invoke("sources:remove", workspacePath, fileName),
    open: (filePath: string) =>
      ipcRenderer.invoke("sources:open", filePath),
    readFile: (filePath: string) =>
      ipcRenderer.invoke("sources:read-file", filePath),
  },
});
