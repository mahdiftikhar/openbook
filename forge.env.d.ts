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

interface ChatHistoryMessage {
    role: "user" | "assistant";
    content: string;
}

interface TextExcerpt {
    text: string;
    filePath: string;
    page: number;
}

interface ChatRequest {
    requestId: string;
    workspacePath: string;
    question: string;
    sourceFileNames: string[];
    contextTexts: TextExcerpt[];
    history: ChatHistoryMessage[];
}

interface ChatCitation {
    id: number;
    fileName: string;
    filePath: string;
    page: number;
    excerpt: string;
}

type ChatStreamEvent =
    | {
          type: "start";
          requestId: string;
          citations: ChatCitation[];
      }
    | {
          type: "delta";
          requestId: string;
          text: string;
      }
    | {
          type: "done";
          requestId: string;
          content: string;
      }
    | {
          type: "error";
          requestId: string;
          error: string;
      };

interface Window {
    electron: {
        platform: string;
        workspace: {
            getPath: () => Promise<string | null>;
            pickExisting: () => Promise<string | null>;
            createNew: () => Promise<string | null>;
            clear: () => Promise<void>;
            listFiles: (workspacePath: string) => Promise<FileNode[]>;
            revealFile: (filePath: string) => Promise<void>;
        };
        notes: {
            create: (workspacePath: string) => Promise<string>;
            read: (filePath: string) => Promise<string | null>;
            write: (filePath: string, content: string) => Promise<boolean>;
            rename: (
                oldPath: string,
                newBaseName: string,
            ) => Promise<string | null>;
            delete: (filePath: string) => Promise<boolean>;
        };
        sources: {
            list: (workspacePath: string) => Promise<SourceEntry[]>;
            addPdf: (workspacePath: string) => Promise<SourceEntry | null>;
            remove: (
                workspacePath: string,
                fileName: string,
            ) => Promise<boolean>;
            rename: (
                workspacePath: string,
                oldFileName: string,
                newBaseName: string,
            ) => Promise<SourceEntry | null>;
            open: (filePath: string) => Promise<void>;
            readFile: (filePath: string) => Promise<ArrayBuffer | null>;
        };
        chat: {
            ask: (request: ChatRequest) => void;
            cancel: (requestId: string) => void;
            onStream: (
                callback: (event: ChatStreamEvent) => void,
            ) => () => void;
        };
    };
}
