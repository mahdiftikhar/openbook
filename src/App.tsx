import { useEffect, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";

import { TopBar } from "@/components/layout/TopBar";
import { FilePanel } from "@/components/panels/FilePanel";
import { NotePanel } from "@/components/panels/NotePanel";
import { PdfViewer } from "@/components/panels/PdfViewer";
import { ChatPanel } from "@/components/panels/ChatPanel";
import { Onboarding } from "@/components/Onboarding";

function ResizeHandle() {
    return (
        <Separator
            className="relative w-px shrink-0 bg-border transition-colors hover:bg-primary/50 data-[separator=active]:bg-primary data-[separator=focus]:bg-primary/70"
            style={{ outline: "none" }}
        />
    );
}

export function App() {
    const filePanelRef = usePanelRef();
    const notePanelRef = usePanelRef();
    const [filesOpen, setFilesOpen] = useState(true);
    const [notesOpen, setNotesOpen] = useState(true);
    const [dark, setDark] = useState(true);
    const [workspacePath, setWorkspacePath] = useState<string | null>(null);
    const [checkingWorkspace, setCheckingWorkspace] = useState(true);
    const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
    const [activePdfPage, setActivePdfPage] = useState<number | null>(null);
    const [notesVersion, setNotesVersion] = useState(0);

    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
    }, [dark]);

    useEffect(() => {
        window.electron.workspace.getPath().then((savedPath) => {
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

    if (checkingWorkspace) return null;

    if (!workspacePath) {
        return <Onboarding onComplete={setWorkspacePath} />;
    }

    const handleSwitchWorkspace = async () => {
        const newPath = await window.electron.workspace.pickExisting();
        if (newPath) setWorkspacePath(newPath);
    };

    const handleCloseWorkspace = async () => {
        await window.electron.workspace.clear();
        setWorkspacePath(null);
        setActiveNotePath(null);
        setActivePdfPage(null);
    };

    const handleOpenFile = (filePath: string | null) => {
        setActivePdfPage(null);
        setActiveNotePath(filePath);
    };

    const handleOpenCitation = (citation: ChatCitation) => {
        setActivePdfPage(citation.page);
        setActiveNotePath(citation.filePath);
    };

    const workspaceName = workspacePath.split(/[/\\]/).pop() || workspacePath;
    const isPdf = activeNotePath?.endsWith(".pdf");

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
            <TopBar
                workspaceName={workspaceName}
                filesOpen={filesOpen}
                onToggleFiles={() => togglePanel(filePanelRef)}
                notesOpen={notesOpen}
                onToggleNotes={() => togglePanel(notePanelRef)}
                dark={dark}
                onToggleDark={() => setDark((v) => !v)}
                onSwitchWorkspace={handleSwitchWorkspace}
                onCloseWorkspace={handleCloseWorkspace}
            />
            <div className="min-h-0 flex-1">
                <Group orientation="horizontal" className="h-full w-full">
                    <Panel
                        panelRef={filePanelRef}
                        defaultSize="16%"
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
                            refreshKey={notesVersion}
                            onOpenNote={handleOpenFile}
                            onNotesChanged={() => setNotesVersion((v) => v + 1)}
                        />
                    </Panel>

                    <ResizeHandle />

                    <Panel
                        defaultSize="54%"
                        minSize="40%"
                        style={{ overflow: "hidden" }}
                    >
                        <ChatPanel
                            workspacePath={workspacePath}
                            sourcesRefreshKey={notesVersion}
                            onOpenCitation={handleOpenCitation}
                        />
                    </Panel>

                    <ResizeHandle />

                    <Panel
                        panelRef={notePanelRef}
                        defaultSize="30%"
                        minSize="20%"
                        maxSize="44%"
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
