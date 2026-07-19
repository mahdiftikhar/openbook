export interface FileNode {
    name: string;
    type: "file" | "folder";
    path: string;
    children?: FileNode[];
}

export interface SourceEntry {
    fileName: string;
    fileType: "pdf";
    status: "ready" | "error";
    addedAt: string;
    totalPages: number;
    error?: string;
}

export type IndexingErrorCode =
    | "authentication"
    | "configuration"
    | "network"
    | "quota"
    | "rate_limit"
    | "provider"
    | "database"
    | "content";

export interface IndexingIssue {
    code: IndexingErrorCode;
    message: string;
    retryable: boolean;
}

export interface IndexReconciliationResult {
    status: "complete" | "partial" | "blocked";
    indexed: number;
    updated: number;
    removed: number;
    unchanged: number;
    failed: number;
    issue?: IndexingIssue;
}

export interface ChatHistoryMessage {
    role: "user" | "assistant";
    content: string;
}

export interface TextExcerpt {
    text: string;
    filePath: string;
    page: number;
}

export interface ChatRequest {
    requestId: string;
    workspacePath: string;
    question: string;
    sourceFileNames: string[];
    contextTexts: TextExcerpt[];
    history: ChatHistoryMessage[];
}

export interface ChatCitation {
    id: number;
    fileName: string;
    filePath: string;
    page: number;
    excerpt: string;
}

export type ChatStreamEvent =
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

export interface ElectronApi {
    platform: string;
    workspace: {
        getPath: () => Promise<string | null>;
        pickExisting: () => Promise<string | null>;
        createNew: () => Promise<string | null>;
        clear: () => Promise<void>;
        listFiles: (workspacePath: string) => Promise<FileNode[]>;
        revealFile: (filePath: string) => Promise<void>;
        reconcileIndex: (
            workspacePath: string,
        ) => Promise<IndexReconciliationResult>;
    };
    notes: {
        create: (workspacePath: string) => Promise<string>;
        read: (filePath: string) => Promise<string | null>;
        write: (
            workspacePath: string,
            filePath: string,
            content: string,
        ) => Promise<boolean>;
        rename: (
            workspacePath: string,
            oldPath: string,
            newBaseName: string,
        ) => Promise<string | null>;
        delete: (workspacePath: string, filePath: string) => Promise<boolean>;
    };
    sources: {
        list: (workspacePath: string) => Promise<SourceEntry[]>;
        addPdf: (workspacePath: string) => Promise<SourceEntry | null>;
        remove: (workspacePath: string, fileName: string) => Promise<boolean>;
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
        onStream: (callback: (event: ChatStreamEvent) => void) => () => void;
    };
}
