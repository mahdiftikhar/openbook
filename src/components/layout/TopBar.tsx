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
            <FilePanelToggle open={filesOpen} onToggle={onToggleFiles} />
            <AppBrand />
            <WorkspaceMenu
                workspaceName={workspaceName}
                onSwitchWorkspace={onSwitchWorkspace}
                onCloseWorkspace={onCloseWorkspace}
            />

            <div className="ml-auto flex items-center gap-1">
                <ThemeToggle dark={dark} onToggle={onToggleDark} />
                <ChatPanelToggle open={chatOpen} onToggle={onToggleChat} />
            </div>
        </header>
    );
}

function FilePanelToggle({
    open,
    onToggle,
}: {
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="no-drag size-7"
            aria-label={open ? "Hide file panel" : "Show file panel"}
            onClick={onToggle}
        >
            {open ? (
                <PanelLeftClose className="size-4" />
            ) : (
                <PanelLeftOpen className="size-4" />
            )}
        </Button>
    );
}

function AppBrand() {
    return (
        <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <span className="text-sm font-semibold">openbook</span>
        </div>
    );
}

function WorkspaceMenu({
    workspaceName,
    onSwitchWorkspace,
    onCloseWorkspace,
}: {
    workspaceName: string;
    onSwitchWorkspace: () => void;
    onCloseWorkspace: () => void;
}) {
    return (
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
    );
}

function ThemeToggle({
    dark,
    onToggle,
}: {
    dark: boolean;
    onToggle: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="no-drag size-7"
            aria-label="Toggle dark mode"
            onClick={onToggle}
        >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
    );
}

function ChatPanelToggle({
    open,
    onToggle,
}: {
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="no-drag size-7"
            aria-label={open ? "Hide chat panel" : "Show chat panel"}
            onClick={onToggle}
        >
            {open ? (
                <PanelRightClose className="size-4" />
            ) : (
                <PanelRightOpen className="size-4" />
            )}
        </Button>
    );
}
