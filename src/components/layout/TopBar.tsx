import {
    PanelLeftOpen,
    PanelLeftClose,
    PanelRightOpen,
    PanelRightClose,
    BookOpen,
    Check,
    Moon,
    Palette,
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEMES, type ThemeId, type ThemeMode } from "@/themes";

export function TopBar({
    workspaceName,
    filesOpen,
    onToggleFiles,
    notesOpen,
    onToggleNotes,
    themeId,
    themeMode,
    onThemeChange,
    onThemeModeChange,
    onSwitchWorkspace,
    onCloseWorkspace,
}: {
    workspaceName: string;
    filesOpen: boolean;
    onToggleFiles: () => void;
    notesOpen: boolean;
    onToggleNotes: () => void;
    themeId: ThemeId;
    themeMode: ThemeMode;
    onThemeChange: (themeId: ThemeId) => void;
    onThemeModeChange: (themeMode: ThemeMode) => void;
    onSwitchWorkspace: () => void;
    onCloseWorkspace: () => void;
}) {
    const isMac = window.electron?.platform === "darwin";
    return (
        <header
            className={
                "drag-region flex items-center gap-2 border-b bg-surface-topbar py-1 " +
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
                <ThemeMenu
                    themeId={themeId}
                    themeMode={themeMode}
                    onThemeChange={onThemeChange}
                    onThemeModeChange={onThemeModeChange}
                />
                <NotesPanelToggle open={notesOpen} onToggle={onToggleNotes} />
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

function ThemeMenu({
    themeId,
    themeMode,
    onThemeChange,
    onThemeModeChange,
}: {
    themeId: ThemeId;
    themeMode: ThemeMode;
    onThemeChange: (themeId: ThemeId) => void;
    onThemeModeChange: (themeMode: ThemeMode) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="no-drag size-7"
                    aria-label="Change theme"
                >
                    <Palette className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                {THEMES.map((theme) => (
                    <DropdownMenuItem
                        key={theme.id}
                        onClick={() => onThemeChange(theme.id)}
                    >
                        {theme.name}
                        {theme.id === themeId && <Check className="ml-auto size-4" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Mode</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onThemeModeChange("light")}>
                    <Sun className="size-4" />
                    Light
                    {themeMode === "light" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onThemeModeChange("dark")}>
                    <Moon className="size-4" />
                    Dark
                    {themeMode === "dark" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function NotesPanelToggle({
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
            aria-label={open ? "Hide notes panel" : "Show notes panel"}
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
