## Overview

This app is an Electron desktop application with two UI layers:

- `src/`: Electron main process and the lightweight, always-on desktop UIs (header, listen, ask, compact settings) rendered via simple HTML/Lit.
- `revnautix_web/`: A Next.js web app that powers larger flows such as Settings, Personalize, and Activity. It can run via a dev server in development or be statically exported and served locally by Electron in production.

Electron coordinates both layers, exposes OS capabilities, manages windows, and bridges app logic to the renderers.

---

## Top-level directories

- `src/`: Electron app code and core services
  - `index.js`: Electron main entry. Initializes services, starts local servers, creates windows, and handles deep links (`revnautix://`).
  - `preload.js`: Exposes safe IPC APIs from main to renderers.
  - `bridge/`: IPC wiring from renderer to main process logic
    - `windowBridge.js`: Handlers for window operations (open, move, resize, etc.).
    - `featureBridge.js`: Handlers for feature data (presets, models, etc.).
    - `internalBridge.js`: Internal event bus for window coordination.
  - `window/`: Window creation, layout, and animations
    - `windowManager.js`: Creates header/feature windows, positions/animations, and show/hide logic. Also opens the standalone Personalize window.
    - `windowLayoutManager.js`, `smoothMovementManager.js`: Layout calculation and motion.
  - `features/`: Core app logic (AI providers, auth, DB, services, repositories)
    - `common/ai/`: Integrations with OpenAI, Anthropic, Gemini, Ollama, Whisper.
    - `common/services/`: `authService`, `databaseInitializer`, `modelStateService`, `ollamaService`, `whisperService`, etc.
    - `common/repositories/`: SQLite-backed repositories for user, presets, sessions, etc.
    - `ask/`, `listen/`, `settings/`, `shortcuts/`: Feature-specific services and repositories.
  - `ui/`: Lightweight desktop UIs rendered inside Electron windows
    - `app/`: Header and shared content HTML and controllers (e.g. `HeaderController.js`).
    - `listen/`, `ask/`, `settings/`: Feature views used by compact windows.
    - `assets/`, `styles/`: Static assets and CSS for these UIs.

- `revnautix_web/`: Next.js application used by the desktop app for full pages
  - `app/`: Route pages (e.g. `personalize`, `settings`, `activity`, `login`).
  - `components/`: Shared React components.
  - `utils/`: API and auth helpers. `utils/api.ts` points to the local API server started by Electron.
  - `backend_node/`: Express app that exposes REST endpoints for the Next pages; it talks to the Electron main via an event bus.
  - `public/`, `tailwind.config.js`, `next.config.js`: Frontend assets and configuration (Next is configured for static export via `output: 'export'`).

- `public/`: App-level assets bundled with Electron (not the Next public folder).
- `docs/`: Project documentation (design patterns, this structure doc, refactor plans).
- Build/config at root: `build.js`, `electron-builder.yml`, `scripts/`, etc.

---

## How it runs together

On startup, `src/index.js`:

1. Initializes core services (`databaseInitializer`, `authService`, `modelStateService`, etc.).
2. Starts two local servers via `startWebStack()`:
   - API server (Express) from `revnautix_web/backend_node/` (lists on an available local port).
   - Frontend server that serves the statically exported Next.js app from `revnautix_web/out`.
     - In dev, if `pickleglass_WEB_URL` points to a Next dev server, Electron uses that instead.
3. Creates Electron windows via `windowManager.createWindows()`:
   - Always-on header window, plus compact feature windows (`listen`, `ask`, `settings`).
   - Large standalone windows (e.g., Personalize) are opened on demand (`openPersonalizeWindow`).
4. Wires IPC bridges (`featureBridge`, `windowBridge`) to route renderer requests to services and DB.

Deep links such as `revnautix://personalize` are handled in `index.js` and routed to the appropriate Electron window/navigation.

---

## Development vs. Production

- Dev (convenient hot-reload):
  - Run the Next.js dev server in `revnautix_web/` and start Electron with `revnautix_WEB_URL` pointing to it.
  - Root script `pnpm run dev` does this for you (see `package.json`).

- Production / static mode:
  - Build the Next.js app: `pnpm -C revnautix_web run build` (outputs to `revnautix_web/out`).
  - Electron serves the static export locally; no external web server is required.

Environment variables are set in `startWebStack()` and made available to both layers:

- `pickleglass_API_URL`: Local API server origin (e.g., `http://localhost:9001`).
- `pickleglass_WEB_URL`: Web UI origin (Next dev server or local static server).
- `pickleglass_API_PORT`, `pickleglass_WEB_PORT`: Assigned ports for the above.

---

## Quick edit guide

- Desktop window behavior and lifecycle: `src/window/windowManager.js`.
- Small header/feature UIs: `src/ui/app/*` and feature views under `src/ui/*`.
- Large flows (Personalize/Settings/Activity): `revnautix_web/app/*`.
- REST endpoints used by those pages: `revnautix_web/backend_node/*`.
- Auth, models, persistence: `src/features/common/services/*`, `src/features/common/repositories/*`.
- Provider configs and runtime defaults: `src/features/common/config/*`.

---

## Data and IPC flow (short)

Renderer UIs (header/compact windows or Next pages) invoke IPC or HTTP calls:

- Compact windows use preload-exposed IPC (see `src/preload.js` and `bridge/*`) to call main process services.
- Next pages call the local API (`utils/api.ts` → `backend_node/`), which proxies into the main process through an event bus and repositories.

This keeps privileged operations in the main process and presents a simple API for the UIs.


