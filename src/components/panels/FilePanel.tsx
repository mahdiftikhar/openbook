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
    FileSearch,
    LibraryBig,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notesApi } from "@/renderer/api/notesApi";
import { sourcesApi } from "@/renderer/api/sourcesApi";
import { workspaceApi } from "@/renderer/api/workspaceApi";
import type { FileNode, SourceEntry } from "@/shared/types";
import { FileContextMenu } from "./FileContextMenu";

const MAX_COPY_PATH_ATTEMPTS = 100;

async function findCopyPath(
    sourcePath: string,
    targetDir: string,
): Promise<string | null> {
    const sourceName = sourcePath.substring(sourcePath.lastIndexOf("/") + 1);
    const dotIndex = sourceName.lastIndexOf(".");
    const ext = dotIndex >= 0 ? sourceName.slice(dotIndex) : "";
    const baseName = dotIndex >= 0 ? sourceName.slice(0, dotIndex) : sourceName;

    for (let counter = 1; counter <= MAX_COPY_PATH_ATTEMPTS; counter++) {
        const suffix = counter === 1 ? "_copy" : `_copy_${counter}`;
        const newPath = `${targetDir}/${baseName}${suffix}${ext}`;
        if ((await notesApi.read(newPath)) === null) {
            return newPath;
        }
    }
    return null;
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
        workspaceApi.listFiles(workspacePath).then(setTree);
        sourcesApi.list(workspacePath).then(setSourceEntries);
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
        const filePath = await notesApi.create(workspacePath);
        onOpenNote(filePath);
        onNotesChanged();
    };

    const handleAddPdf = async () => {
        const entry = await sourcesApi.addPdf(workspacePath);
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
        await sourcesApi.remove(workspacePath, fileName);
        removeSourceFromContext(fileName);
        if (activeFileName === fileName) onOpenNote(null);
        setLocalVersion((v) => v + 1);
        onNotesChanged();
    };

    const handleDeleteNote = async (filePath: string) => {
        const ok = await notesApi.delete(filePath);
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
        await workspaceApi.revealFile(filePath);
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
            if (newBaseName === null || newBaseName.trim().length === 0) return;

            const sourceEntry = sourceMap[node.name];
            if (sourceEntry) {
                const renamed = await sourcesApi.rename(
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
                        fileName === node.name ? renamed.fileName : fileName,
                    ),
                );
                if (activeNotePath === filePath) onOpenNote(renamedPath);
                setLocalVersion((v) => v + 1);
                onNotesChanged();
                return;
            }

            const renamedPath = await notesApi.rename(
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
            const content = await notesApi.read(copiedFilePath);
            if (content === null) return;

            const newPath = await findCopyPath(copiedFilePath, targetDir);
            if (newPath === null) return;

            const success = await notesApi.write(newPath, content);
            if (success) {
                setLocalVersion((v) => v + 1);
                onNotesChanged();
            }
        },
        [copiedFilePath, onNotesChanged],
    );

    const handleDuplicateFile = useCallback(
        async (filePath: string) => {
            const content = await notesApi.read(filePath);
            if (content === null) return;

            const dir = filePath.substring(0, filePath.lastIndexOf("/"));
            const newPath = await findCopyPath(filePath, dir);
            if (newPath === null) return;

            const success = await notesApi.write(newPath, content);
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
            <FilePanelHeader
                sourceCount={sourceEntries.length}
                onAddPdf={handleAddPdf}
                onNewNote={handleNew}
            />
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
            className="flex h-7 w-full items-center gap-1 rounded-md px-1.5 text-left text-[13px] text-foreground/85 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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
            className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-[13px] focus-visible:outline-none"
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
                        onRenameSubmit?.(node.path, node, e.currentTarget.value)
                    }
                    className="h-6 w-full rounded border border-input bg-background px-1.5 text-[13px] outline-none"
                />
                {ext && (
                    <span className="ml-1 shrink-0 text-[13px] text-muted-foreground">
                        {ext}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div
            className={cn(
                "group relative flex h-7 items-center rounded-md px-1.5 text-foreground/80 transition-colors hover:bg-accent hover:text-foreground",
                isActive &&
                    "bg-primary/10 font-medium text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
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
    sourceCount,
    onAddPdf,
    onNewNote,
}: {
    sourceCount: number;
    onAddPdf: () => void;
    onNewNote: () => void;
}) {
    return (
        <div className="flex min-h-12 items-center justify-between border-b border-sidebar-border/70 px-3">
            <div className="min-w-0">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold text-sidebar-foreground">
                    <LibraryBig className="size-3.5 text-primary" />
                    Library
                </h2>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {sourceCount === 1 ? "1 source" : `${sourceCount} sources`}
                </p>
            </div>
            <div className="flex items-center gap-0.5">
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label="Add PDF source"
                    title="Add PDF source"
                    onClick={onAddPdf}
                >
                    <Plus className="size-3.5" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label="New note"
                    title="New note"
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
        <div className="px-3 py-2.5">
            <label className="flex items-center gap-2 rounded-lg border border-border/80 bg-background/45 px-2.5 shadow-sm transition-colors focus-within:border-primary/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/10">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Search library"
                    aria-label="Search library"
                    className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/75"
                />
            </label>
        </div>
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
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            <WorkspaceRootLabel workspaceName={workspaceName} />
            {filteredTree.length > 0 ? (
                filteredTree.map((node) => (
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
                ))
            ) : (
                <div className="mx-2 mt-8 text-center text-muted-foreground">
                    <FileSearch className="mx-auto size-5 opacity-50" />
                    <p className="mt-2 text-xs">
                        {searching
                            ? "No matching files"
                            : "Your library is empty"}
                    </p>
                </div>
            )}
        </div>
    );
}

function WorkspaceRootLabel({ workspaceName }: { workspaceName: string }) {
    return (
        <div className="mb-1 flex items-center gap-1.5 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            <Folder className="size-3.5" />
            <span>{workspaceName}</span>
        </div>
    );
}
