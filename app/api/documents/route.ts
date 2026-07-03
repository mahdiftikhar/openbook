import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { chunkText } from "@/lib/chunker";
import { v4 as uuidv4 } from "uuid";
import type { Document, DocumentUpload } from "@/types";

// GET /api/documents - List all documents
export async function GET() {
    try {
        const db = getDb();
        const documents = db
            .prepare(
                "SELECT id, title, filename, type, size_bytes, created_at, updated_at FROM documents ORDER BY created_at DESC",
            )
            .all() as Document[];

        return NextResponse.json({ documents });
    } catch (error) {
        console.error("Failed to list documents:", error);
        return NextResponse.json(
            { error: "Failed to list documents" },
            { status: 500 },
        );
    }
}

// POST /api/documents - Upload a new document
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const title = formData.get("title") as string | null;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 },
            );
        }

        // Read file content
        const buffer = Buffer.from(await file.arrayBuffer());
        let content: string;

        // Parse based on file type
        if (file.type === "application/pdf") {
            try {
                const pdfParse = (await import("pdf-parse")).default;
                const pdfData = await pdfParse(buffer);
                content = pdfData.text;
            } catch (err) {
                console.error("PDF parse error:", err);
                return NextResponse.json(
                    {
                        error: "Failed to parse PDF. The file may be encrypted or corrupted.",
                    },
                    { status: 400 },
                );
            }
        } else if (
            file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
            try {
                const mammoth = await import("mammoth");
                const result = await mammoth.extractRawText({ buffer });
                content = result.value;
            } catch (err) {
                console.error("DOCX parse error:", err);
                return NextResponse.json(
                    { error: "Failed to parse DOCX file." },
                    { status: 400 },
                );
            }
        } else {
            // TXT, MD, or other text formats
            content = new TextDecoder().decode(buffer);
        }

        if (!content || content.trim().length === 0) {
            return NextResponse.json(
                { error: "No readable text content found in the file." },
                { status: 400 },
            );
        }

        // Determine file type
        let docType: Document["type"] = "txt";
        if (file.type === "application/pdf") docType = "pdf";
        else if (file.type.includes("markdown") || file.name.endsWith(".md"))
            docType = "md";
        else if (file.type.includes("wordprocessing")) docType = "docx";

        const docId = uuidv4();
        const docTitle = title || file.name.replace(/\.[^/.]+$/, "");

        // Chunk the content
        const chunks = chunkText(content);
        console.log(
            `[Upload] Document "${docTitle}" → ${chunks.length} chunks`,
        );

        // Save document and chunks in a single transaction
        const db = getDb();
        const saveAll = db.transaction(() => {
            // Insert document
            db.prepare(
                `INSERT INTO documents (id, title, filename, type, content, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`,
            ).run(docId, docTitle, file.name, docType, content, buffer.length);

            // Insert chunks
            const insertChunk = db.prepare(
                `INSERT INTO chunks (id, document_id, content, embedding, chunk_index)
         VALUES (?, ?, ?, ?, ?)`,
            );

            for (let i = 0; i < chunks.length; i++) {
                insertChunk.run(uuidv4(), docId, chunks[i], "[]", i);
            }

            console.log(
                `[Upload] Stored document + ${chunks.length} chunks in transaction`,
            );
        });

        try {
            saveAll();
        } catch (err) {
            console.error("[Upload] Transaction failed:", err);
            return NextResponse.json(
                { error: "Failed to save document" },
                { status: 500 },
            );
        }

        // Verify it was saved
        const verify = db
            .prepare(
                "SELECT COUNT(*) as count FROM chunks WHERE document_id = ?",
            )
            .get(docId) as any;
        console.log(
            `[Upload] Verified: ${verify.count} chunks in DB for document ${docId}`,
        );

        return NextResponse.json({
            document: {
                id: docId,
                title: docTitle,
                filename: file.name,
                type: docType,
                size_bytes: buffer.length,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("Failed to upload document:", error);
        return NextResponse.json(
            { error: "Failed to upload document" },
            { status: 500 },
        );
    }
}

// DELETE /api/documents?id=xxx - Delete a document
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "No document id provided" },
                { status: 400 },
            );
        }

        const db = getDb();
        db.prepare("DELETE FROM documents WHERE id = ?").run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete document:", error);
        return NextResponse.json(
            { error: "Failed to delete document" },
            { status: 500 },
        );
    }
}
