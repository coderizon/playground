# Component & Guard Notes — ML Playground SPA

> Working doc for contributors. Summaries stay short and link back to source files/tests.

## Confirm Dialog (`src/app/components/common/confirmDialog.js`)

- **Purpose**: single modal entry point for destructive confirmations (`openConfirmDialog` delegates to Alpine).
- **Wiring**: `registerConfirmDialog` is mounted once (see `registerComponents.js`). Controllers (`sessionController`, `classController`, `edgePanel`, etc.) pass `title/message/confirmLabel/destructive` and a callback.
- **Accessibility**: focus trap, Escape/backdrop close, and `aria-modal` enforced. Buttons expose `data-dialog-focusable` so Tab loops inside the dialog and focus returns to the trigger.
- **Tests**: behavior covered indirectly via controller suites (`tests/routes/sessionController.test.mjs`, `tests/routes/classController.test.mjs`).

## Dataset Recorder Controls (`src/app/components/dataset/datasetRecorder.js`)

- **Purpose**: handles camera/mic permissions, MediaRecorder loops, dataset updates, and sample annotations per class card.
- **State/guards**:
  - Blocks actions while training runs (`trainingLocked`).
  - Uses `classController` for destructive dataset resets.
  - Calls `sessionStore.updateDatasetStatus/addDatasetSample` to keep readiness hints in sync.
- **Shortcuts**: when the recorder container is focused, `R` starts, `S` stops, and `D` discards (if allowed). Documented inline with `<kbd>` hints.
- **Permissions**: updates `sessionStore.permissions` so `permissionAlerts` and edge streaming know when cameras/mics are blocked.
- **Follow-up**: Scrub slider + metadata counters and the background-noise guidance pill are in place; next focus is polishing per-sample annotations/metadata UX (see `progress.md` backlog).

## Inference Controls (`src/app/components/inference/inferenceControls.js`)

- **Purpose**: prepares the preview stream, exposes start/stop actions, and reports inference status + FPS hints to learners.
- **Guard usage**: delegates destructive navigation to `inferenceController.ensureInferenceStopped` (see `pages/infer/view.js`).
- **Shortcuts**: `P` starts inference and `O` stops it when the panel has focus (mirrors the dataset hotkeys).

## Edge Streaming Context (`src/app/store/selectors.js` & `src/app/components/edge/edgePanel.js`)

- **Purpose**: `getEdgeStreamingContext` centralizes whether streaming is allowed (camera permission + training freshness). `edgePanel` consumes it to disable toggles and surface reasons.
- **Guard usage**: edge disconnect + session discard go through `inferenceController.ensureInferenceStopped`.
- **Tests**: `tests/store/selectors.retry.test.mjs` for selector logic, `tests/routes/sessionController.test.mjs`/`tests/routes/inferenceController.test.mjs` for guards.

## Navigation/Session Controllers

- `navigationController`: flips steps after consulting guards + inference confirmations.
- `sessionController`: discards sessions through the confirm dialog and ensures inference is stopped first.
- `classController`: wraps per-class destructive actions with confirmations.
- `sampleController`: guards per-sample deletes (blocked during training) and runs them through the shared confirm dialog so Collect UI never mutates the store directly.
- `trainingController`: dispatches start requests to `trainWithRecordedSamples` and confirms `abortTraining` so mid-run cancellations are intentional.
- `inferenceController`: central “stop inference before destructive action” guard that now also emits toasts when it has to halt a running preview.

Refer back to `src/app/components/registerComponents.js` for how these are registered in Alpine.
