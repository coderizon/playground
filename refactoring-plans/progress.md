# Refactor Progress — ML Playground Vision Alignment

## Current State Snapshot (Jan 2025)

- **Architecture switcher**: `index.html` now loads `/src/bootstrap.js`, which flips between the legacy prototype and the new SPA via `VITE_PLAYGROUND_APP`. `src/app/bootstrap.js` hides the old DOM, boots Alpine, and mounts the router (`src/app/routes/router.js`). The legacy shell is no longer treated as a co-equal UI—our refactor path is a full rewrite to the SPA described in `vision.md`, so no state mirroring or dual rendering is required.
- **Session store & selectors**: `src/app/store/sessionStore.js` holds the full session model (classes, training, inference, edge state). Derived helpers live in `src/app/store/selectors.js`. Guards (`src/app/guards/navigation.js`) enforce the journey invariants and pages subscribe to the store to enable/disable controls in real time.
- **Navigation controller**: `src/app/routes/navigationController.js` wraps all `sessionStore.setStep` calls with guard-aware helpers (`goHome/goCollect/goTrain/goInfer`) that consult an inference-running confirmation before navigating, and `tests/routes/navigationController.test.mjs` ensures transitions only fire when invariants hold (including decline paths). Companion controllers manage destructive actions: `sessionController` for full-session resets and `classController` for class/dataset deletes, each with regression tests under `tests/routes/sessionController.test.mjs` and `tests/routes/classController.test.mjs`.
- **Browser history + leave guards**: `src/app/routes/historySync.js` keeps `window.history`/hash in lockstep with session steps, restores the right page on refresh/back, and falls back safely when guards block navigation. `src/app/routes/navigationGuards.js` registers a global `beforeunload` warning and reuses the confirmation helper. `createInferenceController` owns the reusable “ensure inference stopped” flow (`tests/routes/inferenceController.test.mjs`) that pages call before opening destructive dialogs. `tests/routes/historySync.test.mjs` stubs the browser to cover initial hash hydration, pushState, and popstate failure recovery.
- **Alpine component layer**:
  - `classList` now focuses on class creation, naming, and dataset status messaging.
  - `datasetRecorder` components own camera permissions, microphone-based clip capture (MediaRecorder), readiness hints, and destructive discards while piping embeddings into the TF.js bridge; toast notifications surface permission failures inline. Per-sample deletes now route through a dedicated controller/confirm dialog so training locks can block the action consistently.
  - Audio recorder presets mirror the ml-speech guidance: quick 2s clips plus a 20s background capture with inline hints, completion status, and inline playback so students can review what they just captured. Camera samples now surface derived thumbnails, hover-activated frame strips, coverage summaries, and a manual scrub slider so learners can pick the exact frame they plan to keep without re-recording.
  - Modality guidance: audio recorder shows progress meters + short-clip analytics, camera recorder captures frame thumbnails + variation hints.
  - `trainingPanel` wraps TF.js intents (start/abort), surfaces dataset readiness summaries, and broadcasts locking hints so Collect UI disables itself while training runs. Training intents now route through `trainingController`, which confirms aborts and centralizes start calls. It also mirrors `training.lastRun` metadata (status, timestamp, failure reason), compares it to each class' `dataset.lastUpdatedAt`, and updates the primary CTA (`Training starten` → `Erneut trainieren (neue Daten)`) plus inline hints so learners immediately see why a retrain is recommended.
  - A shared `permissionAlerts` Alpine component listens to `sessionStore.permissions` to surface camera/microphone failures across Collect and Inference. Recording components and `inferenceControls` now call `sessionStore.setPermissionState` whenever permissions succeed or fail, so blocked devices produce dedicated warning banners (with guidance copy) instead of being limited to transient toasts. The edge panel reuses the same metadata plus the training retry context: the streaming toggle is now disabled (with inline hints + toasts) whenever the last training run is stale or camera permissions are blocked, preventing learners from sending outdated/unsafe predictions to hardware.
  - Status labels that inform navigation decisions (`collect-lock-hint`, summary messages, training hints, inference status, edge streaming notices, etc.) now expose `role="status"` + `aria-live="polite"` so screen readers announce readiness/lock changes immediately without forcing learners to hunt for updates.
  - `collectSummary` surfaces overall readiness (classes, samples, blockers) directly on the Collect page; `inferenceControls` manages camera permissions, start/stop intents, and navigation safety copy; `predictionPanel` subscribes to inference predictions, throttles updates, and communicates streaming status so users get clear feedback even on slower devices.
  - Global confirm dialog + notice banners provide consistent messaging. The confirm dialog now mounts once during app bootstrap, so controllers (session/class/edge) and the inference guard can open it on any page without relying on Collect’s markup; session discard continues to route through the shared guard before showing the destructive confirm.
  - Edge panel component connects BLE devices, toggles streaming, mirrors connection/streaming state on the inference page, persists the last selected device/error in `sessionStore.edge`, auto-opens the BLE modal on failures, highlights the selected device with inline error copy, shows device thumbnails plus quick-start steps for Arduino, Micro:bit und Calliope, and now provides a11y affordances (focus trap, Escape handling, labeled dialog) so keyboard-only users can recover from BLE errors. The panel defers all destructive actions (disconnect, streaming toggles) to the inference guard + new `getEdgeStreamingContext` selector so inference must stop before disconnecting and streaming stays disabled until camera permissions are restored and stale datasets retrained.
- **Styling foundation**: Tailwind entry point lives in `src/styles/main.css` (with `@tailwind base/components/utilities` plus a `@layer components` block). That sheet now defines the SPA’s shared tokens (buttons, notices, modals) and page layouts for Home/Collect/Train/Infer, so the new journey renders with consistent spacing/typography without the orphaned `collect.css`.
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
   - Add camera-specific analytics (per-sample frame strips + scrub slider now exist; next step is polishing per-sample annotations/metadata affordances) plus richer background-noise guidance for audio tasks (presets + playback shipped).
   - Introduce optional background/noise capture presets inspired by `ml-speech` (long-duration recordings with visual progress) so users know when to relax or speak. **(✅ Presets + playback shipped.)**
3. **Training/inference realism**
   - Ensure inference confirmation helpers cover all destructive flows (BLE disconnect, session discard) with tests and toasts.
4. **Guards & routing**
   - Guard helpers (collect/training/inference + discard/start checks) now live in `src/app/guards/navigation.js`, with unit suites for navigation/history/session/class/sample/training controllers and edge streaming under `tests/`.
   - Remaining work: audit the remaining destructive micro-actions (dataset resets triggered outside Collect, BLE disconnect toasts, etc.) to ensure they defer to the shared controllers and surface consistent confirm/toast copy.
5. **Quality bar**
   - Accessibility pass: focus traps for modals, keyboard shortcuts for recording, ARIA live regions for status text. **(✅ Status text now surfaces live regions; focus traps + shortcuts still pending.)**
   - Pin external dependencies (tf.js, mediapipe) as described in the vision (self-host or lock versions).
6. **Documentation & onboarding**
   - Expand this progress file with per-sprint updates.
   - Add component/guard docs under `docs/` once the structure stabilizes. **(✅ `docs/components.md` now summarizes confirm dialog, dataset recorder, edge streaming, and controllers.)**

Keep referencing `refactoring-plans/vision.md` as the contract; this file tracks implementation status and outstanding work.
