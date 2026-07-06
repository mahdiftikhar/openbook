import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FilePanel({
    workspacePath,
    workspaceName,
    activeNotePath,
    refreshKey,
    onOpenNote,
    onNotesChanged,
}: {
    workspacePath: string;
    workspaceName: string;
    activeNotePath: string | null;
    refreshKey: number;
    onOpenNote: (path: string) => void;
    onNotesChanged: () => void;
}) {
    const [tree, setTree] = useState<FileNode[]>([]);
    const [sourceEntries, setSourceEntries] = useState<SourceEntry[]>([]);
    const [localVersion, setLocalVersion] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [contextMenu, setContextMenu] = useState<{
        filePath: string;
        fileName: string;
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

    const handleDeleteSource = async (fileName: string) => {
        await window.electron.sources.remove(workspacePath, fileName);
        setLocalVersion((v) => v + 1);
        onNotesChanged();
    };

    const handleFileContextMenu = useCallback(
        (
            filePath: string,
            fileName: string,
            isSource: boolean,
            x: number,
            y: number,
        ) => {
            setContextMenu({ filePath, fileName, isSource, x, y });
        },
        [],
    );

    const handleCopyPath = useCallback((filePath: string) => {
        navigator.clipboard.writeText(filePath).catch(() => undefined);
    }, []);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(null);
    }, []);

    const handleRenameStart = useCallback(() => {
        if (!contextMenu) return;
        setRenamingPath(contextMenu.filePath);
        setContextMenu(null);
    }, [contextMenu]);

    const handleRenameSubmit = useCallback(
        async (filePath: string, newBaseName: string | null) => {
            setRenamingPath(null);
            if (newBaseName === null || newBaseName.trim().length === 0)
                return;
            const newPath = await window.electron.notes.rename(
                filePath,
                newBaseName.trim(),
            );
            if (newPath) {
                if (filePath === activeNotePath) onOpenNote(newPath);
                onNotesChanged();
            }
        },
        [activeNotePath, onOpenNote, onNotesChanged],
    );

    const handleDeleteNote = useCallback(
        async (filePath: string) => {
            const success = await window.electron.notes.delete(filePath);
            if (success) {
                setLocalVersion((v) => v + 1);
                onNotesChanged();
            }
        },
        [onNotesChanged],
    );

    const handleCopyFile = useCallback((filePath: string) => {
        setCopiedFilePath(filePath);
    }, []);

    const handlePasteFile = useCallback(
        async (targetDir: string) => {
            if (!copiedFilePath) return;
            const content = await window.electron.notes.read(copiedFilePath);
            if (content === null) return;

            const sourceName = copiedFilePath.substring(
                copiedFilePath.lastIndexOf("/") + 1,
            );
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
            const fileName = filePath.substring(
                filePath.lastIndexOf("/") + 1,
            );
            const dotIndex = fileName.lastIndexOf(".");
            const ext = dotIndex >= 0 ? fileName.slice(dotIndex) : "";
            const baseName =
                dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName;

            let newName = `${baseName}_copy${ext}`;
            let newPath = `${dir}/${newName}`;
            let counter = 2;
            while ((await window.electron.notes.read(newPath)) !== null) {
                newName = `${baseName}_copy_${counter}${ext}`;
                newPath = `${dir}/${newName}`;
                counter++;
            }

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

    return (
        <aside className="flex h-full flex-col bg-sidebar">
            <FilePanelHeader onAddPdf={handleAddPdf} onNewNote={handleNew} />
            <FileSearchInput value={searchQuery} onChange={setSearchQuery} />
            <FileTree
                workspaceName={workspaceName}
                tree={tree}
                activeNotePath={activeNotePath}
                onSelect={handleSelect}
                getSourceEntry={getSourceEntry}
                searchQuery={searchQuery}
                onContextMenu={handleFileContextMenu}
                renamingPath={renamingPath}
                onRenameSubmit={handleRenameSubmit}
            />
            {contextMenu && (
                <FileContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    isSource={contextMenu.isSource}
                    pasteDisabled={!copiedFilePath}
                    onRename={handleRenameStart}
                    onDuplicate={() => {
                        handleDuplicateFile(contextMenu.filePath);
                        setContextMenu(null);
                    }}
                    onCopyFile={() => {
                        handleCopyFile(contextMenu.filePath);
                        setContextMenu(null);
                    }}
                    onPaste={() => {
                        const dir = contextMenu.filePath.substring(
                            0,
                            contextMenu.filePath.lastIndexOf("/"),
                        );
                        handlePasteFile(dir);
                        setContextMenu(null);
                    }}
                    onCopyPath={() => {
                        handleCopyPath(contextMenu.filePath);
                        setContextMenu(null);
                    }}
                    onDelete={() => {
                        if (contextMenu.isSource) {
                            handleDeleteSource(contextMenu.fileName);
                        } else {
                            handleDeleteNote(contextMenu.filePath);
                        }
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
    onContextMenu,
    renamingPath,
    onRenameSubmit,
}: {
    node: FileNode;
    depth: number;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    getSourceEntry?: (fileName: string) => SourceEntry | undefined;
    forceExpand?: boolean;
    onContextMenu?: (
        filePath: string,
        fileName: string,
        isSource: boolean,
        x: number,
        y: number,
    ) => void;
    renamingPath?: string | null;
    onRenameSubmit?: (filePath: string, newBaseName: string | null) => void;
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
                            onContextMenu={onContextMenu}
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

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu?.(node.path, node.name, isSource, e.clientX, e.clientY);
    };

    if (node.path === renamingPath) {
        const dotIndex = node.name.lastIndexOf(".");
        const ext = dotIndex >= 0 ? node.name.slice(dotIndex) : "";
        const baseName = dotIndex >= 0 ? node.name.slice(0, dotIndex) : node.name;

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
                            onRenameSubmit?.(node.path, e.currentTarget.value);
                        }
                        if (e.key === "Escape") {
                            e.preventDefault();
                            onRenameSubmit?.(node.path, null);
                        }
                    }}
                    onBlur={(e) =>
                        onRenameSubmit?.(node.path, e.currentTarget.value)
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
            onContextMenu={handleContextMenu}
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
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
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
    x,
    y,
    isSource,
    pasteDisabled,
    onRename,
    onDuplicate,
    onCopyFile,
    onPaste,
    onCopyPath,
    onDelete,
    onClose,
}: {
    x: number;
    y: number;
    isSource: boolean;
    pasteDisabled: boolean;
    onRename: () => void;
    onDuplicate: () => void;
    onCopyFile: () => void;
    onPaste: () => void;
    onCopyPath: () => void;
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

    return createPortal(
        <div
            className="fixed z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: x, top: y }}
        >
            <button
                onClick={onRename}
                disabled={isSource}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent disabled:opacity-50"
            >
                <Pencil className="size-4" />
                Rename
            </button>
            <button
                onClick={onDuplicate}
                disabled={isSource}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent disabled:opacity-50"
            >
                <Files className="size-4" />
                Duplicate
            </button>
            <button
                onClick={onCopyFile}
                disabled={isSource}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent disabled:opacity-50"
            >
                <Copy className="size-4" />
                Copy
            </button>
            <button
                onClick={onPaste}
                disabled={isSource || pasteDisabled}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent disabled:opacity-50"
            >
                <ClipboardPaste className="size-4" />
                Paste
            </button>
            <button
                onClick={onCopyPath}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent"
            >
                <Copy className="size-4" />
                Copy Path
            </button>
            <button
                onClick={onDelete}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-destructive"
            >
                <Trash2 className="size-4" />
                Delete
            </button>
        </div>,
        document.body,
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
                acc.push({ ...node, children: nameMatches ? node.children : filtered });
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
    onContextMenu,
    renamingPath,
    onRenameSubmit,
}: {
    workspaceName: string;
    tree: FileNode[];
    activeNotePath: string | null;
    onSelect: (path: string) => void;
    getSourceEntry: (fileName: string) => SourceEntry | undefined;
    searchQuery: string;
    onContextMenu: (
        filePath: string,
        fileName: string,
        isSource: boolean,
        x: number,
        y: number,
    ) => void;
    renamingPath: string | null;
    onRenameSubmit: (filePath: string, newBaseName: string | null) => void;
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
                    onContextMenu={onContextMenu}
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
