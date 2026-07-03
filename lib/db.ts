import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Use a fixed absolute path — critical for Next.js where cwd can shift between workers
const DB_PATH = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(process.cwd(), "data", "openbook.db");

let db: Database.Database | null = null;

export function getDbPath(): string {
    return DB_PATH;
}

export function getDb(): Database.Database {
    if (db) return db;

    // Ensure data directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`[DB] Opening database at: ${DB_PATH}`);

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);

    // Log counts for debugging
    const docCount = db
        .prepare("SELECT COUNT(*) as count FROM documents")
        .get() as any;
    const chunkCount = db
        .prepare("SELECT COUNT(*) as count FROM chunks")
        .get() as any;
    console.log(
        `[DB] Initialized — ${docCount.count} documents, ${chunkCount.count} chunks`,
    );

    return db;
}

function initSchema(db: Database.Database) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('pdf', 'txt', 'md', 'docx', 'url')),
      content TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notes_document_id ON notes(document_id);

    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      citations TEXT,
      document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chat_history_document_id ON chat_history(document_id);
  `);
}

export function resetDb() {
    if (db) {
        db.close();
        db = null;
    }
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
    }
    return getDb();
}
