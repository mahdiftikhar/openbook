export interface Document {
  id: string;
  title: string;
  filename: string;
  type: "pdf" | "txt" | "md" | "docx" | "url";
  content: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  content: string;
  embedding: number[];
  chunk_index: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  created_at: string;
  document_id: string | null;
}

export interface Citation {
  document_id: string;
  document_title: string;
  chunk_id: string;
  text: string;
  relevance: number;
}

export interface SearchResult {
  chunk: Chunk;
  document: Document;
  similarity: number;
}

export interface DocumentUpload {
  title: string;
  filename: string;
  type: Document["type"];
  content: string;
  size_bytes: number;
}
