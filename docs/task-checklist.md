# Task Checklist

Running checklist for current polish, known issues, and near-term follow-up work.

## Completed

- [x] Replace the old top bar with a cleaner project bar, theme menu, panel toggles, and tab-style panel headers.
- [x] Add a basic persisted theme system with light and dark modes.
- [x] Replace visible `Saved` / `Saving...` text with a quiet unsaved-dot indicator.
- [x] Make the chat panel the main interaction area with more default room.
- [x] Add cancellation for active chat requests.
- [x] Add a file explorer context menu with open, rename, reveal, copy path, delete/remove, and source-context actions.
- [x] Add manual rename support for notes and PDF sources from the file explorer context menu.
- [x] Move note/source deletion behind the file explorer context menu instead of the note panel header.

## UX / Polish

- [ ] Opening a citation or file from the explorer resizes the opened side panel to 50%. Should not resize if side panel is already open.
- [ ] After a note auto-determines its filename via first-line rename, the editor panel loses focus.
- [ ] Placeholder text says `Start writing...`; replace with something better.
- [ ] Persist panel sizes.

## Editor

- [ ] Pressing Tab in the editor switches browser focus to the next panel instead of inserting a tab character.
- [ ] Add rendered Markdown support where it gives immediate value, starting with chat output.
- [ ] Consider split Markdown preview for notes later.

## File Management

- [ ] Explorer panel search input does not filter files yet.
- [ ] Add confirmation for destructive note/source removal.
- [ ] Improve failed PDF extraction states.
- [ ] Add source metadata display.
- [ ] Add source search and filtering.

## Multi-document

- [ ] No tab support; only one note open at a time.

## Chat Interface

- [ ] Chat interface should be keyboard friendly.
- [ ] Replace the source dropdown with a context tray or chip-based context model.
- [ ] Remake chat input with `/` and `@` commands for adding sources and tools.
- [ ] Prompt input and agent responses should support rich text formatting.
- [ ] Sources should show as tabs or first-class context items.
- [ ] Prompts without explicit sources should be possible; the agent should search all available sources to find relevant context.
- [ ] User notes should be addable to chat context.
- [ ] LLM output quality is poor.

## Context / Retrieval

- [ ] Introduce a unified chat context model that supports sources, source excerpts, notes, note excerpts, and automatic source search.
- [ ] Replace prototype keyword retrieval with a proper document/chunk/indexing model.
- [ ] Preserve citation and source metadata through retrieval, context assembly, and generation.
- [ ] Add settings for LLM provider, model, API key, and eventually embeddings.

## PDF Viewer

- [ ] PDF viewer is page-by-page only; add continuous scrolling.
- [ ] PDF viewer does not support text selection.
- [ ] PDF viewer does not support text highlighting/annotations.
- [ ] Add an action to send selected PDF text to chat context.
- [x] Citation back-references to source files should highlight the cited region or show an explicit visual indicator pointing to the exact location, not just the page.
- [ ] PDF viewer needs an `Open in native app` fallback, likely in a right-click/context menu.
