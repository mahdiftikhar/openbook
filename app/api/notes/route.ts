import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { Note } from "@/types";

// GET /api/notes - List all notes
export async function GET() {
  try {
    const db = getDb();
    const notes = db
      .prepare("SELECT * FROM notes ORDER BY updated_at DESC")
      .all() as Note[];

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Failed to list notes:", error);
    return NextResponse.json(
      { error: "Failed to list notes" },
      { status: 500 }
    );
  }
}

// POST /api/notes - Create or update a note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, content, document_id } = body as {
      id?: string;
      title: string;
      content: string;
      document_id?: string | null;
    };

    if (!title && !id) {
      return NextResponse.json(
        { error: "Title is required for new notes" },
        { status: 400 }
      );
    }

    const db = getDb();

    if (id) {
      // Update existing note
      const existing = db.prepare("SELECT id FROM notes WHERE id = ?").get(id);
      if (!existing) {
        return NextResponse.json({ error: "Note not found" }, { status: 404 });
      }

      db.prepare(
        `UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(title, content || "", id);

      const updated = db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as Note;
      return NextResponse.json({ note: updated });
    } else {
      // Create new note
      const noteId = uuidv4();
      db.prepare(
        `INSERT INTO notes (id, title, content, document_id)
         VALUES (?, ?, ?, ?)`
      ).run(noteId, title, content || "", document_id || null);

      const created = db.prepare("SELECT * FROM notes WHERE id = ?").get(noteId) as Note;
      return NextResponse.json({ note: created }, { status: 201 });
    }
  } catch (error) {
    console.error("Failed to save note:", error);
    return NextResponse.json(
      { error: "Failed to save note" },
      { status: 500 }
    );
  }
}

// DELETE /api/notes?id=xxx - Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "No note id provided" }, { status: 400 });
    }

    const db = getDb();
    db.prepare("DELETE FROM notes WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
