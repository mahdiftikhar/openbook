import { useState } from "react";
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

type FileNode = {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  active?: boolean;
};

// TODO: This is just some static files -- this will need to be update
// to reflect actual file storage. Meta-data / structure for files will probably
// be need to be maintained here
const TREE: FileNode[] = [
  {
    name: "Notes",
    type: "folder",
    children: [
      { name: "meeting-2024.md", type: "file", active: true },
      { name: "ideas.md", type: "file" },
      { name: "summary.md", type: "file" },
    ],
  },
  {
    name: "Sources",
    type: "folder",
    children: [
      { name: "research-paper.pdf", type: "file" },
      { name: "article.md", type: "file" },
      { name: "transcript.txt", type: "file" },
    ],
  },
  {
    name: "References",
    type: "folder",
    children: [
      { name: "bibliography.md", type: "file" },
      { name: "glossary.md", type: "file" },
    ],
  },
];

function TreeItem({ node, depth }: { node: FileNode; depth: number }) {
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
            <TreeItem key={child.name} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  }

  return (
    <button
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-sm hover:bg-accent",
        node.active && "bg-accent font-medium",
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

export function FilePanel() {
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
          <span>research-project</span>
        </div>
        {TREE.map((node) => (
          <TreeItem key={node.name} node={node} depth={0} />
        ))}
      </div>
    </aside>
  );
}
