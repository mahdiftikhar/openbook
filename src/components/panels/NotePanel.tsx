import { useEffect, useRef, useState } from "react";
import { FileText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const AUTOSAVE_DELAY = 600;

function firstName(line: string): string {
  return line
    .trim()
    .split("\n")[0]
    .replace(/^\s*#+\s*/, "")
    .trim();
}

export function NotePanel({
  workspacePath,
  notePath,
  onChangeNotePath,
  onNotesChanged,
}: {
  workspacePath: string;
  notePath: string | null;
  onChangeNotePath: (path: string | null) => void;
  onNotesChanged: () => void;
}) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    const timer = setTimeout(async () => {
      const path = currentPathRef.current;
      if (path) await performSave(content, path);
      setDirty(false);
      setSaving(false);
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [content, dirty, loaded, notePath]);

  const handleBlurSave = async () => {
    if (!dirty) return;
    const path = currentPathRef.current;
    if (!path) return;
    setSaving(true);
    await performSave(content, path);
    setDirty(false);
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!notePath) return;
    const ok = await window.electron.notes.delete(notePath);
    if (!ok) return;
    onChangeNotePath(null);
    onNotesChanged();
  };

  if (!notePath) {
    return (
      <section className="flex h-full flex-col items-center justify-center bg-background text-muted-foreground">
        <FileText className="size-8 opacity-40" />
        <p className="mt-3 text-sm">Select a note or create a new one.</p>
      </section>
    );
  }

  const fileName = notePath.split(/[/\\]/).pop() ?? notePath;
  const relativeDir = notePath
    .slice(workspacePath.length)
    .split(/[/\\]+/)
    .filter(Boolean)
    .slice(0, -1)
    .join(" / ");

  return (
    <section className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{fileName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {relativeDir}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">
            {saving ? "Saving..." : dirty ? "Unsaved" : "Saved"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Delete note"
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {loaded ? (
        <textarea
          ref={editorRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          onBlur={handleBlurSave}
          className="min-h-0 flex-1 resize-none bg-transparent px-4 pb-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          placeholder="Start writing..."
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          Loading...
        </div>
      )}
    </section>
  );
}