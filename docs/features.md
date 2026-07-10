# openbook Features

## Current Progress Snapshot

The app is currently in **v0.1.0 foundation work**.

| Area             | Status         | Notes                                                                                                                                                                |
| ---------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace        | Mostly done    | Create/open workspace, create required structure, persist last path, switch/close project.                                                                           |
| Notes            | Mostly done    | Create, open, edit with Markdown syntax highlighting, autosave, rename from first line, delete, and list notes.                                                     |
| Sources          | Partial        | PDF import copies files, extracts text sidecars, stores source metadata, lists/removes sources, and shows ready/error status.                                        |
| PDF viewing      | Partial        | In-app PDF viewer supports page navigation and zoom.                                                                                                                 |
| Web articles     | Missing        | No URL ingestion, fetch, markdown conversion, or indexing yet.                                                                                                       |
| YouTube          | Missing        | No transcript ingestion yet.                                                                                                                                         |
| Indexing/RAG     | Missing        | Extracted text exists for PDFs, but there is no retrieval index, embeddings, or RAG pipeline yet.                                                                    |
| Chat             | Prototype      | Chat can query selected PDF sources with simple keyword retrieval, optional DeepSeek streaming, local fallback responses, cancellation, Markdown-rendered messages, inline context chips, and clickable citations. This still needs a broader context/retrieval redesign. |
| File watcher     | Deferred       | Not needed for the current foundation because the app mostly owns writes through its own UI. Add later when external edits, manual file drops, and automatic re-indexing become core behavior. |
| Settings         | Mostly missing | Workspace switching exists, but no settings UI for LLM provider, API keys, model, or embeddings.                                                                     |
| v0.2.0+ features | Missing        | Persistent chats, chat management, note preview, source enrichment, agent tools, tagging, search, backlinks, and templates are not implemented yet.                  |

## Version History

| Version | Status  |
| ------- | ------- |
| v0.1.0  | Current |
| v0.2.0  | Planned |
| v1.0.0  | Planned |

---

## v0.1.0 — Foundation

### Workspace

- **Workspace selection.** On first launch, prompt user to pick an existing folder or create a new one. The folder is the user's workspace — they own it, they can browse it outside the app.
- **Workspace structure.** The workspace root contains `notes/`, `sources/`, and a hidden `.openbook/` directory for app-managed artifacts (index database, config, cached data).
- **Workspace persistence.** Remember the last-used workspace path. On subsequent launches, open it automatically. Provide a way to switch workspaces from settings.

### Notes

- **Create note.** User creates a new plain-text (markdown) note. The file is written to `workspace/notes/`. Filename derived from the first line or a user-provided title.
- **Open note.** User selects a note from a list/sidebar. Content is loaded and displayed in the editor.
- **Edit note.** User edits the note content in a Markdown editor with syntax highlighting and heading sizing.
- **Save note.** Manual save or autosave. Writes directly to the markdown file on disk.
- **Delete note.** User deletes a note. Removes the file from `workspace/notes/`. Consider soft-delete (trash) or confirmation.
- **List notes.** Sidebar shows all notes in the workspace. Sorted by modification time, name, or custom order.

### Sources

- **Add PDF.** User selects a `.pdf` file. The file is copied to `workspace/sources/`. Text is extracted and indexed.
- **Add web article.** User pastes a URL. The page content is fetched, converted to markdown, and saved to `workspace/sources/`. Text is indexed.
- **Add YouTube video.** User pastes a YouTube URL. The transcript is fetched, converted to markdown, and saved to `workspace/sources/`. Text is indexed.
- **List sources.** Sidebar or separate panel shows all sources in the workspace.
- **Remove source.** User deletes a source. Removes the file and its index entries.
- **Source processing status.** Show the user when a source is being processed (fetching, extracting, indexing) and when it is ready.

### Chat with RAG

Current status: prototype only. The current implementation is useful for proving the loop from selected PDFs to retrieved context to cited answers, but it is not the final chat architecture.

- **Source selection for chat.** User selects one or more sources to use as context for a question. Selected sources and PDF excerpts appear as removable context chips in the composer.
- **Ask question.** User types a Markdown-capable multiline prompt. The selected sources are used as retrieval context.
- **Streaming response.** The LLM response streams token-by-token into the chat panel.
- **Markdown chat messages.** User prompts and assistant responses render Markdown, including headings, lists, code, tables, links, and blockquotes.
- **Citations.** When the LLM references content from a source, the citation is displayed inline (e.g., `[1]`) and clickable — it navigates to the relevant location in the source. There is a known issue where some citation/source opens do not highlight the referenced text.
- **Conversation history.** The chat maintains a scrollable history of messages within a session.
- **Temporary retrieval.** Current retrieval is simple keyword chunk ranking over selected PDFs, not a real embedding/vector index.
- **Temporary chat architecture.** The composer has been improved, but chat is still coupled to selected PDFs and should evolve toward `/` commands, `@` source/tool mentions, notes as context, automatic source search, and prompts without explicit source selection.

### File Watcher

Current status: deferred. A file watcher is not required for the current foundation because openbook mostly creates, edits, imports, and deletes files through its own UI. It becomes important when openbook needs to reliably track external filesystem changes.

- **Monitor workspace.** Watch the `notes/` and `sources/` directories for external changes (user edits a file outside the app, adds a file manually, deletes a file).
- **Re-index on change.** When a source file changes externally, trigger re-extraction and re-indexing.
- **Ignore self-triggered events.** Do not react to file changes caused by the app's own file writes (track recent writes with a short TTL).
- **Notify UI.** Push change events to the renderer so the sidebar can update in near-real-time.

### Settings

- **LLM provider configuration.** User provides API key and selects a provider/model.
- **Embedding configuration.** Choose between local embedding model and provider-hosted embeddings API.
- **Workspace management.** Switch workspace path, see current path.

---

## v0.2.0 — Source Management & Enrichment

### Source Enrichment

- **Re-fetch web sources.** Fetch the latest version of a previously added web article. Detect changes and update the stored copy.
- **Source metadata.** Display source metadata: title, URL, date added, word count, processing status.
- **Source preview.** Click a source to preview its content (read-only) without opening an external app.

### Chat Improvements

- **Persistent chat sessions.** Save and restore chat sessions. Each session has its own message history and linked sources.
- **Chat session management.** List, rename, and delete chat sessions.
- **Multi-turn context.** The LLM retains awareness of the full conversation, not just the latest question.

### Editor

- **Syntax highlighting for markdown.** Code blocks, headings, bold/italic, lists rendered with basic highlighting. Basic Markdown editing is already present; future work should focus on richer shortcuts and preview.
- **Split view.** Option to show a rendered preview alongside the raw markdown editor.

---

## v1.0.0 — Research Assistant Tools

### Agent Tools

- **Generate mind map.** Given one or more sources, generate a mind map as a markdown file in the workspace (e.g., with nested bullet points or Mermaid diagram syntax).
- **Quick report.** Generate a structured report (summary, key findings, details) from selected sources. Output as a markdown note.
- **Auto-extract key points.** Extract the most important points from a source and generate a summary note.
- **Tool invocation UI.** The user sees what tool the agent is running, its progress, and the result.

### Source Expansion

- **Folder imports.** Add an entire folder of files (PDFs, markdown files) as sources in bulk.
- **Source tagging.** Tag sources with user-defined labels. Filter sources by tag.
- **Search across sources.** Full-text search across all indexed source content.

### Notes

- **Linked notes.** Wiki-style links between notes (e.g., `[[other-note]]` or `[[other-note.md]]`).
- **Backlinks.** Show which notes link to the currently open note.
- **Note templates.** User-defined templates for new notes.

---

## Future (post v1.0.0)

- **OCR for scanned PDFs.** Images and scanned documents in PDFs are extracted via OCR.
- **Audio/video ingestion.** Import audio/video files, run local transcription.
- **Image sources.** Add images as sources. Describe/analyze them using a vision-capable LLM.
- **Plugin system.** Third-party extensions for custom source types, tools, or export formats.
- **Sync.** Optional cloud sync for the workspace folder (user brings their own cloud provider — Dropbox, iCloud, Syncthing).
- **Multi-window.** Open notes in separate windows. Detach the chat panel.
