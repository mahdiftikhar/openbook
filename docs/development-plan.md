# Development Plan

This plan is organized as milestones and product targets, not time-boxed sprints.

## Product Thesis

The next phase should make context first-class across notes, PDFs, and chat.

openbook should not feel like a notes app with a chat panel attached. It should feel like a research workspace where notes, source passages, citations, and assistant conversations all share the same context model.

Current core loop:

`workspace -> notes -> PDFs -> chat over context -> cited answers`

The near-term goal is to polish and strengthen that loop before adding larger feature areas such as mind maps, video lectures, or broad source ingestion.

## Target 1: Core UX Cleanup

Goal: reduce friction in the current app without making large architectural bets.

Work:

- Improve chat default width and panel behavior.
- Make chat keyboard-friendly.
- Improve chat empty states and error states.
- Add rendered Markdown support for chat output.
- Make explorer search filter files.
- Make Tab insert indentation in the note editor.
- Preserve note editor focus after first-line filename rename.
- Replace the visible `Saving...` / `Saved` text with a quieter save indicator.
- Improve note placeholder copy.
- Improve the top bar visual design.
- Add an `Open in native app` fallback for PDFs.

Success criteria:

- Existing note, PDF, and chat flows feel smoother.
- The app feels less like a prototype without changing the core architecture.
- `npm run lint` passes.

## Target 2: First-Class Context Model

Goal: replace the current chat model of selected PDF filenames with a more flexible context model.

The current chat path is too narrow because it is centered on selected source filenames. Chat should operate on context items instead.

Potential context item types:

```ts
type ContextItem =
    | { type: "source"; fileName: string }
    | { type: "pdf-excerpt"; fileName: string; page: number; text: string }
    | { type: "note"; filePath: string }
    | { type: "note-excerpt"; filePath: string; text: string }
    | { type: "search"; scope: "all-sources" };
```

Work:

- Introduce a unified chat context model.
- Support whole-source context.
- Support automatic search across all ready sources.
- Prepare for PDF excerpts as context.
- Prepare for notes and note excerpts as context.
- Preserve citation and source metadata through the request flow.

Success criteria:

- Chat is no longer coupled only to selected PDFs.
- Prompts can run with explicit context, automatic source search, or a mix of both.
- The model can support future tools and agents without another full rewrite.

## Target 3: Chat UX V2

Goal: rebuild the chat interface around context items instead of a simple source dropdown.

Work:

- Replace the current source dropdown with a context tray.
- Show selected sources, excerpts, notes, and search scope as removable chips or cards.
- Add a better multiline composer.
- Improve send, cancel, and disabled states.
- Make keyboard shortcuts predictable.
- Leave room for future `/` commands and `@` mentions.
- Allow prompts without explicit sources by using automatic search across ready sources.

Success criteria:

- The user can clearly see what context the assistant will use.
- The chat interface feels intentional rather than temporary.
- The UI supports the future context model instead of fighting it.

## Target 4: Interactive PDF Context

Goal: let users intentionally pull context from PDFs while reading.

First version should stay simple. Do not start with persistent annotations, region coordinates, or highlight storage unless they are required by the PDF renderer.

Work:

- Make PDF text selectable if feasible with the current viewer.
- Add an action to send selected PDF text to chat context.
- Store selected excerpt metadata: file name, file path, page, and selected text.
- Show selected PDF excerpts in the chat context tray.
- Let the assistant answer directly from selected excerpts.
- Improve citation opening so page jumps are reliable.
- Later, add visual indicators or highlighted citation regions if the PDF layer supports it cleanly.

Success criteria:

- The user can select a relevant PDF passage and ask about it directly.
- Selected excerpts are visible, removable, and traceable back to the source.

## Target 5: Retrieval And Agent Upgrade

Goal: replace prototype keyword retrieval with a stronger research-assistant backend.

Current retrieval is useful only as a proof of concept. It ranks simple chunks by keyword matches over selected PDFs. This will not be enough for reliable answers.

Work:

- Define a proper document and chunk model.
- Store source, page, chunk text, location metadata, and processing status.
- Add deterministic chunking.
- Add an indexing lifecycle: pending, ready, error, stale.
- Add search across all ready sources.
- Add embeddings and vector search after the storage model is stable.
- Consider hybrid retrieval with keyword search, vector search, and metadata filters.
- Improve context assembly with deduplication, neighboring chunks, token budgets, and citation metadata.
- Improve agent behavior so it cites accurately, answers only from available context, and says when context is insufficient.
- Add settings for provider, model, API key, and eventually embeddings.

Success criteria:

- Chat produces more relevant and trustworthy answers.
- Citations remain accurate through retrieval, context assembly, and generation.
- The backend can support future agent tools without being tied to the current prototype path.

## Target 6: Better Text Surfaces

Goal: improve reading and writing without prematurely committing to a heavy editor model.

Recommendation: keep notes stored as Markdown files on disk.

Work:

- Keep `.md` files as the source of truth.
- Add rendered Markdown support where it gives immediate value, starting with chat output.
- Improve the note writing experience with better Markdown editing.
- Consider split preview for notes.
- Evaluate a Markdown-first editor before choosing a dependency.
- Avoid a full block editor unless plain Markdown editing proves insufficient.

Success criteria:

- Notes remain local-first, portable, and readable outside openbook.
- Chat output is readable.
- The writing experience improves without turning the editor into a separate product.

## Target 7: Source And File Management Polish

Goal: make local-first file management less awkward and less risky.

Work:

- Add note context menu actions: rename, delete, copy path, and reveal in Finder.
- Move delete out of the note panel header.
- Add manual note rename.
- Add source metadata display.
- Add source search and filtering.
- Add source removal confirmation.
- Improve failed PDF extraction states.
- Persist panel sizes.
- Persist theme preference.

Success criteria:

- Users can manage workspace files without relying on awkward panel-level actions.
- Destructive actions are harder to trigger accidentally.

## Deferred Targets

These are useful, but they should wait until the core context, chat, retrieval, and editor foundations are stronger.

- Mind maps.
- Video lectures and YouTube transcripts.
- Web article ingestion.
- Audio and video transcription.
- Backlinks.
- Note templates.
- Plugin system.
- Cloud sync.
- Multi-window support.
- Full workspace file watcher.

## Recommended Next Cut

Start with the lowest-risk improvements that also move toward the new direction:

- Fix low-hanging UX issues from `docs/task-checklist.md`.
- Add rendered Markdown for chat output.
- Replace the chat source dropdown with a context tray or chip-based model.
- Allow chat prompts to search all ready sources when no explicit source is selected.
- Then add selected PDF text as an explicit chat context item.
