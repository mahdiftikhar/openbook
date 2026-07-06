## Known Issues (low priority)

### UX / Polish

- [ ] After a note auto-determines its filename via first-line rename, the editor panel loses focus.
- [ ] Placeholder text says "Start writing..." — replace with something better.
- [ ] Top bar does not look good.
- [ ] "Saved" / "Saving..." text indicator is annoying — replace with a dot indicator (dot = unsaved, no dot = saved).

### Editor

- [ ] Pressing Tab in the editor switches browser focus to the next panel instead of inserting a tab character.

### File Management

- [x] Explorer panel search input does not filter files yet.
- [x] No rename file feature — filename is only changed on first autosave of an untitled note.
- [x] No context menu on notes in the sidebar (right-click for delete/rename/copy-path).
- [x] Delete button should not be in the note panel header — move delete behind the sidebar context menu.

### Multi-document

- [ ] No tab support — only one note open at a time.

### Chat Interface

- [ ] Chat interface should be keyboard friendly.
- [ ] Remake chat input with `/` and `@` commands for adding sources and tools.
- [ ] Chat interface needs more width by default.
- [ ] Prompt input and agent responses should support rich text formatting.
- [ ] Sources should show as tabs.
- [ ] Prompts without explicit sources should be possible; the agent should search all available sources to find relevant context.
- [ ] User notes should be addable to chat context.
- [ ] LLM output quality is poor.

### PDF Viewer

- [ ] PDF viewer is page-by-page only — add continuous scrolling.
- [ ] PDF viewer does not support text selection.
- [ ] PDF viewer does not support text highlighting/annotations.
- [ ] Citation back-references to source files should highlight the cited region or show an explicit visual indicator pointing to the exact location, not just the page.
- [ ] PDF viewer needs an "Open in native app" fallback, likely in a right-click/context menu.
