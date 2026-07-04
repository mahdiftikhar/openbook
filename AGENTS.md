# openbook — AGENTS.md

Project-local skill at `.opencode/skills/coding-discipline/`. OpenCode agents auto-discover it.

## Project

Electron + React + TypeScript desktop app (note-taking / research assistant with LLM agents). v0.1.0.

## Architecture

- **Three Vite build targets** (defined in `forge.config.ts`):
  - `main` — Electron main process (`src/main.ts`)
  - `preload` — preload script (`src/preload.ts`)
  - `renderer` — UI (`index.html` -> `src/renderer.tsx`)
- Each target has its own Vite config: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- Renderer entry: `index.html` (root) imports `src/renderer.ts` which imports `src/index.css`

## Commands

| Command           | Action                           |
| ----------------- | -------------------------------- |
| `npm start`       | Launch dev mode (electron-forge) |
| `npm run lint`    | ESLint on `.ts,.tsx` files       |
| `npm run package` | Package for distribution         |
| `npm run make`    | Generate platform installers     |

No test framework or test command exists yet.

## TypeScript rules

- `allowJs: false` — no `.js` files anywhere
- `noImplicitAny: true` — all types must be explicit
- `jsx: "react-jsx"` — React 19 JSX transform
- Path alias `@/` maps to `src/`
- Current TS version: `~4.5.4` (older, `strict` not set)

## Styling

- **Tailwind CSS v4** — config is entirely in `src/index.css` (`@import "tailwindcss"`, `@theme inline`, `@plugin "tailwindcss-animate"`)
- No `tailwind.config.js` — that is correct for v4
- Dark mode via `.dark` class (`@custom-variant dark`)
- PostCSS plugin: `@tailwindcss/postcss` in `postcss.config.js`
- **shadcn/ui** — add components with `npx shadcn@latest add <name>` (goes in `src/components/ui/`)
- `cn()` utility in `src/lib/utils.ts`

## Gotchas

- Forge Vite plugin loads configs via `require` — ESM-only Vite plugins (e.g., `@tailwindcss/vite`) will break. Use PostCSS plugin `@tailwindcss/postcss` instead.
- `postcss.config.js` uses ESM `export default` but `package.json` has no `"type": "module"`. This produces a harmless warning. Do not add `"type": "module"` unless you verify it doesn't break electron-forge.
- `forge.env.d.ts` exists at root — may contain env type declarations used by Vite builds.
