import {
    blob,
    index,
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const indexMetadata = sqliteTable("index_metadata", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").notNull(),
});

export const documents = sqliteTable(
    "documents",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        kind: text("kind", { enum: ["pdf", "note"] }).notNull(),
        filePath: text("file_path").notNull(),
        fileName: text("file_name").notNull(),
        sourceFileName: text("source_file_name"),
        status: text("status", {
            enum: [
                "pending",
                "chunking",
                "embedding",
                "ready",
                "error",
                "stale",
            ],
        }).notNull(),
        contentHash: text("content_hash"),
        error: text("error"),
        metadataJson: text("metadata_json").notNull().default("{}"),
        createdAt: text("created_at").notNull(),
        updatedAt: text("updated_at").notNull(),
        indexedAt: text("indexed_at"),
    },
    (table) => ({
        kindFilePathUnique: uniqueIndex(
            "idx_documents_kind_file_path_unique",
        ).on(table.kind, table.filePath),
        statusIndex: index("idx_documents_status").on(table.status),
        kindFilePathIndex: index("idx_documents_kind_file_path").on(
            table.kind,
            table.filePath,
        ),
    }),
);

export const chunks = sqliteTable(
    "chunks",
    {
        id: integer("id").primaryKey({ autoIncrement: true }),
        documentId: integer("document_id")
            .notNull()
            .references(() => documents.id, { onDelete: "cascade" }),
        chunkIndex: integer("chunk_index").notNull(),
        text: text("text").notNull(),
        page: integer("page"),
        startOffset: integer("start_offset"),
        endOffset: integer("end_offset"),
        contentHash: text("content_hash").notNull(),
        tokenEstimate: integer("token_estimate").notNull(),
        createdAt: text("created_at").notNull(),
    },
    (table) => ({
        documentChunkUnique: uniqueIndex("idx_chunks_document_chunk_unique").on(
            table.documentId,
            table.chunkIndex,
        ),
        documentIdIndex: index("idx_chunks_document_id").on(table.documentId),
    }),
);

export const chunkEmbeddings = sqliteTable(
    "chunk_embeddings",
    {
        chunkId: integer("chunk_id")
            .primaryKey()
            .references(() => chunks.id, { onDelete: "cascade" }),
        vectorRowid: integer("vector_rowid").notNull(),
        embeddingModel: text("embedding_model").notNull(),
        embeddingDimensions: integer("embedding_dimensions").notNull(),
        embedding: blob("embedding", { mode: "buffer" }).notNull(),
        contentHash: text("content_hash").notNull(),
        createdAt: text("created_at").notNull(),
    },
    (table) => ({
        vectorRowidUnique: uniqueIndex(
            "idx_chunk_embeddings_vector_rowid_unique",
        ).on(table.vectorRowid),
    }),
);

export const schemaMigrations = sqliteTable("schema_migrations", {
    version: integer("version").primaryKey(),
    appliedAt: text("applied_at").notNull(),
});
