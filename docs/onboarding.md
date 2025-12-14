# Contributor Onboarding — ML Playground SPA

Use this guide to ramp up on the refactored single-page app and align every change with `refactoring-plans/vision.md`.

## 1. Getting Started
- `npm install`
- `npm run dev` to launch Vite (the SPA is mounted via `src/bootstrap.js`).
- `npm test` to run the guard/service regression suite (`tests/run-tests.mjs`). Run this before every commit, especially after touching controllers, the session store, or edge logic.

## 2. Architecture Map
- **Entry point**: `index.html` loads `src/bootstrap.js`, which injects TF.js (via `src/utils/loadTf.js`) and mounts `src/app/bootstrap.js`.
- **State**: `src/app/store/sessionStore.js` (plus `selectors.js`) is the single source of truth for session, class, training, inference, and edge data.
- **Pages**: `src/app/pages/{home,collect,train,infer}` render one step at a time. Navigation flows through `src/app/routes/navigationController.js` and guard helpers in `routes/navigationGuards.js`.
- **Components**: Registered in `src/app/components/registerComponents.js`. See `docs/components.md` for per-component notes.
- **Services**: Hardware/ML logic sits under `src/app/services` (camera/media, TF.js training/inference, BLE edge streaming).
- **Styling**: Tailwind tokens live in `src/styles/main.css`; avoid reintroducing legacy `.css` files.

## 3. Controllers & Guardrails
- Never mutate `sessionStore` directly from UI; go through controllers (`navigationController`, `sessionController`, `classController`, `trainingController`, `inferenceController`, `edgeController`).
- Destructive actions must always route through the shared confirm dialog + inference guard so active recordings or streaming sessions are stopped safely.
- Keyboard shortcuts are defined in `src/app/routes/keyboardShortcuts.js` (`Ctrl+Shift+D/H`). Keep these updated whenever controller behavior changes.

## 4. Working a Slice
1. Read `refactoring-plans/progress.md` (“Remaining Work”) to choose your next task. If an item is already satisfied, update the snapshot/backlog before writing code.
2. Implement the slice under `src/app/**`, keeping services pure and UI declarative.
3. Update `refactoring-plans/progress.md` (snapshot + remaining work) and any relevant docs (this file, `docs/components.md`, hardware QA) before considering the slice complete.
4. Run `npm test`.
5. Commit with a descriptive message (one slice per commit).

## 5. Testing & QA Expectations
- Guard regression suite (`npm test`) is mandatory after touching navigation, store, or edge logic.
- Manual QA focus areas per `vision.md`: recording parity (audio background coverage, camera thumbnails), BLE/edge streaming safety, and accessibility (aria-live status, focus management).
- For BLE changes, reference `docs/ble-hardware-qa.md` for the hardware test matrix.

## 6. Reference Checklist
- Contract: `refactoring-plans/vision.md`
- Strategy: `refactoring-plans/refactoring-strategy.md`
- Progress tracker/backlog: `refactoring-plans/progress.md`
- Component notes: `docs/components.md`
- Hardware QA: `docs/ble-hardware-qa.md`

Keep this onboarding doc current as the SPA evolves—if a workflow or directory moves, update the relevant section immediately so new contributors never inherit stale guidance.
