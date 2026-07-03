# Electron Architecture Discussion

## Summary

Openbook has chosen **Pattern B (Thick Main / Backend-centric)**. The main process owns all business logic, database access, file I/O, the LLM chat pipeline, and the file watcher. The renderer is a thin view layer that requests data and displays results. This decision is driven by three app requirements: local file writing, LLM API communication (with streaming), and filesystem watching. Pattern B keeps sensitive data (API keys, file contents) out of the Chromium sandbox and avoids excessive IPC chatter for high-frequency file operations.

The three architecture patterns explored below represent a spectrum of _where the code lives_ — how much runs in the main process versus the renderer process.

---

## The Three Built-in Sandboxes

Every Electron app ships with these three contexts, no exceptions:

```
┌──────────────────────────────────────────────────────┐
│                   OPERATING SYSTEM                    │
│                                                       │
│  ┌─────────────────────────┐  ┌────────────────────┐ │
│  │     MAIN PROCESS        │  │ RENDERER PROCESSES │ │
│  │     (exactly 1)         │  │   (1 per window)   │ │
│  │                         │  │                    │ │
│  │  • Full Node.js         │  │  • Browser APIs    │ │
│  │  • File system access   │  │    only (no Node)  │ │
│  │  • Native OS dialogs    │  │  • Sandboxed DOM   │ │
│  │  • Spawn child procs    │  │  • Web APIs (fetch,│ │
│  │  • System tray, menus   │  │    canvas, etc.)   │ │
│  │  • Window lifecycle     │  │                    │ │
│  │  • Database drivers     │  │                    │ │
│  └───────────┬─────────────┘  └─────────┬──────────┘ │
│              │                          │             │
│              │      ┌──────────┐        │             │
│              └─────►│ PRELOAD  │◄───────┘             │
│                     │  SCRIPT  │                      │
│                     │          │                      │
│                     │ • Bridge │                      │
│                     │ • Has access to BOTH worlds     │
│                     │ • But only exposes a whitelist  │
│                     └──────────┘                      │
└──────────────────────────────────────────────────────┘
```

The preload script is the **only place** where Node.js and browser APIs overlap. It runs in its own world inside the renderer process — it can `require('fs')` but the webpage cannot. It selectively exposes a safe API to the webpage via `contextBridge`.

The core architectural question is: **how much do you put in the preload, and how much in the main?**

---

## Dimension 1: Where the "Code" Lives

### Pattern A: Thin Main, Thin Preload (SPA-centric)

```
┌──────────────┐      thin IPC       ┌──────────────┐
│   RENDERER   │◄───────────────────►│     MAIN     │
│              │                     │              │
│  All UI      │   window.electronAPI│  Window mgmt │
│  All logic   │   .openFile()       │  File dialog │
│  State mgmt  │   .saveFile()       │  Tray icon   │
│  Routing     │   .getOsInfo()      │  App menu    │
│              │                     │              │
│  (React/Vue  │                     │  (very thin) │
│   SPA)       │                     │              │
└──────────────┘                     └──────────────┘
```

The renderer is a full SPA — React, Vue, Svelte — with its own routing, state management, and business logic. The main process does almost nothing beyond opening windows, showing native dialogs, and managing the app lifecycle. The preload exposes a handful of functions like `openFile()`, `saveFile()`, `getAppVersion()`.

**Pros:**

- Feels like building a web app. All familiar tools (React Router, Redux/Zustand, etc.) work exactly as they do on the web.
- Fast iteration — hot module reload works cleanly on renderer code.
- Easy to hire for — most frontend developers already know this model.
- Can potentially share code with a web version of the app.

**Cons:**

- The renderer is sandboxed. Any time you need filesystem access, native OS features, or computationally heavy work, you must cross the IPC bridge.
- IPC calls are asynchronous and have serialization overhead. Chatty patterns hurt performance.
- Security: every line of renderer code comes from Chromium's runtime. If you put business logic here, you must be very careful about what data the renderer can touch.

**File structure:**

```
project/
├── src/
│   ├── main.ts                    # ~50 lines: create window, app lifecycle
│   ├── preload.ts                 # ~30 lines: expose ~5 API functions
│   │
│   └── renderer/                  # Everything lives here
│       ├── index.html
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Router, layout
│       ├── components/
│       ├── hooks/
│       ├── store/                 # Zustand, Redux, etc.
│       ├── pages/
│       └── lib/
│           └── ipc.ts             # Thin wrappers around window.api.*
│
├── package.json
└── forge.config.ts
```

---

### Pattern B: Thick Main (Backend-centric) — **Chosen for openbook**

```
┌──────────────────────┐         IPC          ┌──────────────┐
│        MAIN          │◄────────────────────►│   RENDERER   │
│                      │                      │              │
│  Business logic      │  request data        │  Views only  │
│  Database access     │  receive results     │  Templates   │
│  File I/O            │                      │  Forms       │
│  Computation         │  "give me all notes  │  Display     │
│  Background tasks    │   tagged 'project'"  │              │
│  Sync engine         │                      │  (thin view   │
│  Window management   │                      │   layer)     │
└──────────────────────┘                      └──────────────┘
```

The main process is the "real" application. It owns the database, handles all business rules, does file I/O, runs background jobs. The renderer is a thin view layer — it requests data, displays it, and sends user actions back. Similar to a traditional client-server architecture where the "server" happens to live on the same machine.

**Pros:**

- **Security.** Sensitive data and business logic never touch the Chromium sandbox. Even if a renderer process is compromised, the attacker can only call the preload API — they cannot access the filesystem or database directly.
- **Performance for heavy work.** Node.js in the main process can use worker threads, native addons (sqlite3, sharp, etc.), and isn't throttled by the browser's event loop.
- **Clean separation.** The renderer becomes a "dumb client," which is a simpler mental model to maintain.
- **Multiple renderers?** No problem — they all talk to the same main process.

**Cons:**

- IPC is **always asynchronous**. Every data request crosses a process boundary. Simple reads become async operations, which can complicate the renderer code.
- Harder to iterate on renderer UI in isolation — you need the main process running to serve data.
- If your app is mostly UI with minimal native needs, the IPC overhead doesn't buy you much.

**File structure (tailored for openbook):**

```
openbook/
├── src/
│   ├── main/
│   │   ├── index.ts                    # Bootstrap: init DB, services, create window
│   │   │
│   │   ├── windows/
│   │   │   └── mainWindow.ts           # Creates BrowserWindow, loads renderer
│   │   │
│   │   ├── services/
│   │   │   ├── notes/
│   │   │   │   ├── notesService.ts     # "Save note", "delete note", "list notes"
│   │   │   │   └── notesRepository.ts  # Database queries
│   │   │   │
│   │   │   ├── files/
│   │   │   │   ├── fileService.ts      # Read/write files to disk
│   │   │   │   └── fileWatcher.ts      # chokidar wrapper, emits change events
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── chatService.ts      # Orchestrates conversations
│   │   │   │   ├── llmProvider.ts      # HTTP client for the LLM API
│   │   │   │   ├── streamHandler.ts    # Token streaming + batching for IPC
│   │   │   │   └── contextBuilder.ts   # Assembles conversation context window
│   │   │   │
│   │   │   └── search/
│   │   │       └── searchIndex.ts      # Full-text search over notes
│   │   │
│   │   ├── database/
│   │   │   ├── connection.ts           # SQLite connection setup
│   │   │   ├── schema.ts               # Table definitions, indexes
│   │   │   └── migrations/
│   │   │       └── 001_initial.ts
│   │   │
│   │   ├── config/
│   │   │   └── settings.ts             # App settings, API keys, paths
│   │   │
│   │   └── ipc/
│   │       ├── ipcServer.ts            # Registers all ipcMain.handle() calls
│   │       └── handlers/
│   │           ├── notesHandlers.ts
│   │           ├── filesHandlers.ts
│   │           ├── chatHandlers.ts
│   │           ├── searchHandlers.ts
│   │           └── windowHandlers.ts
│   │
│   ├── preload/
│   │   └── index.ts                    # contextBridge exposing typed API
│   │
│   └── renderer/
│       ├── index.html
│       ├── main.tsx                    # React entry
│       ├── App.tsx                     # Router, layout shell
│       │
│       ├── components/
│       │   ├── notes/
│       │   │   ├── NoteList.tsx
│       │   │   └── NoteEditor.tsx
│       │   │
│       │   ├── chat/
│       │   │   ├── ChatPanel.tsx
│       │   │   ├── MessageBubble.tsx
│       │   │   └── StreamingText.tsx
│       │   │
│       │   └── ui/                     # shadcn components
│       │
│       ├── hooks/
│       │   ├── useNotes.ts
│       │   └── useChat.ts
│       │
│       └── api/
│           ├── notes.ts                # window.api.listNotes()
│           └── chat.ts                 # window.api.sendMessage()
│
├── docs/
├── package.json
└── forge.config.ts
```

---

### Pattern C: Hybrid (Service-Oriented)

```
┌──────────────────────────────────────────────────────┐
│                    MAIN PROCESS                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Database │  │   Sync   │  │ Window Manager   │   │
│  │ Service  │  │  Engine  │  │ Menu, Tray, etc. │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │             │                │               │
│       └──────┬──────┘                │               │
│              │                       │               │
│         ┌────▼─────┐                 │               │
│         │ IPC Hub  │                 │               │
│         │  Router  │                 │               │
│         └────┬─────┘                 │               │
└──────────────┼───────────────────────┼───────────────┘
               │                       │
        ┌──────▼──────┐         ┌──────▼──────┐
        │  RENDERER   │         │  RENDERER   │
        │  (main UI)  │         │ (settings)  │
        │             │         │             │
        │  Local      │         │  Thin view  │
        │  state +    │         │             │
        │  view logic │         │             │
        └─────────────┘         └─────────────┘
```

The main process runs several independent "services" — database, sync engine, file watcher. These communicate internally (same Node.js process, so regular function calls work) but present a unified IPC API to renderers. The renderer handles view logic and local UI state, but all data ownership and mutation goes through the main process.

**Pros:**

- Best of both worlds: the renderer can be responsive and stateful (optimistic UI updates, local component state) while the main process remains the single source of truth.
- The main process internals are modular and testable — each "service" can be unit tested independently.
- Scales to multi-window apps naturally.

**Cons:**

- Most complex of the three. Requires discipline to avoid duplicating logic between main and renderer.
- Two places where bugs can hide: the IPC boundary and the internal service boundaries.
- Overkill for simple apps with only one window and minimal native integration.

**File structure:**

```
project/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── windows/
│   │   ├── services/             # Same as Pattern B
│   │   ├── database/
│   │   └── ipc/
│   │       ├── ipcServer.ts
│   │       └── handlers/
│   │
│   ├── preload/
│   │   └── index.ts
│   │
│   ├── shared/                   # Shared types + validation
│   │   ├── types/
│   │   │   ├── note.ts
│   │   │   └── api.ts
│   │   └── validation/
│   │       └── noteSchemas.ts
│   │
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       ├── hooks/
│       ├── store/                # UI state only
│       ├── pages/
│       └── api/
│
└── forge.config.ts
```

---

## Side-by-Side Comparison

```
PATTERN A                 PATTERN B                 PATTERN C
(thin main)               (thick main)              (hybrid)
────────────────────────  ────────────────────────  ────────────────────────
main.ts (barely exists)   main/ (big)               main/ (big)
preload.ts (tiny)         preload/ (typed API)      preload/ (typed API)
renderer/ (★★★ massive)   renderer/ (thin views)    renderer/ (★★ medium)
                          ─── NONE ───              shared/ (★★ types + validation)
```

The `shared/` directory only appears when both sides need to agree on types. In Pattern A, the renderer defines types and the main process just echoes them back. In Pattern B, the main process defines types and the renderer consumes them. Pattern C needs a shared contract because both sides have real logic.

---

## Dimension 2: Multi-Window Strategies

### One Renderer, Many Windows (shared renderer)

All windows load the same HTML entry point. They share no JavaScript context (each is its own process), but they use the same code bundle.

```
BrowserWindow("main")      → renderer bundle
BrowserWindow("settings")  → same renderer bundle (different route)
BrowserWindow("preview")   → same renderer bundle (different route)
```

**Pros:** Single codebase, can use query parameters or IPC messages to tell each window which "page" to show.

**Cons:** Each window loads the full bundle. Memory usage multiplies.

### Separate Renderers (dedicated bundles)

```
main window     → main.html      (full SPA)
settings window → settings.html  (lightweight)
about window    → about.html     (static)
```

**Pros:** Each window loads only what it needs.

**Cons:** More complex build configuration. Multiple Vite entry points.

### openbook's take

Openbook is single-window initially, so multi-window strategy is deferred. Pattern B makes adding windows simple: create a new `BrowserWindow`, point it at the same or a different HTML entry, and it calls the same IPC handlers.

---

## Dimension 3: How IPC Is Structured

### Request-Response (invoke/handle)

```
Renderer:  const result = await window.api.getNotes()
Main:      ipcMain.handle('get-notes', () => db.query(...))
```

Every call is a request with a response. Clean. Familiar. Like HTTP but over IPC.

**Best for:** CRUD operations, configuration reads, "give me X" queries.

### Event Stream (send/on)

```
Main:      mainWindow.webContents.send('file-changed', path)
Renderer:  window.api.onFileChanged((path) => { ... })
```

The main process pushes events to the renderer without being asked.

**Best for:** File watchers, sync status updates, LLM token streaming.

### openbook's IPC mix

Openbook will use both patterns heavily:

- **invoke/handle** for note CRUD, settings read/write, search queries
- **send/on** for file watcher events, LLM token streaming, app lifecycle events

---

## Why Pattern B for openbook

Three core requirements push toward a thick main process:

**File writing to local disk.** The main process has direct `fs` access. No IPC overhead per write — the renderer says "save this note" and the main process handles path resolution, atomic writes, backup copies. The renderer never touches the filesystem.

**LLM chat bot.** API keys should never live in Chromium's sandbox. Put them in the main process: key storage, request signing, streaming token-by-token responses back to the renderer, retry logic, rate limiting, conversation history. The renderer just says "send this message" and listens for tokens coming back.

**File watcher.** Classic main-process territory. `chokidar` (or `fs.watch`) runs in the main process, detects changes, and pushes events to the renderer. If the watcher needs to re-index files for search, that also stays in main.

**Single window for now** simplifies things — no multi-window dispatch layer needed. But Pattern B scales to multiple windows cleanly if needed later.

---

## Key Interaction Walkthroughs

### User saves a note

```
1. Renderer: NoteEditor detects change
2. Renderer: calls window.api.saveNote({ id, title, content })
3. Preload:   ipcRenderer.invoke('notes:save', { id, title, content })
4. Main:      notesHandlers.ts routes to notesService.save()
5. Main:      notesService validates, calls notesRepository.upsert()
6. Main:      notesRepository writes to SQLite
7. Main:      fileService.writeFile(path, content)  ← writes to disk
8. Main:      returns { success: true, savedAt: timestamp }
9. Preload:   resolves the promise
10. Renderer: updates "last saved" indicator
```

### User sends a chat message

```
1. Renderer: ChatPanel onSubmit → calls window.api.sendMessage({ text })
2. Preload:   ipcRenderer.invoke('chat:send', { text })
3. Main:      chatHandlers.ts routes to chatService.send()
4. Main:      chatService builds context window (previous messages + note content)
5. Main:      llmProvider.streamCompletion(context)  ← HTTP streaming to LLM API
6. Main:      As tokens arrive, streamHandler batches them
7. Main:      mainWindow.webContents.send('chat:token', { token })
8. Renderer:  api.onToken() listener fires → StreamingText appends the token
9. ── repeat 7-8 for every token batch ──
10. Main:     llmProvider stream ends
11. Main:     mainWindow.webContents.send('chat:done', { messageId })
12. Renderer: api.onDone() → marks message complete, enables input
```

Notice: the renderer never makes an HTTP request. It never touches the filesystem. It never stores an API key. It only calls the preload API and listens for events.

---

## Preload Contract Design

The preload becomes a typed contract exposing only what the renderer needs:

```ts
window.api = {
  // Notes
  listNotes: () => ipcRenderer.invoke("notes:list"),
  getNote: (id: string) => ipcRenderer.invoke("notes:get", id),
  saveNote: (note: NoteDraft) => ipcRenderer.invoke("notes:save", note),
  deleteNote: (id: string) => ipcRenderer.invoke("notes:delete", id),

  // Chat
  sendMessage: (text: string) => ipcRenderer.invoke("chat:send", text),
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on("chat:token", callback),
  onChatDone: (callback: (result: ChatResult) => void) =>
    ipcRenderer.on("chat:done", callback),

  // Files
  onFileChanged: (callback: (path: string) => void) =>
    ipcRenderer.on("files:changed", callback),
};
```

The renderer never knows about `ipcRenderer`. It only sees this clean object. If the app later swaps Electron for Tauri, or adds a web version, the renderer code stays the same — only the preload (or its equivalent) changes.

---

## Known Tensions with Pattern B

**Everything is async in the renderer.** The renderer can never do `const note = db.notes.get(id)` synchronously. The entire renderer codebase will be async-aware. For a note-taking app with a rich editor, autosave patterns need thought (debounced IPC calls, conflict detection).

**LLM streaming across IPC.** Tokens may arrive faster than the renderer can render. `streamHandler.ts` in the main process should batch tokens before sending to avoid flooding the IPC bridge.

**File watcher self-triggering.** If the user edits a note that is also a watched file, the watcher will detect the change that the app itself made. The `fileWatcher.ts` service needs a mechanism to ignore changes triggered by the app's own file writes (e.g., tracking recent write paths with a short TTL).
