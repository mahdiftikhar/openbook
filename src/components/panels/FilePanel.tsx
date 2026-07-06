import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type MouseEvent as ReactMouseEvent,
    type SetStateAction,
} from "react";
import {
    FilePlus2,
    File as FileIcon,
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Search,
    Hash,
    FileText,
    Plus,
    Check,
    AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileContextMenuState = {
    node: FileNode;
    x: number;
    y: number;
};

export function FilePanel({
    workspacePath,
    workspaceName,
    activeNotePath,
    selectedSourceNames,
    refreshKey,
    onOpenNote,
    onSelectedSourceNamesChange,
    onNotesChanged,
}: {
    workspacePath: string;
    workspaceName: string;
    activeNotePath: string | null;
    selectedSourceNames: string[];
    refreshKey: number;
    onOpenNote: (path: string | null) => void;
    onSelectedSourceNamesChange: Dispatch<SetStateAction<string[]>>;
    onNotesChanged: () => void;
}) {
    const [tree, setTree] = useState<FileNode[]>([]);
    const [sourceEntries, setSourceEntries] = useState<SourceEntry[]>([]);
    const [localVersion, setLocalVersion] = useState(0);
    const [contextMenu, setContextMenu] = useState<FileContextMenuState | null>(
        null,
    );

    useEffect(() => {
        window.electron.workspace.listFiles(workspacePath).then(setTree);
        window.electron.sources.list(workspacePath).then(setSourceEntries);
    }, [workspacePath, refreshKey, localVersion]);

    const sourceMap = useMemo(() => {
        const map: Record<string, SourceEntry> = {};
        for (const entry of sourceEntries) {
            map[entry.fileName] = entry;
        }
        return map;
    }, [sourceEntries]);

    const getSourceEntry = useCallback(
        (fileName: string) => {
            return sourceMap[fileName];
        },
        [sourceMap],
    );

    const handleSelect = useCallback(
        (filePath: string) => {
            onOpenNote(filePath);
        },
        [onOpenNote],
    );

    const handleNew = async () => {
        const filePath = await window.electron.notes.create(workspacePath);
        onOpenNote(filePath);
        onNotesChanged();
    };

    const handleAddPdf = async () => {
        const entry = await window.electron.sources.addPdf(workspacePath);
        if (entry) {
            setLocalVersion((v) => v + 1);
            onNotesChanged();
        }
    };

    const activeFileName = activeNotePath?.split(/[/\\]/).pop() ?? null;

    const removeSourceFromContext = (fileName: string) => {
        onSelectedSourceNamesChange((current) =>
            current.filter((selectedName) => selectedName !== fileName),
        );
    };

    const handleDeleteSource = async (fileName: string) => {
        await window.electron.sources.remove(workspacePath, fileName);
        removeSourceFromContext(fileName);
        if (activeFileName === fileName) onOpenNote(null);
        setLocalVersion((v) => v + 1);
        onNotesChanged();
    };

    const handleDeleteFile = async (node: FileNode) => {
        const sourceEntry = sourceMap[node.name];
        if (sourceEntry) {
            await handleDeleteSource(node.name);
            return;
        }

        const ok = await window.electron.notes.delete(node.path);
        if (!ok) return;
        if (activeNotePath === node.path) onOpenNote(null);
        setLocalVersion((v) => v + 1);
        onNotesChanged();
    };

    const handleRenameFile = async (node: FileNode) => {
        const baseName = node.name.replace(/\.[^.]+$/, "");
        const nextBaseName = window.prompt("Rename", baseName)?.trim();
        if (!nextBaseName) return;

        const sourceEntry = sourceMap[node.name];
        if (sourceEntry) {
            const renamed = await window.electron.sources.rename(
                workspacePath,
                node.name,
                nextBaseName,
            );
            if (!renamed) return;

            const renamedPath = node.path.endsWith(node.name)
                ? `${node.path.slice(0, -node.name.length)}${renamed.fileName}`
                : node.path;
            onSelectedSourceNamesChange((current) =>
                current.map((fileName) =>
                    fileName === node.name ? renamed.fileName : fileName,
                ),
            );
            if (activeNotePath === node.path) onOpenNote(renamedPath);
            setLocalVersion((v) => v + 1);
            onNotesChanged();
            return;
        }

        const renamedPath = await window.electron.notes.rename(
            node.path,
            nextBaseName,
        );
        if (!renamedPath) return;
        if (activeNotePath === node.path) onOpenNote(renamedPath);
        setLocalVersion((v) => v + 1);
        onNotesChanged();
    };

    const handleCopyPath = async (node: FileNode) => {
        await navigator.clipboard.writeText(node.path);
    };

    const handleRevealFile = async (node: FileNode) => {
        await window.electron.workspace.revealFile(node.path);
    };

    const handleToggleSourceContext = (fileName: string) => {
        if (sourceMap[fileName]?.status !== "ready") return;
        onSelectedSourceNamesChange((current) => {
            if (current.includes(fileName)) {
                return current.filter((selectedName) => selectedName !== fileName);
            }
            return [...current, fileName];
        });
    };

    const handleFileContextMenu = (
        event: ReactMouseEvent,
        node: FileNode,
    ) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ node, x: event.clientX, y: event.clientY });
    };

    useEffect(() => {
        if (!contextMenu) return;

        const close = () => setContextMenu(null);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") close();
        };

        window.addEventListener("click", close);
        window.addEventListener("contextmenu", close);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("click", close);
            window.removeEventListener("contextmenu", close);
            window.removeEventListener("resize", close);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [contextMenu]);

    const contextSourceEntry = contextMenu
        ? sourceMap[contextMenu.node.name]
        : undefined;
    const contextInChat = contextMenu
        ? selectedSourceNames.includes(contextMenu.node.name)
        : false;

    return (
        <aside className="flex h-full flex-col bg-surface-files">
            <FilePanelHeader onAddPdf={handleAddPdf} onNewNote={handleNew} />
            <FileSearchInput />
            <FileTree
                workspaceName={workspaceName}
                tree={tree}
                activeNotePath={activeNotePath}
                onSelect={handleSelect}
                getSourceEntry={getSourceEntry}
                onFileContextMenu={handleFileContextMenu}
            />
            {contextMenu ? (
                <FileContextMenu
                    node={contextMenu.node}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    sourceEntry={contextSourceEntry}
                    inChatContext={contextInChat}
                    onOpen={() => onOpenNote(contextMenu.node.path)}
                    onRename={() => handleRenameFile(contextMenu.node)}
                    onReveal={() => handleRevealFile(contextMenu.node)}
                    onCopyPath={() => handleCopyPath(contextMenu.node)}
                    onToggleChatContext={() =>
                        handleToggleSourceContext(contextMenu.node.name)
                    }
                    onDelete={() => handleDeleteFile(contextMenu.node)}
                    onClose={() => setContextMenu(null)}
                />
            ) : null}
        </aside>
    );
}

function FolderRow({
    name,
    depth,
    open,
    onToggle,
}: {
    name: string;
    depth: number;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-sm hover:bg-accent"
            style={{ paddingLeft: depth * 12 + 4 }}
        >
            {open ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            {open ? (
                <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
            ) : (
                <Folder className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{name}</span>
        </button>
    );
}

function FileRowButton({
    name,
    depth,
    isSource,
    onSelect,
}: {
    name: string;
    depth: number;
    isSource: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            onClick={onSelect}
            className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-sm"
            style={{ paddingLeft: depth * 12 + 14 }}
        >
            {isSource ? (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            ) : name.endsWith(".md") ? (
                <Hash className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
                <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{name}</span>
        </button>
    );
}

function TreeItem({
    node,
    depth,
    selectedPath,
    onSelect,
    getSourceEntry,
    onFileContextMenu,
}: {
    node: FileNode;
    depth: number;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    getSourceEntry?: (fileName: string) => SourceEntry | undefined;
    onFileContextMenu: (event: ReactMouseEvent, node: FileNode) => void;
}) {
    const [open, setOpen] = useState(depth === 0);

    if (node.type === "folder") {
        return (
            <div>
                <FolderRow
                    name={node.name}
                    depth={depth}
                    open={open}
                    onToggle={() => setOpen((v) => !v)}
                />
                {open &&
                    node.children?.map((child) => (
                        <TreeItem
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            getSourceEntry={getSourceEntry}
                            onFileContextMenu={onFileContextMenu}
                        />
                    ))}
            </div>
        );
    }

    const isActive = node.path === selectedPath;
    const sourceEntry = getSourceEntry?.(node.name);
    const isSource = sourceEntry !== undefined;

    return (
        <div
            className={cn(
                "group flex items-center rounded px-1.5 py-1 hover:bg-accent",
                isActive && "bg-accent font-medium",
            )}
            onContextMenu={(event) => onFileContextMenu(event, node)}
        >
            <FileRowButton
                name={node.name}
                depth={depth}
                isSource={isSource}
                onSelect={() => onSelect(node.path)}
            />
            {isSource && sourceEntry.status === "ready" && (
                <Check className="size-3 shrink-0 text-green-500" />
            )}
            {isSource && sourceEntry.status === "error" && (
                <AlertCircle
                    className="size-3 shrink-0 text-destructive"
                    aria-label={sourceEntry.error ?? "Error"}
                />
            )}
        </div>
    );
}

function FilePanelHeader({
    onAddPdf,
    onNewNote,
}: {
    onAddPdf: () => void;
    onNewNote: () => void;
}) {
    return (
        <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70">
                Project Files
            </h2>
            <div className="flex items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Add PDF source"
                    onClick={onAddPdf}
                >
                    <Plus className="size-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="New note"
                    onClick={onNewNote}
                >
                    <FilePlus2 className="size-3.5" />
                </Button>
            </div>
        </div>
    );
}

function FileSearchInput() {
    return (
        <div className="px-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-accent/60 px-2">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                    placeholder="Search files..."
                    className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
            </div>
        </div>
    );
}

function FileContextMenu({
    node,
    x,
    y,
    sourceEntry,
    inChatContext,
    onOpen,
    onRename,
    onReveal,
    onCopyPath,
    onToggleChatContext,
    onDelete,
    onClose,
}: {
    node: FileNode;
    x: number;
    y: number;
    sourceEntry: SourceEntry | undefined;
    inChatContext: boolean;
    onOpen: () => void;
    onRename: () => void | Promise<void>;
    onReveal: () => void | Promise<void>;
    onCopyPath: () => void | Promise<void>;
    onToggleChatContext: () => void;
    onDelete: () => void | Promise<void>;
    onClose: () => void;
}) {
    const run = (action: () => void | Promise<void>) => {
        void Promise.resolve(action()).then(onClose, onClose);
    };
    const canUseChatContext = sourceEntry?.status === "ready";
    const chatContextLabel = inChatContext
        ? "Remove from chat context"
        : "Add to chat context";

    return (
        <div
            className="fixed z-50 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: x, top: y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                {node.name}
            </div>
            <FileContextMenuItem onSelect={() => run(onOpen)}>Open</FileContextMenuItem>
            <FileContextMenuItem onSelect={() => run(onRename)}>
                Rename
            </FileContextMenuItem>
            <FileContextMenuItem onSelect={() => run(onReveal)}>
                Reveal in Finder
            </FileContextMenuItem>
            <FileContextMenuItem onSelect={() => run(onCopyPath)}>
                Copy path
            </FileContextMenuItem>
            {sourceEntry ? (
                <FileContextMenuItem
                    disabled={!canUseChatContext}
                    onSelect={() => run(onToggleChatContext)}
                >
                    {canUseChatContext ? chatContextLabel : "Source not ready"}
                </FileContextMenuItem>
            ) : null}
            <div className="my-1 h-px bg-border" />
            <FileContextMenuItem onSelect={() => run(onDelete)}>
                {sourceEntry
                    ? "Remove source"
                    : node.name.endsWith(".md")
                      ? "Delete note"
                      : "Delete file"}
            </FileContextMenuItem>
        </div>
    );
}

function FileContextMenuItem({
    children,
    disabled = false,
    onSelect,
}: {
    children: string;
    disabled?: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            className={cn(
                "flex w-full items-center rounded-sm px-2 py-1 text-left text-xs outline-none hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
            )}
            disabled={disabled}
            onClick={onSelect}
        >
            {children}
        </button>
    );
}

function FileTree({
    workspaceName,
    tree,
    activeNotePath,
    onSelect,
    getSourceEntry,
    onFileContextMenu,
}: {
    workspaceName: string;
    tree: FileNode[];
    activeNotePath: string | null;
    onSelect: (path: string) => void;
    getSourceEntry: (fileName: string) => SourceEntry | undefined;
    onFileContextMenu: (event: ReactMouseEvent, node: FileNode) => void;
}) {
    return (
        <div className="flex-1 overflow-y-auto px-2 pb-3">
            <WorkspaceRootLabel workspaceName={workspaceName} />
            {tree.map((node) => (
                <TreeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={activeNotePath}
                    onSelect={onSelect}
                    getSourceEntry={getSourceEntry}
                    onFileContextMenu={onFileContextMenu}
                />
            ))}
        </div>
    );
}

function WorkspaceRootLabel({ workspaceName }: { workspaceName: string }) {
    return (
        <div className="mb-1 flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium text-muted-foreground">
            <Folder className="size-3.5" />
            <span>{workspaceName}</span>
        </div>
    );
}
