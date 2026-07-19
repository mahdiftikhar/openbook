import fs from "node:fs";
import path from "node:path";
import SqliteDatabase from "better-sqlite3";
import {
    drizzle,
    type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { load as loadSqliteVec } from "sqlite-vec";

import { WORKSPACE_DIRS } from "../../../workspaceLayout";

export interface IndexDatabase {
    orm: BetterSQLite3Database;
    sqlite: SqliteDatabase.Database;
}

export function getIndexDatabasePath(workspacePath: string): string {
    return path.join(workspacePath, WORKSPACE_DIRS.metadata, "index.sqlite");
}

function runSchema(db: SqliteDatabase.Database): void {
    db.exec(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS index_metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL CHECK (kind IN ('pdf', 'note')),
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            source_file_name TEXT,
            status TEXT NOT NULL CHECK (status IN ('pending', 'chunking', 'embedding', 'ready', 'error', 'stale')),
            content_hash TEXT,
            error TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            indexed_at TEXT,
            UNIQUE(kind, file_path)
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            text TEXT NOT NULL,
            page INTEGER,
            start_offset INTEGER,
            end_offset INTEGER,
            content_hash TEXT NOT NULL,
            token_estimate INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
            UNIQUE(document_id, chunk_index)
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
            text,
            chunk_id UNINDEXED,
            document_id UNINDEXED
        );

        CREATE TABLE IF NOT EXISTS chunk_embeddings (
            chunk_id INTEGER PRIMARY KEY,
            vector_rowid INTEGER NOT NULL UNIQUE,
            embedding_model TEXT NOT NULL,
            embedding_dimensions INTEGER NOT NULL,
            embedding BLOB NOT NULL,
            content_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
        CREATE INDEX IF NOT EXISTS idx_documents_kind_file_path ON documents(kind, file_path);
        CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
    `);
}

export function openIndexDatabase(workspacePath: string): IndexDatabase {
    const databasePath = getIndexDatabasePath(workspacePath);
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });

    const db = new SqliteDatabase(databasePath);
    loadSqliteVec(db);
    runSchema(db);
    return {
        orm: drizzle(db),
        sqlite: db,
    };
}

export function withIndexDatabase<T>(
    workspacePath: string,
    callback: (db: IndexDatabase) => T,
): T {
    const db = openIndexDatabase(workspacePath);
    try {
        return callback(db);
    } finally {
        db.sqlite.close();
    }
}
