import { useEffect, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";

import { TopBar } from "@/components/layout/TopBar";
import { FilePanel } from "@/components/panels/FilePanel";
import { NotePanel } from "@/components/panels/NotePanel";
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
  const chatPanelRef = usePanelRef();
  const [filesOpen, setFilesOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [dark, setDark] = useState(true);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [checkingWorkspace, setCheckingWorkspace] = useState(true);

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
  };

  const workspaceName = workspacePath.split(/[/\\]/).pop() || workspacePath;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        workspaceName={workspaceName}
        filesOpen={filesOpen}
        onToggleFiles={() => togglePanel(filePanelRef)}
        chatOpen={chatOpen}
        onToggleChat={() => togglePanel(chatPanelRef)}
        dark={dark}
        onToggleDark={() => setDark((v) => !v)}
        onSwitchWorkspace={handleSwitchWorkspace}
        onCloseWorkspace={handleCloseWorkspace}
      />
      <div className="min-h-0 flex-1">
        <Group orientation="horizontal" className="h-full w-full">
          <Panel
            panelRef={filePanelRef}
            defaultSize="20%"
            minSize="14%"
            maxSize="32%"
            collapsible
            collapsedSize="0%"
            onResize={() => setFilesOpen(!filePanelRef.current?.isCollapsed())}
            style={{ overflow: "hidden" }}
          >
            <FilePanel
              workspacePath={workspacePath}
              workspaceName={workspaceName}
            />
          </Panel>

          <ResizeHandle />

          <Panel minSize="30%" style={{ overflow: "hidden" }}>
            <NotePanel />
          </Panel>

          <ResizeHandle />

          <Panel
            panelRef={chatPanelRef}
            defaultSize="28%"
            minSize="20%"
            maxSize="42%"
            collapsible
            collapsedSize="0%"
            onResize={() => setChatOpen(!chatPanelRef.current?.isCollapsed())}
            style={{ overflow: "hidden" }}
          >
            <ChatPanel />
          </Panel>
        </Group>
      </div>
    </div>
  );
}
