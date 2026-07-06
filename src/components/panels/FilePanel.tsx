import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type MouseEvent as ReactMouseEvent,
    type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
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
    Trash2,
    Check,
    AlertCircle,
    Pencil,
    Copy,
    Files,
    ClipboardPaste,
    ExternalLink,
    MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function findCopyPath(
    sourcePath: string,
    targetDir: string,
): Promise<string | null> {
    const sourceName = sourcePath.substring(sourcePath.lastIndexOf("/") + 1);
    const dotIndex = sourceName.lastIndexOf(".");
    const ext = dotIndex >= 0 ? sourceName.slice(dotIndex) : "";
    const baseName =
        dotIndex >= 0 ? sourceName.slice(0, dotIndex) : sourceName;

    let newName = `${baseName}_copy${ext}`;
    let newPath = `${targetDir}/${newName}`;
    let counter = 2;
    while ((await window.electron.notes.read(newPath)) !== null) {
        newName = `${baseName}_copy_${counter}${ext}`;
        newPath = `${targetDir}/${newName}`;
        counter++;
    }
    return newPath;
}

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
    const [searchQuery, setSearchQuery] = useState("");
    const [contextMenu, setContextMenu] = useState<{
        node: FileNode;
        isSource: boolean;
        x: number;
        y: number;
    } | null>(null);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [copiedFilePath, setCopiedFilePath] = useState<string | null>(null);

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

    const handleDeleteNote = async (filePath: string) => {
        const ok = await window.electron.notes.delete(filePath);
        if (!ok) return;
        if (activeNotePath === filePath) onOpenNote(null);
        setLocalVersion((v) => v + 1);
        onNotesChanged();
    };

    const handleDeleteFile = async (node: FileNode) => {
        const sourceEntry = sourceMap[node.name];
        if (sourceEntry) {
            await handleDeleteSource(node.name);
            return;
        }
        await handleDeleteNote(node.path);
    };

    const handleCopyPath = useCallback((filePath: string) => {
        navigator.clipboard.writeText(filePath).catch(() => undefined);
    }, []);

    const handleRevealFile = useCallback(async (filePath: string) => {
        await window.electron.workspace.revealFile(filePath);
    }, []);

    const handleToggleSourceContext = (fileName: string) => {
        if (sourceMap[fileName]?.status !== "ready") return;
        onSelectedSourceNamesChange((current) => {
            if (current.includes(fileName)) {
                return current.filter(
                    (selectedName) => selectedName !== fileName,
                );
            }
            return [...current, fileName];
        });
    };

    const handleFileContextMenu = useCallback(
        (event: ReactMouseEvent, node: FileNode) => {
            event.preventDefault();
            event.stopPropagation();
            const isSource = sourceMap[node.name] !== undefined;
            setContextMenu({
                node,
                isSource,
                x: event.clientX,
                y: event.clientY,
            });
        },
        [sourceMap],
    );

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleRenameSubmit = useCallback(
        async (
            filePath: string,
            node: FileNode,
            newBaseName: string | null,
        ) => {
            setRenamingPath(null);
            if (newBaseName === null || newBaseName.trim().length === 0)
                return;

            const sourceEntry = sourceMap[node.name];
            if (sourceEntry) {
                const renamed = await window.electron.sources.rename(
                    workspacePath,
                    node.name,
                    newBaseName.trim(),
                );
                if (!renamed) return;

                const renamedPath = filePath.endsWith(node.name)
                    ? `${filePath.slice(0, -node.name.length)}${renamed.fileName}`
                    : filePath;
                onSelectedSourceNamesChange((current) =>
                    current.map((fileName) =>
                        fileName === node.name
                            ? renamed.fileName
                            : fileName,
                    ),
                );
                if (activeNotePath === filePath) onOpenNote(renamedPath);
                setLocalVersion((v) => v + 1);
                onNotesChanged();
                return;
            }

            const renamedPath = await window.electron.notes.rename(
                filePath,
                newBaseName.trim(),
            );
            if (!renamedPath) return;
            if (activeNotePath === filePath) onOpenNote(renamedPath);
            setLocalVersion((v) => v + 1);
            onNotesChanged();
        },
        [
            workspacePath,
            sourceMap,
            activeNotePath,
            onOpenNote,
            onNotesChanged,
            onSelectedSourceNamesChange,
        ],
    );

    const handleCopyFile = useCallback((filePath: string) => {
        setCopiedFilePath(filePath);
    }, []);

    const handlePasteFile = useCallback(
        async (targetDir: string) => {
            if (!copiedFilePath) return;
            const content = await window.electron.notes.read(copiedFilePath);
            if (content === null) return;

            const newPath = await findCopyPath(copiedFilePath, targetDir);
            if (newPath === null) return;

            const success = await window.electron.notes.write(
                newPath,
                content,
            );
            if (success) {
                setLocalVersion((v) => v + 1);
                onNotesChanged();
            }
        },
        [copiedFilePath, onNotesChanged],
    );

    const handleDuplicateFile = useCallback(
        async (filePath: string) => {
            const content = await window.electron.notes.read(filePath);
            if (content === null) return;

            const dir = filePath.substring(0, filePath.lastIndexOf("/"));
            const newPath = await findCopyPath(filePath, dir);
            if (newPath === null) return;

            const success = await window.electron.notes.write(
                newPath,
                content,
            );
            if (success) {
                setLocalVersion((v) => v + 1);
                onNotesChanged();
            }
        },
        [onNotesChanged],
    );

    const contextSourceEntry = contextMenu
        ? sourceMap[contextMenu.node.name]
        : undefined;
    const contextInChat = contextMenu
        ? selectedSourceNames.includes(contextMenu.node.name)
        : false;

    return (
        <aside className="flex h-full flex-col bg-surface-files">
            <FilePanelHeader onAddPdf={handleAddPdf} onNewNote={handleNew} />
            <FileSearchInput value={searchQuery} onChange={setSearchQuery} />
            <FileTree
                workspaceName={workspaceName}
                tree={tree}
                activeNotePath={activeNotePath}
                onSelect={handleSelect}
                getSourceEntry={getSourceEntry}
                searchQuery={searchQuery}
                onFileContextMenu={handleFileContextMenu}
                renamingPath={renamingPath}
                onRenameSubmit={handleRenameSubmit}
            />
            {contextMenu && (
                <FileContextMenu
                    node={contextMenu.node}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    isSource={contextMenu.isSource}
                    sourceEntry={contextSourceEntry}
                    inChatContext={contextInChat}
                    pasteDisabled={!copiedFilePath}
                    onOpen={() => {
                        onOpenNote(contextMenu.node.path);
                        setContextMenu(null);
                    }}
                    onRename={() => {
                        setRenamingPath(contextMenu.node.path);
                        setContextMenu(null);
                    }}
                    onDuplicate={() => {
                        handleDuplicateFile(contextMenu.node.path);
                        setContextMenu(null);
                    }}
                    onCopyFile={() => {
                        handleCopyFile(contextMenu.node.path);
                        setContextMenu(null);
                    }}
                    onPaste={() => {
                        const dir = contextMenu.node.path.substring(
                            0,
                            contextMenu.node.path.lastIndexOf("/"),
                        );
                        handlePasteFile(dir);
                        setContextMenu(null);
                    }}
                    onCopyPath={() => {
                        handleCopyPath(contextMenu.node.path);
                        setContextMenu(null);
                    }}
                    onReveal={() => {
                        handleRevealFile(contextMenu.node.path);
                        setContextMenu(null);
                    }}
                    onToggleChatContext={() => {
                        handleToggleSourceContext(contextMenu.node.name);
                        setContextMenu(null);
                    }}
                    onDelete={() => {
                        handleDeleteFile(contextMenu.node);
                        setContextMenu(null);
                    }}
                    onClose={handleCloseContextMenu}
                />
            )}
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
    forceExpand,
    onFileContextMenu,
    renamingPath,
    onRenameSubmit,
}: {
    node: FileNode;
    depth: number;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    getSourceEntry?: (fileName: string) => SourceEntry | undefined;
    forceExpand?: boolean;
    onFileContextMenu: (event: ReactMouseEvent, node: FileNode) => void;
    renamingPath?: string | null;
    onRenameSubmit?: (
        filePath: string,
        node: FileNode,
        newBaseName: string | null,
    ) => void;
}) {
    const [open, setOpen] = useState(depth === 0 || forceExpand);

    useEffect(() => {
        if (forceExpand) setOpen(true);
    }, [forceExpand]);

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
                            forceExpand={forceExpand}
                            onFileContextMenu={onFileContextMenu}
                            renamingPath={renamingPath}
                            onRenameSubmit={onRenameSubmit}
                        />
                    ))}
            </div>
        );
    }

    const isActive = node.path === selectedPath;
    const sourceEntry = getSourceEntry?.(node.name);
    const isSource = sourceEntry !== undefined;

    if (node.path === renamingPath) {
        const dotIndex = node.name.lastIndexOf(".");
        const ext = dotIndex >= 0 ? node.name.slice(dotIndex) : "";
        const baseName =
            dotIndex >= 0 ? node.name.slice(0, dotIndex) : node.name;

        return (
            <div
                className="flex items-center rounded px-1.5 py-1"
                style={{ paddingLeft: depth * 12 + 14 }}
            >
                <input
                    autoFocus
                    defaultValue={baseName}
                    onFocus={(e) => {
                        const val = e.target.value;
                        e.target.setSelectionRange(0, val.length);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            onRenameSubmit?.(
                                node.path,
                                node,
                                e.currentTarget.value,
                            );
                        }
                        if (e.key === "Escape") {
                            e.preventDefault();
                            onRenameSubmit?.(node.path, node, null);
                        }
                    }}
                    onBlur={(e) =>
                        onRenameSubmit?.(
                            node.path,
                            node,
                            e.currentTarget.value,
                        )
                    }
                    className="h-6 w-full rounded border border-input bg-background px-1.5 text-sm outline-none"
                />
                {ext && (
                    <span className="ml-1 shrink-0 text-sm text-muted-foreground">
                        {ext}
                    </span>
                )}
            </div>
        );
    }

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

function FileSearchInput({
    value,
    onChange,
}: {
    value: string;
    onChange: (q: string) => void;
}) {
    return (
        <div className="px-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-accent/60 px-2">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
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
    isSource,
    sourceEntry,
    inChatContext,
    pasteDisabled,
    onOpen,
    onRename,
    onDuplicate,
    onCopyFile,
    onPaste,
    onCopyPath,
    onReveal,
    onToggleChatContext,
    onDelete,
    onClose,
}: {
    node: FileNode;
    x: number;
    y: number;
    isSource: boolean;
    sourceEntry: SourceEntry | undefined;
    inChatContext: boolean;
    pasteDisabled: boolean;
    onOpen: () => void;
    onRename: () => void;
    onDuplicate: () => void;
    onCopyFile: () => void;
    onPaste: () => void;
    onCopyPath: () => void;
    onReveal: () => void;
    onToggleChatContext: () => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    useEffect(() => {
        const handleClick = () => onClose();
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("click", handleClick);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("click", handleClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    const canUseChatContext = sourceEntry?.status === "ready";
    const chatContextLabel = inChatContext
        ? "Remove from chat context"
        : "Add to chat context";

    const isNoteFile = !isSource && node.name.endsWith(".md");

    return createPortal(
        <div
            className="fixed z-50 flex min-w-48 flex-col overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: x, top: y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                {node.name}
            </div>
            <ContextMenuItem icon={ExternalLink} onSelect={onOpen}>
                Open
            </ContextMenuItem>
            <ContextMenuItem icon={Pencil} onSelect={onRename}>
                Rename
            </ContextMenuItem>
            <ContextMenuItem
                icon={Files}
                onSelect={onDuplicate}
                disabled={isSource}
            >
                Duplicate
            </ContextMenuItem>
            <ContextMenuItem
                icon={Copy}
                onSelect={onCopyFile}
                disabled={isSource}
            >
                Copy
            </ContextMenuItem>
            <ContextMenuItem
                icon={ClipboardPaste}
                onSelect={onPaste}
                disabled={isSource || pasteDisabled}
            >
                Paste
            </ContextMenuItem>
            <ContextMenuItem icon={Copy} onSelect={onCopyPath}>
                Copy path
            </ContextMenuItem>
            <ContextMenuItem icon={FolderOpen} onSelect={onReveal}>
                Reveal in Finder
            </ContextMenuItem>
            {isSource ? (
                <ContextMenuItem
                    icon={MessageSquare}
                    disabled={!canUseChatContext}
                    onSelect={onToggleChatContext}
                >
                    {canUseChatContext ? chatContextLabel : "Source not ready"}
                </ContextMenuItem>
            ) : null}
            <div className="my-1 h-px bg-border" />
            <ContextMenuItem
                icon={Trash2}
                variant="destructive"
                onSelect={onDelete}
            >
                {isSource
                    ? "Remove source"
                    : isNoteFile
                      ? "Delete note"
                      : "Delete file"}
            </ContextMenuItem>
        </div>,
        document.body,
    );
}

function ContextMenuItem({
    children,
    icon: Icon,
    disabled = false,
    variant,
    onSelect,
}: {
    children: React.ReactNode;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
    variant?: "destructive";
    onSelect: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "justify-start rounded-sm",
                variant === "destructive" &&
                    "hover:bg-destructive/10 hover:text-destructive",
            )}
            disabled={disabled}
            onClick={onSelect}
        >
            <Icon className="size-4" />
            {children}
        </Button>
    );
}

function filterTree(nodes: FileNode[], query: string): FileNode[] {
    if (!query) return nodes;
    const lower = query.toLowerCase();
    return nodes.reduce<FileNode[]>((acc, node) => {
        if (node.type === "folder") {
            const filtered = filterTree(node.children ?? [], query);
            const nameMatches = node.name.toLowerCase().includes(lower);
            if (nameMatches || filtered.length > 0) {
                acc.push({
                    ...node,
                    children: nameMatches ? node.children : filtered,
                });
            }
        } else if (node.name.toLowerCase().includes(lower)) {
            acc.push(node);
        }
        return acc;
    }, []);
}

function FileTree({
    workspaceName,
    tree,
    activeNotePath,
    onSelect,
    getSourceEntry,
    searchQuery,
    onFileContextMenu,
    renamingPath,
    onRenameSubmit,
}: {
    workspaceName: string;
    tree: FileNode[];
    activeNotePath: string | null;
    onSelect: (path: string) => void;
    getSourceEntry: (fileName: string) => SourceEntry | undefined;
    searchQuery: string;
    onFileContextMenu: (event: ReactMouseEvent, node: FileNode) => void;
    renamingPath: string | null;
    onRenameSubmit: (
        filePath: string,
        node: FileNode,
        newBaseName: string | null,
    ) => void;
}) {
    const filteredTree = useMemo(
        () => filterTree(tree, searchQuery),
        [tree, searchQuery],
    );
    const searching = searchQuery.length > 0;

    return (
        <div className="flex-1 overflow-y-auto px-2 pb-3">
            <WorkspaceRootLabel workspaceName={workspaceName} />
            {filteredTree.map((node) => (
                <TreeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={activeNotePath}
                    onSelect={onSelect}
                    getSourceEntry={getSourceEntry}
                    forceExpand={searching}
                    onFileContextMenu={onFileContextMenu}
                    renamingPath={renamingPath}
                    onRenameSubmit={onRenameSubmit}
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
