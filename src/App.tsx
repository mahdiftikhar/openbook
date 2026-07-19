import { useEffect, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { BookOpenText, LoaderCircle } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { FilePanel } from "@/components/panels/FilePanel";
import { NotePanel } from "@/components/panels/NotePanel";
import { PdfViewer } from "@/components/panels/PdfViewer";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { Onboarding } from "@/components/Onboarding";
import { workspaceApi } from "@/renderer/api/workspaceApi";
import type { ChatCitation, TextExcerpt } from "@/shared/types";
import {
    DEFAULT_THEME_ID,
    DEFAULT_THEME_MODE,
    THEME_MODE_STORAGE_KEY,
    THEME_STORAGE_KEY,
    THEMES,
    isThemeId,
    isThemeMode,
    type ThemeId,
    type ThemeMode,
} from "@/themes";

function ResizeHandle() {
    return (
        <Separator
            className="group relative z-10 w-px shrink-0 bg-border/70 transition-colors after:absolute after:inset-y-0 after:-left-1 after:w-2 hover:bg-primary/60 data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/70"
            style={{ outline: "none" }}
        />
    );
}

function AppLoadingState() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-surface-shell text-foreground">
            <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                <span className="flex size-9 items-center justify-center rounded-xl border border-border/70 bg-card shadow-sm">
                    <BookOpenText className="size-4 text-primary" />
                </span>
                <span>Opening your research space</span>
                <LoaderCircle className="size-4 animate-spin text-primary" />
            </div>
        </div>
    );
}

export function App() {
    const filePanelRef = usePanelRef();
    const notePanelRef = usePanelRef();
    const [filesOpen, setFilesOpen] = useState(true);
    const [notesOpen, setNotesOpen] = useState(false);
    const [themeId, setThemeId] = useState<ThemeId>(() => {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isThemeId(storedTheme) ? storedTheme : DEFAULT_THEME_ID;
    });
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        const storedMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
        return isThemeMode(storedMode) ? storedMode : DEFAULT_THEME_MODE;
    });
    const [workspacePath, setWorkspacePath] = useState<string | null>(null);
    const [checkingWorkspace, setCheckingWorkspace] = useState(true);
    const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
    const [activePdfPage, setActivePdfPage] = useState<number | null>(null);
    const [highlightText, setHighlightText] = useState<string | null>(null);
    const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>(
        [],
    );
    const [contextTexts, setContextTexts] = useState<TextExcerpt[]>([]);
    const [notesVersion, setNotesVersion] = useState(0);

    useEffect(() => {
        const root = document.documentElement;

        root.classList.toggle("dark", themeMode === "dark");
        for (const theme of THEMES) {
            root.classList.toggle(theme.className, theme.id === themeId);
        }

        window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
    }, [themeId, themeMode]);

    useEffect(() => {
        workspaceApi.getPath().then((savedPath) => {
            setWorkspacePath(savedPath);
            setCheckingWorkspace(false);
        });
    }, []);

    const togglePanel = (ref: ReturnType<typeof usePanelRef>) => {
        const panel = ref.current;
        if (!panel) return;
        if (panel.isCollapsed()) {
            panel.expand();
        } else {
            panel.collapse();
        }
    };

    if (checkingWorkspace) return <AppLoadingState />;

    if (!workspacePath) {
        return <Onboarding onComplete={setWorkspacePath} />;
    }

    const handleSwitchWorkspace = async () => {
        const newPath = await workspaceApi.pickExisting();
        if (newPath) setWorkspacePath(newPath);
    };

    const handleCloseWorkspace = async () => {
        await workspaceApi.clear();
        setWorkspacePath(null);
        setActiveNotePath(null);
        setActivePdfPage(null);
        setHighlightText(null);
        setSelectedSourceNames([]);
        setContextTexts([]);
    };

    const handleOpenFile = (filePath: string | null) => {
        setActivePdfPage(null);
        setHighlightText(null);
        setActiveNotePath(filePath);
        if (filePath) {
            if (notePanelRef.current?.isCollapsed()) {
                const fileSize =
                    filePanelRef.current?.getSize().asPercentage ?? 16;
                notePanelRef.current?.resize(`${(100 - fileSize) / 2}`);
            }
            setNotesOpen(true);
        }
    };

    const handleOpenCitation = (citation: ChatCitation) => {
        setActivePdfPage(citation.page);
        setHighlightText(citation.excerpt);
        setActiveNotePath(citation.filePath);
        if (notePanelRef.current?.isCollapsed()) {
            const fileSize = filePanelRef.current?.getSize().asPercentage ?? 16;
            notePanelRef.current?.resize(`${(100 - fileSize) / 2}`);
        }
        setNotesOpen(true);
    };

    const handleAddTextContext = (excerpt: TextExcerpt) => {
        setContextTexts((current) => [...current, excerpt]);
    };

    const workspaceName = workspacePath.split(/[/\\]/).pop() || workspacePath;
    const isPdf = activeNotePath?.endsWith(".pdf");

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-shell text-foreground">
            <TopBar
                workspaceName={workspaceName}
                filesOpen={filesOpen}
                onToggleFiles={() => togglePanel(filePanelRef)}
                notesOpen={notesOpen}
                onToggleNotes={() => togglePanel(notePanelRef)}
                themeId={themeId}
                themeMode={themeMode}
                onThemeChange={setThemeId}
                onThemeModeChange={setThemeMode}
                onSwitchWorkspace={handleSwitchWorkspace}
                onCloseWorkspace={handleCloseWorkspace}
            />
            <div className="min-h-0 flex-1">
                <Group orientation="horizontal" className="h-full w-full">
                    <Panel
                        panelRef={filePanelRef}
                        defaultSize="14%"
                        minSize="12%"
                        maxSize="26%"
                        collapsible
                        collapsedSize="0%"
                        onResize={() =>
                            setFilesOpen(!filePanelRef.current?.isCollapsed())
                        }
                        style={{ overflow: "hidden" }}
                    >
                        <FilePanel
                            workspacePath={workspacePath}
                            workspaceName={workspaceName}
                            activeNotePath={activeNotePath}
                            selectedSourceNames={selectedSourceNames}
                            refreshKey={notesVersion}
                            onOpenNote={handleOpenFile}
                            onSelectedSourceNamesChange={setSelectedSourceNames}
                            onNotesChanged={() => setNotesVersion((v) => v + 1)}
                        />
                    </Panel>

                    <ResizeHandle />

                    <Panel
                        defaultSize="54%"
                        minSize="10%"
                        style={{ overflow: "hidden" }}
                    >
                        <ChatPanel
                            workspacePath={workspacePath}
                            sourcesRefreshKey={notesVersion}
                            selectedSourceNames={selectedSourceNames}
                            contextTexts={contextTexts}
                            onSelectedSourceNamesChange={setSelectedSourceNames}
                            onContextTextsChange={setContextTexts}
                            onOpenCitation={handleOpenCitation}
                        />
                    </Panel>

                    <ResizeHandle />

                    <Panel
                        panelRef={notePanelRef}
                        defaultSize="0%"
                        minSize="10%"
                        collapsible
                        collapsedSize="0%"
                        onResize={() =>
                            setNotesOpen(!notePanelRef.current?.isCollapsed())
                        }
                        style={{ overflow: "hidden" }}
                    >
                        {isPdf && activeNotePath ? (
                            <PdfViewer
                                filePath={activeNotePath}
                                targetPage={activePdfPage}
                                highlightText={highlightText}
                                onAddTextContext={handleAddTextContext}
                                onClose={() => handleOpenFile(null)}
                            />
                        ) : (
                            <NotePanel
                                workspacePath={workspacePath}
                                notePath={activeNotePath}
                                onChangeNotePath={handleOpenFile}
                                onNotesChanged={() =>
                                    setNotesVersion((v) => v + 1)
                                }
                            />
                        )}
                    </Panel>
                </Group>
            </div>
        </div>
    );
}
