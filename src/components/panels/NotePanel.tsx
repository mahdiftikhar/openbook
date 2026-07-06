import { useEffect, useRef, useState, type RefObject } from "react";
import { FileText } from "lucide-react";

import { PanelTabBar } from "@/components/panels/PanelTabBar";

const AUTOSAVE_DELAY = 600;

function firstName(line: string): string {
    return line
        .trim()
        .split("\n")[0]
        .replace(/^\s*#+\s*/, "")
        .trim();
}

export function NotePanel({
    notePath,
    onChangeNotePath,
    onNotesChanged,
}: {
    notePath: string | null;
    onChangeNotePath: (path: string | null) => void;
    onNotesChanged: () => void;
}) {
    const [content, setContent] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [dirty, setDirty] = useState(false);
    const editorRef = useRef<HTMLTextAreaElement | null>(null);
    const currentPathRef = useRef<string | null>(notePath);

    useEffect(() => {
        currentPathRef.current = notePath;
        setLoaded(false);
        setDirty(false);
        if (!notePath) {
            setContent("");
            setLoaded(true);
            return;
        }
        window.electron.notes.read(notePath).then((text) => {
            if (currentPathRef.current !== notePath) return;
            setContent(text ?? "");
            setLoaded(true);
        });
    }, [notePath]);

    const performSave = async (text: string, path: string) => {
        const base = path.split(/[/\\]/).pop() ?? "";
        if (base.startsWith("untitled-")) {
            const head = firstName(text);
            if (head) {
                const renamed = await window.electron.notes.rename(path, head);
                if (renamed) {
                    currentPathRef.current = renamed;
                    onChangeNotePath(renamed);
                    onNotesChanged();
                    await window.electron.notes.write(renamed, text);
                    return;
                }
            }
        }
        await window.electron.notes.write(path, text);
    };

    useEffect(() => {
        if (!loaded || !notePath) return;
        if (!dirty) return;
        const timer = setTimeout(async () => {
            const path = currentPathRef.current;
            if (path) await performSave(content, path);
            setDirty(false);
        }, AUTOSAVE_DELAY);
        return () => clearTimeout(timer);
    }, [content, dirty, loaded, notePath]);

    const handleBlurSave = async () => {
        if (!dirty) return;
        const path = currentPathRef.current;
        if (!path) return;
        await performSave(content, path);
        setDirty(false);
    };

    const handleClose = async () => {
        await handleBlurSave();
        onChangeNotePath(null);
    };

    if (!notePath) {
        return <EmptyNoteState />;
    }

    const fileName = notePath.split(/[/\\]/).pop() ?? notePath;
    return (
        <section className="flex h-full flex-col bg-surface-reference">
            <NoteHeader
                fileName={fileName}
                dirty={dirty}
                onClose={handleClose}
            />
            <NoteEditor
                editorRef={editorRef}
                loaded={loaded}
                content={content}
                onContentChange={(value) => {
                    setContent(value);
                    setDirty(true);
                }}
                onBlurSave={handleBlurSave}
            />
        </section>
    );
}

function EmptyNoteState() {
    return (
        <section className="flex h-full flex-col items-center justify-center bg-surface-reference text-muted-foreground">
            <FileText className="size-8 opacity-40" />
            <p className="mt-3 text-sm">Select a note or create a new one.</p>
        </section>
    );
}

function NoteHeader({
    fileName,
    dirty,
    onClose,
}: {
    fileName: string;
    dirty: boolean;
    onClose: () => void;
}) {
    return (
        <PanelTabBar
            className="bg-surface-reference-header"
            activeTabClassName="border-b-surface-reference bg-surface-reference"
            tabs={[{ id: fileName, title: fileName, dirty, closable: true }]}
            activeTabId={fileName}
            onCloseTab={onClose}
        />
    );
}

function NoteEditor({
    editorRef,
    loaded,
    content,
    onContentChange,
    onBlurSave,
}: {
    editorRef: RefObject<HTMLTextAreaElement>;
    loaded: boolean;
    content: string;
    onContentChange: (value: string) => void;
    onBlurSave: () => void;
}) {
    if (!loaded) {
        return (
            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                Loading...
            </div>
        );
    }

    return (
        <textarea
            ref={editorRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            onBlur={onBlurSave}
            className="min-h-0 flex-1 resize-none bg-transparent px-4 pb-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
            placeholder="Start writing..."
        />
    );
}
