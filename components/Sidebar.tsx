"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, FileText, Plus, Trash2, MessageSquare, StickyNote, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatDate, truncate } from "@/lib/utils";
import type { Document, Note } from "@/types";

interface SidebarProps {
  documents: Document[];
  notes: Note[];
  activeDocumentId: string | null;
  activeTab: "chat" | "notes";
  onSelectDocument: (doc: Document | null) => void;
  onSelectNote: (note: Note) => void;
  onUploadClick: () => void;
  onDeleteDocument: (id: string) => void;
  onNewNote: () => void;
  onTabChange: (tab: "chat" | "notes") => void;
}

export default function Sidebar({
  documents,
  notes,
  activeDocumentId,
  activeTab,
  onSelectDocument,
  onSelectNote,
  onUploadClick,
  onDeleteDocument,
  onNewNote,
  onTabChange,
}: SidebarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="flex h-full flex-col border-r bg-card w-72">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg">OpenBook</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => onTabChange("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
            activeTab === "chat"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </button>
        <button
          onClick={() => onTabChange("notes")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
            activeTab === "notes"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <StickyNote className="h-4 w-4" />
          Notes
        </button>
      </div>

      {/* Upload button */}
      <div className="p-3">
        <Button onClick={onUploadClick} className="w-full gap-2" size="sm">
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === "chat" ? (
          <div className="p-2">
            {/* All Documents option */}
            <button
              onClick={() => onSelectDocument(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors mb-1",
                activeDocumentId === null
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50 text-muted-foreground"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium truncate">All Documents</p>
                <p className="text-xs text-muted-foreground">
                  Chat across all sources
                </p>
              </div>
            </button>

            {/* Document list */}
            {documents.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No documents yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload PDFs, text files, and more
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors group mb-1",
                    activeDocumentId === doc.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50 text-muted-foreground"
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(doc.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-2">
            <button
              onClick={onNewNote}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent/50 transition-colors mb-2"
            >
              <Plus className="h-4 w-4" />
              New Note
            </button>

            {notes.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <StickyNote className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No notes yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create notes from your research
                </p>
              </div>
            ) : (
              notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => onSelectNote(note)}
                  className="w-full text-left px-3 py-2.5 rounded-md text-sm hover:bg-accent/50 transition-colors mb-1"
                >
                  <p className="font-medium truncate">{note.title || "Untitled Note"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {truncate(note.content || "Empty note", 60)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(note.updated_at)}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
