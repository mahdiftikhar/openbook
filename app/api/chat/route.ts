import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { searchByTfidf } from "@/lib/embeddings";
import { generateChatResponse } from "@/lib/ai";
import { v4 as uuidv4 } from "uuid";
import type { Citation } from "@/types";

// POST /api/chat - Send a message and get AI response
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, documentId, history } = body as {
            query: string;
            documentId?: string | null;
            history?: Array<{ role: "user" | "assistant"; content: string }>;
        };

        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "Query is required" },
                { status: 400 },
            );
        }

        const db = getDb();

        // Debug: log what's in the database
        const totalDocs = db
            .prepare("SELECT COUNT(*) as count FROM documents")
            .get() as any;
        const totalChunks = db
            .prepare("SELECT COUNT(*) as count FROM chunks")
            .get() as any;
        console.log(
            `[Chat] DB state: ${totalDocs.count} documents, ${totalChunks.count} chunks total`,
        );

        // Get chunks (just id, content, and document info)
        let chunks: Array<{
            id: string;
            document_id: string;
            content: string;
            document_title: string;
        }>;

        if (documentId) {
            chunks = db
                .prepare(
                    `SELECT c.id, c.document_id, c.content,
                            d.title as document_title
                     FROM chunks c
                     JOIN documents d ON c.document_id = d.id
                     WHERE c.document_id = ?`,
                )
                .all(documentId) as any[];

            console.log(
                `[Chat] Found ${chunks.length} chunks for document ${documentId}`,
            );
        } else {
            chunks = db
                .prepare(
                    `SELECT c.id, c.document_id, c.content,
                            d.title as document_title
                     FROM chunks c
                     JOIN documents d ON c.document_id = d.id`,
                )
                .all() as any[];

            console.log(
                `[Chat] Found ${chunks.length} chunks across all documents`,
            );
        }

        if (chunks.length === 0) {
            return NextResponse.json({
                message:
                    "No documents are available yet. Please upload some documents first, then ask your questions.",
                citations: [],
            });
        }

        // TF-IDF search
        const docs = chunks.map((c) => ({ id: c.id, content: c.content }));
        const results = searchByTfidf(query, docs, 5, 0.02);

        console.log(
            `[Chat] TF-IDF matched ${results.length} chunks for query: "${query}"`,
        );

        if (results.length === 0) {
            return NextResponse.json({
                message:
                    "I couldn't find relevant information in your documents to answer this question. Try rephrasing or ask about a different topic.",
                citations: [],
            });
        }

        // Build context from top results
        const contextChunks = results.map((r) => {
            const chunk = chunks.find((c) => c.id === r.id)!;
            return {
                text: chunk.content,
                documentTitle: chunk.document_title,
                chunkId: chunk.id,
            };
        });

        console.log(
            `[Chat] Sending ${contextChunks.length} context chunks to AI`,
        );

        // Generate DeepSeek response
        const aiResponse = await generateChatResponse({
            query,
            contextChunks,
            conversationHistory: history,
            stream: false,
        });

        // Build citations
        const citations: Citation[] = results
            .filter((_r, i) => i < 3)
            .map((r) => {
                const chunk = chunks.find((c) => c.id === r.id)!;
                return {
                    document_id: chunk.document_id,
                    document_title: chunk.document_title,
                    chunk_id: chunk.id,
                    text:
                        chunk.content.slice(0, 300) +
                        (chunk.content.length > 300 ? "..." : ""),
                    relevance: r.similarity,
                };
            });

        // Save chat history
        const userMsgId = uuidv4();
        const assistantMsgId = uuidv4();

        db.prepare(
            `INSERT INTO chat_history (id, role, content, citations, document_id)
             VALUES (?, 'user', ?, NULL, ?)`,
        ).run(userMsgId, query, documentId || null);

        db.prepare(
            `INSERT INTO chat_history (id, role, content, citations, document_id)
             VALUES (?, 'assistant', ?, ?, ?)`,
        ).run(
            assistantMsgId,
            aiResponse.content,
            JSON.stringify(citations),
            documentId || null,
        );

        return NextResponse.json({
            message: aiResponse.content,
            citations,
            messageIds: { user: userMsgId, assistant: assistantMsgId },
        });
    } catch (error) {
        console.error("Chat error:", error);
        return NextResponse.json(
            { error: "Failed to process chat message" },
            { status: 500 },
        );
    }
}
