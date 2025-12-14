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

## Home Task Grid (`src/app/pages/home/index.js`)

- **Purpose**: SPA entry point for selecting a `(task, model)` combination. Mirrors the landing-grid requirements from `vision.md`.
- **Wiring**: Renders cards from `getAvailableTaskModels()` and calls `sessionStore.startSession(task)` on click. The session sidebar subscribes to the store to show the current task/step, and `Ctrl+Shift+D/H` shortcuts are surfaced inline for discoverability.
- **UX polish**: The hero now renders an explicit journey checklist plus a guardrail panel that restates the session invariants (ephemeral data, controller-only destructive paths, inference stop requirements) so we can drop the legacy landing copy entirely.
- **Accessibility**: cards expose `aria-labelledby`/`aria-describedby`, modality/effort badges have `aria-label`s, and the grid advertises keyboard instructions via `aria-describedby="taskGridHint"`.

## Collect Empty State (`src/app/components/class/collectEmpty.js`)

- **Purpose**: Encourages first-time users to add classes (with tips + CTA) whenever the class list is empty.
- **Wiring**: Registers as `collectEmpty`; subscribes to training lock state and dispatches `sessionStore.addClass()` when the CTA is pressed.
- **Styling**: Uses `.collect-empty` Tailwind tokens so the panel stays visually consistent with the rest of the Collect page.

## Class Card (`src/app/components/class/classCard.js`)

- **Purpose**: Wraps per-class state (name, dataset chip/status, delete intent) so `pages/collect/index.js` only concerns layout.
- **State/guards**:
  - Subscribes to the store to read `classState` and training lock flags.
  - Validates names locally before calling `sessionStore.setClassName`.
  - Calls `classController.removeClassWithConfirm` for destructive actions.

## Dataset Recorder Controls (`src/app/components/dataset/datasetRecorder.js`)

- **Purpose**: prepares the preview stream, exposes start/stop actions, and reports inference status + FPS hints to learners.
- **Guard usage**: delegates destructive navigation to `inferenceController.ensureInferenceStopped` (see `pages/infer/view.js`).
- **Shortcuts**: `P` starts inference and `O` stops it when the panel has focus (mirrors the dataset hotkeys).

## Training Panel (`src/app/components/training/trainingPanel.js`)

- **Purpose**: renders the training CTA/progress surface and subscribes to `trainingPanel()` state so UI + controller logic stay in sync.
- **Data sources**: listens to `getTrainingSummary`, `getDatasetReadinessIssues`, `getAudioBackgroundIssues`, and `getTrainingRetryContext`.
- **Guidance**: surfaces stale class metadata, dataset blockers, microphone-specific background warnings (with CTA copy), and keyboard shortcuts (`T` start / `A` or `Esc` abort) so learners know what to fix before restarting and can run training without the mouse.

## Edge Streaming Context (`src/app/store/selectors.js` & `src/app/components/edge/edgePanel.js`)

- **Purpose**: `getEdgeStreamingContext` centralizes whether streaming is allowed (camera permission + training freshness). `edgePanel` consumes it to disable toggles and surface reasons.
- **Guard usage**: edge disconnect + session discard go through `inferenceController.ensureInferenceStopped`.
- **Tests**: `tests/store/selectors.retry.test.mjs` for selector logic, `tests/routes/sessionController.test.mjs`/`tests/routes/inferenceController.test.mjs` for guards.

## Training Summary Panel (`src/app/components/training/trainingSummaryPanel.js`)

- **Purpose**: Renders the readiness/issue sidebar on the Train page, keeping dataset blockers + audio checks in sync with selectors.
- **State**: subscribes to `getTrainingSummary`, `getDatasetReadinessIssues`, and `getAudioBackgroundIssues`.
- **Usage**: Mounted once in `pages/train/index.js`; keeps CTA logic (`trainingPanel`) focused on actions.

## Navigation/Session Controllers

- `navigationController`: flips steps after consulting guards + inference confirmations.
- `sessionController`: discards sessions through the confirm dialog and ensures inference is stopped first.
- `classController`: wraps per-class destructive actions with confirmations.
- `sampleController`: guards per-sample deletes (blocked during training) and runs them through the shared confirm dialog so Collect UI never mutates the store directly.
- `trainingController`: dispatches start requests to `trainWithRecordedSamples` and confirms `abortTraining` so mid-run cancellations are intentional.
- `inferenceController`: central “stop inference before destructive action” guard that now also emits toasts when it has to halt a running preview.

### Global Keyboard Shortcuts (`src/app/routes/keyboardShortcuts.js`)

- **Purpose**: provides journey-wide access to critical destructive/navigation actions so keyboard-only testers can manage sessions without hunting for buttons.
- **Bindings**:
  - `Ctrl+Shift+D` (or `Cmd+Shift+D` on macOS) → `sessionController.discard()`, only when a session exists.
  - `Ctrl+Shift+H` → `navigationController.goHome()`, only when not already on Home.
- **Guards**: shortcuts bail when focus is inside editable fields and reuse the same controllers/toasts as the on-screen buttons, so confirmations + inference guards still run.
- **Tests**: `tests/routes/keyboardShortcuts.test.mjs` covers modifier handling, focus guards, and noop scenarios.

## External Resource Map (`src/config/externalResources.js`)

- **Purpose**: single source of truth for TF Hub + Mediapipe URLs/versions used across both the SPA and the legacy modules.
- **Usage**: ML services (`modelBridge.js`) and legacy gesture/face scripts import constants instead of hard-coding CDN strings, making it easier to pin or self-host per the vision document. The TF.js runtime is now loaded via `src/utils/loadTf.js`, which consumes the same config and injects the script once during bootstrap.

Refer back to `src/app/components/registerComponents.js` for how these are registered in Alpine.
