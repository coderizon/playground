# Refactor Progress — ML Playground Vision Alignment

## Current State Snapshot (Jan 2025)

- **Architecture switcher**: `index.html` now loads `/src/bootstrap.js`, which flips between the legacy prototype and the new SPA via `VITE_PLAYGROUND_APP`. `src/app/bootstrap.js` hides the old DOM, boots Alpine, and mounts the router (`src/app/routes/router.js`).
- **Session store & selectors**: `src/app/store/sessionStore.js` holds the full session model (classes, training, inference, edge state). Derived helpers live in `src/app/store/selectors.js`. Guards (`src/app/guards/navigation.js`) enforce the journey invariants and pages subscribe to the store to enable/disable controls in real time.
- **Navigation controller**: `src/app/routes/navigationController.js` now wraps all `sessionStore.setStep` calls with guard-aware helpers (`goHome/goCollect/goTrain/goInfer`) that consult an inference-running confirmation before navigating, and `tests/routes/navigationController.test.mjs` ensures transitions only fire when invariants hold (including decline paths). Pages (collect/train/infer) use these helpers so routing logic stays centralized.
- **Browser history + leave guards**: `src/app/routes/historySync.js` keeps `window.history`/hash in lockstep with session steps, restores the right page on refresh/back, and falls back safely when guards block navigation. `src/app/routes/navigationGuards.js` registers a global `beforeunload` warning and reuses the confirmation helper. `tests/routes/historySync.test.mjs` stubs the browser to cover initial hash hydration, pushState, and popstate failure recovery.
- **Alpine component layer**:
  - `classList` now focuses on class creation, naming, and dataset status messaging.
  - `datasetRecorder` components own camera permissions, microphone-based clip capture (MediaRecorder), readiness hints, and destructive discards while piping embeddings into the TF.js bridge; toast notifications surface permission failures inline.
  - Modality guidance: audio recorder shows progress meters + short-clip analytics, camera recorder captures frame thumbnails + variation hints.
  - `trainingPanel` wraps TF.js intents (start/abort), surfaces dataset readiness summaries, and broadcasts locking hints so Collect UI disables itself while training runs.
  - `collectSummary` surfaces overall readiness (classes, samples, blockers) directly on the Collect page; `inferenceControls` manages camera permissions, start/stop intents, and navigation safety copy; `predictionPanel` subscribes to inference predictions, throttles updates, and communicates streaming status so users get clear feedback even on slower devices.
  - Global confirm dialog + notice banners provide consistent messaging.
  - Edge panel component connects BLE devices, toggles streaming, mirrors connection/streaming state on the inference page, persists the last selected device/error in `sessionStore.edge`, auto-opens the BLE modal on failures, highlights the selected device with inline error copy, shows device thumbnails plus quick-start steps for Arduino, Micro:bit und Calliope, and now provides a11y affordances (focus trap, Escape handling, labeled dialog) so keyboard-only users can recover from BLE errors.
- **Styling foundation**: Tailwind entry point lives in `src/styles/main.css` (with `@tailwind base/components/utilities`) replacing the old root `style.css`. Further utility extraction can now happen per component.
- **Flow coverage**:
  - **Home**: task/model grid wired to the store, session discard/back-to-home controls.
  - **Collect**: classes + recording previews, dataset readiness gating, summary panel with per-class blockers, training progression guard.
  - **Train**: MobileNet feature extraction + real classifier training via `modelBridge.js`, progress bar, guard-driven navigation, blocker list fed by dataset readiness metadata.
  - **Infer**: Live camera inference loop, FPS-aware start/stop guard via `inferenceControls` (with before-unload protection + confirmations), throttled prediction display, explicit streaming toggle/notice.
- **Services**:
  - `services/media/cameraService.js` centralizes camera stream handling.
  - `services/ml/modelBridge.js` uses TF.js to capture embeddings, train, and infer.
  - `services/ml/liveInference.js` runs the inference loop.
  - `services/ml/mockTraining.js` + `mockInference.js` remain as fallbacks for future tests.
  - `services/edge/edgeService.js` wraps BLE modules, tracks connection state, streams predictions to Arduino/Micro:bit/Calliope, and flags streaming errors as edge status updates; regression tests in `tests/store/sessionStore.edge.test.mjs` cover edge state persistence/contracts, `tests/services/edgeService.test.mjs` fakes the BLE stack to verify streaming toggles + error propagation end to end, and `docs/ble-hardware-qa.md` captures the release checklist for exercising real devices.

## Remaining Work to Fulfill `vision.md`

The edge-streaming parity/QA slice is complete (store persistence, modal UX, tests, and hardware checklist). The focus now shifts to the remaining pillars below:

1. **UX polish & structure**
   - Gradually replace legacy utility classes with Tailwind utility/`@apply` patterns now that `src/styles/main.css` is the source of truth.
   - Extract collect/train/infer logic into dedicated controllers + sub-components (e.g., `pages/infer/view.js` now renders the full page).
2. **Recording experience**
   - Add camera-specific analytics (per-sample thumbnails already exist; still need in-app preview thumbnails or sample replay) plus richer background-noise guidance for audio tasks.
   - Introduce optional background/noise capture presets inspired by `ml-speech` (long-duration recordings with visual progress) so users know when to relax or speak.
3. **Training/inference realism**
   - Persist readiness/error metadata for retries (e.g., remember why a class is blocked) and expose retry affordances after aborts.
   - Surface permission failure details (camera/mic) via dedicated banners/toast components and add unit tests for inference confirmation flows.
4. **Guards & routing**
   - Guard helpers (collect/training/inference + discard/start checks) now live in `src/app/guards/navigation.js` with node-based unit tests under `tests/guards/navigation.test.mjs`.
   - History/back-stack sync + leave confirmations are in place. Next up: add integration tests for discard/session-reset flows (confirm dialog wiring across controllers) and mirror navigation state to the legacy shell if it remains a fallback.
5. **Quality bar**
   - Accessibility pass: focus traps for modals, keyboard shortcuts for recording, ARIA live regions for status text.
   - Pin external dependencies (tf.js, mediapipe) as described in the vision (self-host or lock versions).
6. **Documentation & onboarding**
   - Expand this progress file with per-sprint updates.
   - Add component/guard docs under `docs/` once the structure stabilizes.

Keep referencing `refactoring-plans/vision.md` as the contract; this file tracks implementation status and outstanding work.
