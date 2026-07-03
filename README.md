# OpenBook — AI Research Notebook

An open-source clone of **Google's NotebookLM**. Upload documents, ask questions, get AI-powered answers with source citations, and take research notes — all in one place.

## Features

- **Document Upload** — Support for PDF, TXT, Markdown, and DOCX files
- **AI-Powered Chat** — Ask questions about your documents and get grounded answers with source citations
- **Semantic Search** — Documents are chunked and embedded for intelligent retrieval (RAG)
- **Research Notes** — Create, edit, and organize notes with Markdown support
- **Source Citations** — Every AI response cites the specific documents and passages it used
- **Clean UI** — Dark mode ready, keyboard shortcuts, drag-and-drop uploads
- **Local-First** — All data stored locally in SQLite; your documents never leave your machine except for AI processing

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui, Lucide Icons
- **AI**: DeepSeek API (deepseek-chat / deepseek-reasoner)
- **Search**: TF-IDF keyword search (local, no embedding API needed)
- **Database**: SQLite (via better-sqlite3)
- **PDF Parsing**: pdf-parse
- **DOCX Parsing**: mammoth

## Getting Started

### Prerequisites

- Node.js 18+
- A [DeepSeek API key](https://platform.deepseek.com/api_keys)

### Setup

1. **Clone and install dependencies:**

```bash
cd openbook
npm install
```

2. **Set up environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and add your DeepSeek API key:

```
DEEPSEEK_API_KEY=sk-your-actual-key-here
```

3. **Start the development server:**

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload a document** — Click "Upload Document" in the sidebar, or drag & drop a PDF, TXT, MD, or DOCX file
2. **Chat with your documents** — Select a document (or "All Documents") and ask questions in the chat panel
3. **View source citations** — Expand source citations below AI responses to see exactly where information came from
4. **Take notes** — Switch to the Notes tab, create research notes, and save them with markdown formatting

## Project Structure

```
openbook/
├── app/
│   ├── api/
│   │   ├── chat/route.ts        # Chat API with RAG
│   │   ├── documents/route.ts   # Document upload & management
│   │   └── notes/route.ts       # Notes CRUD
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # Main app page
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── ChatPanel.tsx            # Chat interface
│   ├── NotesEditor.tsx          # Note editor
│   ├── Sidebar.tsx              # Navigation sidebar
│   └── UploadDialog.tsx         # File upload dialog
├── lib/
│   ├── ai.ts                    # AI chat completion (DeepSeek)
│   ├── chunker.ts               # Document chunking
│   ├── db.ts                    # SQLite database
│   ├── deepseek.ts              # DeepSeek API client
│   ├── embeddings.ts            # TF-IDF keyword search
│   └── utils.ts                 # Utilities
└── types/
    └── index.ts                 # TypeScript types
```



## How It Works

1. **Upload**: Documents are uploaded, parsed (PDF, DOCX, etc.), and stored in SQLite.
2. **Chunking**: Text is split into overlapping chunks (~500 chars each).
3. **Query**: When you ask a question, TF-IDF keyword scoring finds the most relevant chunks.
4. **Generation**: The top 5 chunks are sent as context to DeepSeek, which generates a grounded answer with citations.

All search runs locally — no embedding API costs. Only the final chat completion calls DeepSeek.

## Limitations

- Requires an OpenAI API key (costs apply for embeddings and chat completions)
- PDF parsing may not work well with scanned/image-based PDFs (OCR not included)
- No authentication/multi-user support
- Embedding generation happens after upload (async); there may be a brief delay before new documents are searchable

## License

MIT
