import { useEffect, useState } from "react";
import {
  File as FileIcon,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  Hash,
} from "lucide-react";

import { cn } from "@/lib/utils";

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
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
          <span className="truncate">{node.name}</span>
        </button>
        {open &&
          node.children?.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  const isActive = node.path === selectedPath;

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-sm hover:bg-accent",
        isActive && "bg-accent font-medium",
      )}
      style={{ paddingLeft: depth * 12 + 20 }}
    >
      {node.name.endsWith(".md") ? (
        <Hash className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FilePanel({
  workspacePath,
  workspaceName,
}: {
  workspacePath: string;
  workspaceName: string;
}) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    window.electron.workspace.listFiles(workspacePath).then(setTree);
  }, [workspacePath]);

  return (
    <aside className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70">
          Project Files
        </h2>
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
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
        ))}
      </div>
    </aside>
  );
}
