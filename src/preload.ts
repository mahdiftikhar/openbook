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
});
