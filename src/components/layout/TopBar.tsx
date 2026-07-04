import {
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  PanelRightClose,
  BookOpen,
  Moon,
  Sun,
  ChevronDown,
  FolderSync,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar({
  workspaceName,
  filesOpen,
  onToggleFiles,
  chatOpen,
  onToggleChat,
  dark,
  onToggleDark,
  onSwitchWorkspace,
  onCloseWorkspace,
}: {
  workspaceName: string;
  filesOpen: boolean;
  onToggleFiles: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  dark: boolean;
  onToggleDark: () => void;
  onSwitchWorkspace: () => void;
  onCloseWorkspace: () => void;
}) {
  const isMac = window.electron?.platform === "darwin";
  return (
    <header
      className={
        "drag-region flex items-center gap-2 border-b bg-background py-1 " +
        (isMac ? "pl-20 pr-3" : "px-3")
      }
    >
      <Button
        variant="ghost"
        size="icon"
        className="no-drag size-7"
        aria-label={filesOpen ? "Hide file panel" : "Show file panel"}
        onClick={onToggleFiles}
      >
        {filesOpen ? (
          <PanelLeftClose className="size-4" />
        ) : (
          <PanelLeftOpen className="size-4" />
        )}
      </Button>
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-primary" />
        <span className="text-sm font-semibold">openbook</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="no-drag h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {workspaceName}
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={onSwitchWorkspace}>
            <FolderSync className="size-4" />
            Switch Project...
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCloseWorkspace}>
            <X className="size-4" />
            Close Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="no-drag size-7"
          aria-label="Toggle dark mode"
          onClick={onToggleDark}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="no-drag size-7"
          aria-label={chatOpen ? "Hide chat panel" : "Show chat panel"}
          onClick={onToggleChat}
        >
          {chatOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
      </div>
    </header>
  );
}
