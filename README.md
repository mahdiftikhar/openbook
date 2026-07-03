# openbook

**Version 0.1.0** — Desktop research assistant powered by LLM agents.

openbook is an Electron-based note-taking and research tool. It helps you organize research around topics, collect sources, write notes, and get assistance from LLM agents that are aware of your research context.

## Features

- **Research Topics** — Create topics to organize your work. Each topic is a self-contained workspace for a research area.
- **Sources** — Add multiple sources to a topic (web pages, PDFs, notes, references). Sources stay attached to the topic for easy reference.
- **Notes** — Write and organize notes within each topic, keeping your thoughts alongside your sources.
- **LLM Agents** — Context-aware assistants that understand your topic's sources and notes. Ask questions, summarize, or explore ideas without losing sight of your material.

## Tech Stack

- Electron (desktop shell)
- React (UI)
- TypeScript
- Tailwind CSS + shadcn/ui (styling)
- Vite (bundler)

## Development

```bash
npm install
npm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch the app in development mode |
| `npm run package` | Package the app for distribution |
| `npm run make` | Generate platform-specific installers |
| `npm run lint` | Run ESLint on source files |
