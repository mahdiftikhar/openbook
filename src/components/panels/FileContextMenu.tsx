import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ComponentType,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
    ClipboardPaste,
    Copy,
    ExternalLink,
    Files,
    FolderOpen,
    MessageSquare,
    Pencil,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FileNode, SourceEntry } from "@/shared/types";

const CONTEXT_MENU_VIEWPORT_MARGIN = 8;

export function FileContextMenu({
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
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [position, setPosition] = useState({ x, y });

    useLayoutEffect(() => {
        const rect = menuRef.current?.getBoundingClientRect();
        if (!rect) return;

        const nextPosition = clampContextMenuPosition(
            x,
            y,
            rect.width,
            rect.height,
        );
        setPosition((current) =>
            current.x === nextPosition.x && current.y === nextPosition.y
                ? current
                : nextPosition,
        );
    }, [x, y, isSource, pasteDisabled]);

    useEffect(() => {
        const close = () => onClose();
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("click", close);
        window.addEventListener("contextmenu", close);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", handleEscape);
        return () => {
            window.removeEventListener("click", close);
            window.removeEventListener("contextmenu", close);
            window.removeEventListener("resize", close);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    const canUseChatContext = sourceEntry?.status === "ready";
    const chatContextLabel = inChatContext
        ? "Remove from chat context"
        : "Add to chat context";

    const isNoteFile = !isSource && node.name.endsWith(".md");
    const contextMenuItems: ContextMenuItemConfig[] = [
        {
            type: "item",
            key: "open",
            label: "Open",
            icon: ExternalLink,
            onSelect: onOpen,
        },
        {
            type: "item",
            key: "rename",
            label: "Rename",
            icon: Pencil,
            onSelect: onRename,
        },
        {
            type: "item",
            key: "duplicate",
            label: "Duplicate",
            icon: Files,
            disabled: isSource,
            onSelect: onDuplicate,
        },
        {
            type: "item",
            key: "copy-file",
            label: "Copy",
            icon: Copy,
            disabled: isSource,
            onSelect: onCopyFile,
        },
        {
            type: "item",
            key: "paste",
            label: "Paste",
            icon: ClipboardPaste,
            disabled: isSource || pasteDisabled,
            onSelect: onPaste,
        },
        {
            type: "item",
            key: "copy-path",
            label: "Copy path",
            icon: Copy,
            onSelect: onCopyPath,
        },
        {
            type: "item",
            key: "reveal",
            label: "Reveal in Finder",
            icon: FolderOpen,
            onSelect: onReveal,
        },
        ...(isSource
            ? [
                  {
                      type: "item" as const,
                      key: "chat-context",
                      label: canUseChatContext
                          ? chatContextLabel
                          : "Source not ready",
                      icon: MessageSquare,
                      disabled: !canUseChatContext,
                      onSelect: onToggleChatContext,
                  },
              ]
            : []),
        { type: "separator", key: "delete-separator" },
        {
            type: "item",
            key: "delete",
            label: isSource
                ? "Remove source"
                : isNoteFile
                  ? "Delete note"
                  : "Delete file",
            icon: Trash2,
            variant: "destructive",
            onSelect: onDelete,
        },
    ];

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-50 flex min-w-48 flex-col overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: position.x, top: position.y }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                {node.name}
            </div>
            {contextMenuItems.map((item) =>
                item.type === "separator" ? (
                    <div key={item.key} className="my-1 h-px bg-border" />
                ) : (
                    <ContextMenuItem
                        key={item.key}
                        icon={item.icon}
                        disabled={item.disabled}
                        variant={item.variant}
                        onSelect={item.onSelect}
                    >
                        {item.label}
                    </ContextMenuItem>
                ),
            )}
        </div>,
        document.body,
    );
}

function clampContextMenuPosition(
    x: number,
    y: number,
    width: number,
    height: number,
) {
    const maxX = Math.max(
        CONTEXT_MENU_VIEWPORT_MARGIN,
        window.innerWidth - width - CONTEXT_MENU_VIEWPORT_MARGIN,
    );
    const maxY = Math.max(
        CONTEXT_MENU_VIEWPORT_MARGIN,
        window.innerHeight - height - CONTEXT_MENU_VIEWPORT_MARGIN,
    );

    return {
        x: Math.min(Math.max(x, CONTEXT_MENU_VIEWPORT_MARGIN), maxX),
        y: Math.min(Math.max(y, CONTEXT_MENU_VIEWPORT_MARGIN), maxY),
    };
}

type ContextMenuItemConfig =
    | {
          type: "item";
          key: string;
          label: string;
          icon: ComponentType<{ className?: string }>;
          disabled?: boolean;
          variant?: "destructive";
          onSelect: () => void;
      }
    | {
          type: "separator";
          key: string;
      };

function ContextMenuItem({
    children,
    icon: Icon,
    disabled = false,
    variant,
    onSelect,
}: {
    children: ReactNode;
    icon: ComponentType<{ className?: string }>;
    disabled?: boolean;
    variant?: "destructive";
    onSelect: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className={cn(
                "h-6 justify-start rounded-sm px-2 py-0.5 text-[11px] font-normal",
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
