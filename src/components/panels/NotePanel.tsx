import { useEffect, useRef, useState } from "react";
import { Check, FileText, PenLine } from "lucide-react";

import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { PanelTabBar } from "@/components/panels/PanelTabBar";
import { notesApi } from "@/renderer/api/notesApi";

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
        notesApi.read(notePath).then((text) => {
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
                const renamed = await notesApi.rename(path, head);
                if (renamed) {
                    currentPathRef.current = renamed;
                    onChangeNotePath(renamed);
                    onNotesChanged();
                    await notesApi.write(renamed, text);
                    return;
                }
            }
        }
        await notesApi.write(path, text);
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
        <section className="flex h-full flex-col items-center justify-center bg-surface-reference px-8 text-center text-muted-foreground">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-border/70 bg-background/35 shadow-sm">
                <FileText className="size-5 text-primary/70" />
            </div>
            <h3 className="font-display mt-4 text-lg font-medium text-foreground">
                Open a document
            </h3>
            <p className="mt-1.5 max-w-56 text-xs leading-5">
                Select a note or source from the library to read and annotate it
                here.
            </p>
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
            actions={
                <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                    {dirty ? (
                        <>
                            <PenLine className="size-3 text-primary" />
                            Saving
                        </>
                    ) : (
                        <>
                            <Check className="size-3 text-emerald-500" />
                            Saved
                        </>
                    )}
                </span>
            }
        />
    );
}

function NoteEditor({
    loaded,
    content,
    onContentChange,
    onBlurSave,
}: {
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
        <MarkdownEditor
            value={content}
            onChange={onContentChange}
            onBlur={onBlurSave}
            placeholder="Start writing..."
            className="note-markdown-editor"
        />
    );
}
