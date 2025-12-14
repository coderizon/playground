# Current Implementation Snapshot & Alignment Notes

This document mirrors the shipped SPA as of Jan 2025 so new contributors can connect `vision.md` to the concrete code that now exists in `src/app`.

## Architecture & Stack
- `index.html` bootstraps `src/bootstrap.js`, which injects TF.js (via `src/utils/loadTf.js`) and mounts the SPA router (`src/app/bootstrap.js` + `routes/router.js`). No legacy landing DOM remains—the SPA is the single UI.
- State lives in `src/app/store/sessionStore.js` (plus derived selectors). Controllers (`navigationController`, `sessionController`, `classController`, `trainingController`, `inferenceController`, `edgeController`) are the only modules mutating the store; UI components emit intents.
- Pages (`src/pages/{home,collect,train,infer}`) render one step at a time. Guards in `routes/navigationGuards.js` + `historySync.js` keep browser navigation, beforeunload dialogs, and inference-stop confirmations aligned.
- Components are Alpine stores/modules registered via `src/components/registerComponents.js` (class cards, dataset recorders, training panel, edge panel, confirm dialog, notice banners, etc.).
- ML/media/edge logic sits in `src/services` (cameraService, modelBridge, liveInference, edgeService). External resources are pinned via `src/config/externalResources.js`.
- Styling flows through `src/styles/main.css` (Tailwind layer). Shared tokens cover buttons, cards, guardrails, notices, dialogs, and page shells; legacy `.css` files have been removed.

## Journey Implementation
### Home
- `pages/home` renders the `(task, model)` grid from `data/taskModels.js`, inline guidance on keyboard usage, and a hero that restates the declarative journey plus guardrails.
- Session controls (discard/back-to-home) subscribe to the store; shortcuts `Ctrl+Shift+D/H` are surfaced inline and wired through `routes/keyboardShortcuts.js`.

### Classes & Data Collection
- `classList` manages creation, naming validation, and dataset readiness badges per class; dataset recorders (audio/camera) encapsulate permissions, recording, per-sample metadata, delete flows, and background-audio checks.
- Training locks propagate through selectors so destructive actions and recording controls disable themselves when training runs.
- `collectSummary` surfaces blockers (missing classes, sample counts, missing background noise) plus CTA hints; empty state is its own component with onboarding copy.

### Training
- `trainingPanel` handles start/abort, progress states, stale-model detection, CTA copy, and keyboard shortcuts (`T` start, `A/Esc` abort).
- `trainingSummaryPanel` mirrors dataset readiness, audio requirements, and hints referenced by the selectors so the CTA remains clean.
- `trainingController` orchestrates TF.js runs via `services/ml/modelBridge.js`, enforces confirmations on abort, and ensures dataset/inference locks stay consistent.

### Inference & Edge
- `inferenceControls` controls permissions, readiness notices, start/stop toggles, keyboard shortcuts (`P` start/`O` stop), and aria-live messaging for streaming status.
- `predictionPanel` throttles predictions, exposes streaming metadata, and routes BLE streaming toggles through `edgeController`.
- `edgePanel` is the only BLE UI: it handles device selection, connection lifecycle, streaming toggles guarded by `getEdgeStreamingContext`, and confirmation dialogs for disconnects. Streaming requires inference to stop first via `inferenceController.ensureInferenceStopped`.

## Session & Guard Framework
- Session lifecycle (`STEP.HOME → COLLECT → TRAIN → INFER`) is enforced by `navigationController`; guards confirm when inference is running and block transitions when datasets/training aren’t ready.
- `sessionController.discardSessionWithConfirm` uses the shared confirm dialog plus inference guard to guarantee safe teardown.
- Keyboard shortcuts, controllers, and UI buttons all share the same controller helpers so behavior matches regardless of trigger surface.
- Browser history sync keeps the hash in sync with `session.step`, rehydrates on refresh, and replays guard decisions when popstate events fire.

## Device & Edge Integration
- `services/edge/edgeService.js` abstracts BLE/UART interactions. The store tracks device metadata, streaming state, and errors; selectors expose whether streaming is allowed (permissions, training freshness, inference status).
- BLE hardware QA expectations live in `docs/ble-hardware-qa.md`. Edge tests fake BLE stacks to cover connection, streaming, and error propagation.

## Quality & A11y Notes
- All relevant notices expose `role="status"` + `aria-live="polite"`; confirm dialog traps focus while open and supports Escape/backdrop close.
- Permission failures propagate through `sessionStore.permissions` so Collect, Train, and Infer surfaces stay in sync.
- Keyboard parity is enforced for dataset recorders (R/S/D), training (T/A/Esc), inference (P/O), and session shortcuts (Ctrl+Shift+D/H).
- Tests live under `tests/**` and run via `npm test` (see `tests/run-tests.mjs`). Controllers, store modules, and selectors each have targeted suites.

Refer to `refactoring-plans/progress.md` for the historical migration narrative and outstanding tasks (if any). This document only reflects the current SPA behavior.
