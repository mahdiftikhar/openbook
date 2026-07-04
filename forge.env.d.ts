/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
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
  };
}
