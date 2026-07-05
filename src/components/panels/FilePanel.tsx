import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  onDeleteSource,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  getSourceEntry?: (filePath: string) => SourceEntry | undefined;
  onDeleteSource?: (fileName: string) => void;
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
              onDeleteSource={onDeleteSource}
            />
          ))}
      </div>
    );
  }

  const isActive = node.path === selectedPath;
  const fileName = node.name.split(/[/\\]/).pop() ?? node.name;
  const sourceEntry = getSourceEntry?.(node.path);
  const isSource = sourceEntry !== undefined;

  return (
    <div
      className={cn(
        "group flex items-center rounded px-1.5 py-1 hover:bg-accent",
        isActive && "bg-accent font-medium",
      )}
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
      {isSource && onDeleteSource && (
        <button
          onClick={() => onDeleteSource(fileName)}
          className="shrink-0 rounded p-0.5 opacity-0 hover:bg-accent-foreground/10 group-hover:opacity-100"
          aria-label={`Remove ${node.name}`}
        >
          <Trash2 className="size-3 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

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
    (filePath: string) => {
      const name = filePath.split(/[/\\]/).pop();
      return name ? sourceMap[name] : undefined;
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

  return (
    <aside className="flex h-full flex-col bg-sidebar">
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
            onClick={handleAddPdf}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="New note"
            onClick={handleNew}
          >
            <FilePlus2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            placeholder="Search files..."
            className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="mb-1 flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium text-muted-foreground">
          <Folder className="size-3.5" />
          <span>{workspaceName}</span>
        </div>
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={activeNotePath}
            onSelect={handleSelect}
            getSourceEntry={getSourceEntry}
            onDeleteSource={handleDeleteSource}
          />
        ))}
      </div>
    </aside>
  );
}
