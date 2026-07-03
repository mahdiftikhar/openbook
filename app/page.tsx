"use client";

import React, { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatPanel from "@/components/ChatPanel";
import NotesEditor from "@/components/NotesEditor";
import UploadDialog from "@/components/UploadDialog";
import { BookOpen, FileText } from "lucide-react";
import type { Document, Note, ChatMessage } from "@/types";

export default function HomePage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
        null,
    );
    const [activeNote, setActiveNote] = useState<Note | null>(null);
    const [activeTab, setActiveTab] = useState<"chat" | "notes">("chat");
    const [uploadOpen, setUploadOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Hydration guard
    useEffect(() => setMounted(true), []);

    // Load documents and notes
    const loadData = useCallback(async () => {
        try {
            const [docsRes, notesRes] = await Promise.all([
                fetch("/api/documents"),
                fetch("/api/notes"),
            ]);

            if (docsRes.ok) {
                const { documents: docs } = await docsRes.json();
                setDocuments(docs);
            }
            if (notesRes.ok) {
                const { notes: n } = await notesRes.json();
                setNotes(n);
            }
        } catch (error) {
            console.error("Failed to load data:", error);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Handle document upload
    const handleUpload = async (file: File, title: string) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", title);

        const res = await fetch("/api/documents", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const { error } = await res.json();
            throw new Error(error || "Upload failed");
        }

        await loadData();
    };

    // Handle document deletion
    const handleDeleteDocument = async (id: string) => {
        if (!confirm("Delete this document and all its data?")) return;

        await fetch(`/api/documents?id=${id}`, { method: "DELETE" });

        if (activeDocumentId === id) {
            setActiveDocumentId(null);
            setMessages([]);
        }
        await loadData();
    };

    // Handle sending a chat message
    const handleSendMessage = async (content: string) => {
        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content,
            created_at: new Date().toISOString(),
            document_id: activeDocumentId,
        };

        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const history = messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .slice(-10)
                .map((m) => ({ role: m.role, content: m.content }));

            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: content,
                    documentId: activeDocumentId,
                    history,
                }),
            });

            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error || "Chat failed");
            }

            const data = await res.json();

            const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.message || "No response generated.",
                citations: data.citations || [],
                created_at: new Date().toISOString(),
                document_id: activeDocumentId,
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
                created_at: new Date().toISOString(),
                document_id: activeDocumentId,
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle saving a note
    const handleSaveNote = async (note: {
        id?: string;
        title: string;
        content: string;
    }) => {
        const res = await fetch("/api/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: note.id,
                title: note.title,
                content: note.content,
                document_id: activeDocumentId,
            }),
        });

        if (res.ok) {
            const { note: saved } = await res.json();
            setActiveNote(saved);
            await loadData();
        }
    };

    // Handle deleting a note
    const handleDeleteNote = async (id: string) => {
        await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
        setActiveNote(null);
        await loadData();
    };

    const activeDocument = documents.find((d) => d.id === activeDocumentId);

    if (!mounted) return null;

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <Sidebar
                documents={documents}
                notes={notes}
                activeDocumentId={activeDocumentId}
                activeTab={activeTab}
                onSelectDocument={(doc) => {
                    setActiveDocumentId(doc?.id || null);
                    setMessages([]);
                    setActiveTab("chat");
                    setActiveNote(null);
                }}
                onSelectNote={(note) => {
                    setActiveNote(note);
                    setActiveTab("notes");
                }}
                onUploadClick={() => setUploadOpen(true)}
                onDeleteDocument={handleDeleteDocument}
                onNewNote={() => {
                    setActiveNote({
                        id: "",
                        title: "",
                        content: "",
                        document_id: activeDocumentId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                    setActiveTab("notes");
                }}
                onTabChange={(tab) => {
                    setActiveTab(tab);
                    if (tab === "chat") setActiveNote(null);
                }}
            />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {activeTab === "chat" ? (
                    <ChatPanel
                        messages={messages}
                        onSend={handleSendMessage}
                        isLoading={isLoading}
                        documentTitle={activeDocument?.title || null}
                    />
                ) : activeNote ? (
                    <NotesEditor
                        note={activeNote.id ? activeNote : null}
                        onSave={handleSaveNote}
                        onDelete={activeNote.id ? handleDeleteNote : undefined}
                        onBack={() => setActiveNote(null)}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center p-8 max-w-md">
                            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <BookOpen className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">
                                OpenBook Notes
                            </h2>
                            <p className="text-muted-foreground mb-6">
                                Create and manage your research notes. Notes
                                support markdown formatting.
                            </p>
                            <button
                                onClick={() => {
                                    setActiveNote({
                                        id: "",
                                        title: "",
                                        content: "",
                                        document_id: activeDocumentId,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                    });
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                <FileText className="h-4 w-4" />
                                Create Your First Note
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Upload Dialog */}
            <UploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUpload={handleUpload}
            />
        </div>
    );
}
