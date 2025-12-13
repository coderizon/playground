# Refactor Progress — ML Playground Vision Alignment

## Current State Snapshot (Jan 2025)

- **Architecture switcher**: `index.html` now loads `/src/bootstrap.js`, which flips between the legacy prototype and the new SPA via `VITE_PLAYGROUND_APP`. `src/app/bootstrap.js` hides the old DOM, boots Alpine, and mounts the router (`src/app/routes/router.js`).
- **Session store & selectors**: `src/app/store/sessionStore.js` holds the full session model (classes, training, inference, edge state). Derived helpers live in `src/app/store/selectors.js`. Guards (`src/app/guards/navigation.js`) enforce the journey invariants and pages subscribe to the store to enable/disable controls in real time.
- **Alpine component layer**:
  - `classList` now focuses on class creation, naming, and dataset status messaging.
  - `datasetRecorder` components own camera permissions, sample loops, readiness hints, and destructive discards while piping embeddings into the TF.js bridge.
  - `trainingPanel` wraps TF.js intents (start/abort), surfaces dataset readiness summaries, and broadcasts locking hints so Collect UI disables itself while training runs.
  - `predictionPanel` subscribes to inference predictions, throttles updates, and communicates streaming status so users get clear feedback even on slower devices.
  - Global confirm dialog + notice banners provide consistent messaging.
  - Edge panel component connects BLE devices, toggles streaming, and mirrors connection/streaming state on the inference page.
- **Flow coverage**:
  - **Home**: task/model grid wired to the store, session discard/back-to-home controls.
  - **Collect**: classes + recording previews, dataset readiness gating, training progression guard.
  - **Train**: MobileNet feature extraction + real classifier training via `modelBridge.js`, progress bar, guard-driven navigation.
  - **Infer**: Live camera inference loop, probability display, start/stop controls, edge streaming toggle, device notice.
    - Prediction list now flows through `predictionPanel`, which throttles TF.js updates and warns when streaming is disabled despite an active edge connection.
- **Services**:
  - `services/media/cameraService.js` centralizes camera stream handling.
  - `services/ml/modelBridge.js` uses TF.js to capture embeddings, train, and infer.
  - `services/ml/liveInference.js` runs the inference loop.
  - `services/ml/mockTraining.js` + `mockInference.js` remain as fallbacks for future tests.
  - `services/edge/edgeService.js` wraps BLE modules, tracks connection state, and streams predictions (currently Arduino send only).

## Remaining Work to Fulfill `vision.md`

1. **UX polish & structure**
   - Migrate the new SPA styling to Tailwind per the suggested structure (`src/styles`), replacing the ad-hoc CSS in `style.css`.
   - Build out the full `pages/collect|train|infer` directories (controllers + sub-components) instead of single files.
   - Add Alpine components for an inference HUD (preview controls, stream status) so logic moves out of page files.
2. **Recording experience**
   - Extend the dataset recorder to support audio tasks, richer permission failure prompts, and manual sample discard per sample.
   - Add a dedicated dataset summary panel (expected vs recorded counts, readiness reasons) so training blockers are self-explanatory.
3. **Training/inference realism**
   - Harden dataset locking by preventing store-level class mutations when `training.status = running` and persisting readiness/error metadata for retries.
   - Add inference telemetry/guard rails (e.g., FPS indicator, explicit "stop before leaving" confirmations) and surface permission failures inside the inference panel.
4. **Edge streaming completeness**
   - Implement streaming for Micro:bit and Calliope (currently TODO in `edgeService.js`).
   - Add connection state persistence, edge error dialogs, and integrate BLE modal parity from the legacy UI.
5. **Guards & routing**
   - Flesh out `app/routes/` and `app/guards/` with unit-tested helpers (e.g., `canDiscardClass`, `canStartInference`).
   - Introduce route transitions (e.g., `router.go(step)`) so navigation is centralized rather than page-local.
6. **Quality bar**
   - Accessibility pass: focus traps for modals, keyboard shortcuts for recording, ARIA live regions for status text.
   - Pin external dependencies (tf.js, mediapipe) as described in the vision (self-host or lock versions).
7. **Documentation & onboarding**
   - Expand this progress file with per-sprint updates.
   - Add component/guard docs under `docs/` once the structure stabilizes.

Keep referencing `refactoring-plans/vision.md` as the contract; this file tracks implementation status and outstanding work.
