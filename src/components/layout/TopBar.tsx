import {
    PanelLeftOpen,
    PanelLeftClose,
    PanelRightOpen,
    PanelRightClose,
    BookOpenText,
    Check,
    Moon,
    Palette,
    Sun,
    ChevronDown,
    FolderSync,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { runtimeApi } from "@/renderer/api/runtimeApi";

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
    const isMac = runtimeApi.platform === "darwin";
    return (
        <header
            className={
                "drag-region relative flex h-9 shrink-0 items-center gap-2 border-b border-border/70 bg-surface-topbar/95 py-1 shadow-[0_1px_0_rgb(255_255_255/0.03)] backdrop-blur-xl " +
                (isMac ? "pl-19 pr-3" : "px-3")
            }
        >
            <FilePanelToggle open={filesOpen} onToggle={onToggleFiles} />
            <AppBrand />
            <div className="mx-1 h-4 w-px bg-border/80" />
            <WorkspaceMenu
                workspaceName={workspaceName}
                onSwitchWorkspace={onSwitchWorkspace}
                onCloseWorkspace={onCloseWorkspace}
            />

            <div className="ml-auto flex items-center gap-0.5">
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
            className="no-drag size-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label={open ? "Hide file panel" : "Show file panel"}
            title={open ? "Hide library" : "Show library"}
            aria-pressed={open}
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
        <div className="flex items-center gap-2 pr-0.5">
            <span className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-background/35 text-muted-foreground">
                <BookOpenText className="size-3.5" strokeWidth={1.9} />
            </span>
            <span className="text-[13px] font-semibold tracking-tight">
                openbook
            </span>
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
                    className="no-drag h-8 max-w-64 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    title={`Workspace: ${workspaceName}`}
                >
                    {workspaceName}
                    <ChevronDown className="size-3 opacity-60" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="truncate text-xs font-medium text-muted-foreground">
                    {workspaceName}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
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
                    className="no-drag size-8 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label="Change theme"
                    title="Appearance"
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
                        {theme.id === themeId && (
                            <Check className="ml-auto size-4" />
                        )}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Mode</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onThemeModeChange("light")}>
                    <Sun className="size-4" />
                    Light
                    {themeMode === "light" && (
                        <Check className="ml-auto size-4" />
                    )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onThemeModeChange("dark")}>
                    <Moon className="size-4" />
                    Dark
                    {themeMode === "dark" && (
                        <Check className="ml-auto size-4" />
                    )}
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
            className="no-drag size-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label={open ? "Hide notes panel" : "Show notes panel"}
            title={open ? "Hide document" : "Show document"}
            aria-pressed={open}
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
