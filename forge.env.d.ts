/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
}

interface SourceEntry {
  fileName: string;
  fileType: "pdf";
  status: "ready" | "error";
  addedAt: string;
  totalPages: number;
  error?: string;
}

interface Window {
  electron: {
    platform: string;
    workspace: {
      getPath: () => Promise<string | null>;
      pickExisting: () => Promise<string | null>;
      createNew: () => Promise<string | null>;
      clear: () => Promise<void>;
      listFiles: (workspacePath: string) => Promise<FileNode[]>;
    };
    notes: {
      create: (workspacePath: string) => Promise<string>;
      read: (filePath: string) => Promise<string | null>;
      write: (filePath: string, content: string) => Promise<boolean>;
      rename: (oldPath: string, newBaseName: string) => Promise<string | null>;
      delete: (filePath: string) => Promise<boolean>;
    };
    sources: {
      list: (workspacePath: string) => Promise<SourceEntry[]>;
      addPdf: (workspacePath: string) => Promise<SourceEntry | null>;
      remove: (workspacePath: string, fileName: string) => Promise<boolean>;
      open: (filePath: string) => Promise<void>;
      readFile: (filePath: string) => Promise<ArrayBuffer | null>;
    };
  };
}
