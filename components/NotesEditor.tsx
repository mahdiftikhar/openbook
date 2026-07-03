"use client";

import React, { useState } from "react";
import { Save, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TextareaAutosize from "react-textarea-autosize";
import type { Note } from "@/types";

interface NotesEditorProps {
  note: Note | null;
  onSave: (note: { id?: string; title: string; content: string }) => void;
  onDelete?: (id: string) => void;
  onBack: () => void;
}

export default function NotesEditor({ note, onSave, onDelete, onBack }: NotesEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges =
    title !== (note?.title || "") || content !== (note?.content || "");

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        id: note?.id,
        title: title || "Untitled Note",
        content,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChanges, title, content]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="border-0 shadow-none text-lg font-semibold focus-visible:ring-0 px-0 h-auto"
        />
        <div className="flex items-center gap-1 ml-auto">
          {hasChanges && (
            <span className="text-xs text-muted-foreground mr-2">Unsaved</span>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {note && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm("Delete this note?")) {
                  onDelete(note.id);
                  onBack();
                }
              }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto p-6">
        <TextareaAutosize
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing your note... Use markdown for formatting."
          className="w-full resize-none border-0 shadow-none focus-visible:ring-0 text-sm leading-relaxed bg-transparent min-h-[300px]"
          minRows={10}
        />
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 flex items-center justify-between shrink-0">
        <p className="text-xs text-muted-foreground">
          {content.length} characters • Markdown supported • {String.fromCharCode(8984)}+S to save
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
