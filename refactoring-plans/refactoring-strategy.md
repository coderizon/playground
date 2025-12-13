# Refactoring Strategy Toward the Vision

## Objectives
1. Replace the ad-hoc prototype with the declarative, session-driven app described in `vision.md` without losing existing TF.js, MediaPipe, or BLE capabilities.
2. Preserve developer velocity by migrating in vertical slices (Home → Collect → Train → Infer) while keeping the app testable after each slice.
3. Introduce an explicit session store, component boundaries, and UX safeguards so every user interaction is governed by the contract in the vision document.

## Guiding Principles
- **Single source of truth**: move all runtime data into a typed session store (`session`, `classes[]`, `training`, `inference`, `edge`) exposed via Alpine.js stores or a lightweight state machine module.
- **Linear journey enforcement**: render one primary page at a time (Home, Collect, Train, Infer); transitions happen only when guard conditions pass.
- **Event-first components**: keep ML, media, and BLE logic in service modules; UI components emit intents that mutate the store, never call services directly.
- **Incremental migration**: keep the prototype shell running while new pages/components are staged under `src/app`, then switch the entry point once feature parity is reached.

## Step-by-Step Plan
### 1. Session Foundation & Directory Layout
- Scaffold the suggested structure (`src/app/store`, `pages`, `components`, `services`).
- Implement the session store with enums for dataset/training/inference/edge statuses plus derived selectors for guards.
- Move global settings (current mode, hyper-parameters, device flags) into the store and expose actions (`selectTaskModel`, `discardSession`, etc.).

### 2. Home Page & Task/Model Grid
- Rebuild the landing grid as a dedicated page component fed by structured data (task id, modality, training requirement, BLE capability, availability flag).
- Clicking a card should create a fresh session via the store, set `step = collect | infer` depending on the model, and navigate to the correct page.
- Add explicit session discard flows (modal confirmation) accessible from all later pages back to Home.

### 3. Classes & Data Collection Page
- Introduce `ClassList`, `ClassCard`, and `DatasetRecorder` components that read/write `classes[]` entries from the store.
- Enforce validation rules (unique names, non-empty). Display dataset status chips (`empty`, `recording`, `ready`, `error`) and expected vs recorded counts.
- Split recording services by modality (camera/audio) and gate hardware permissions until the recorder opens. Ensure class deletion/discard flows follow session safety rules.

### 4. Training Page
- Move training UI into its own page with summary cards (dataset completeness, warnings) plus intent-first actions (`start`, `abort`).
- Wrap TensorFlow/MediaPipe training loops in `services/ml/*` so the page only dispatches `startTraining`/`abortTraining` actions and listens for progress updates.
- Lock datasets while training, allow abort to keep samples, and enable `Go to Infer` only when training status is `done`.

### 5. Inference Page
- Provide explicit start/stop controls bound to the store (`inference.status`). Throttle UI updates and re-use the preview components with clearer state indicators.
- Present prediction output as a dedicated component with `NoticeBanner` for gating (e.g., “train first”).
- Ensure navigation away from inference demands stopping the stream to satisfy the vision’s safety rule.

### 6. Edge Device Panel & Streaming Pipeline
- Build an `EdgeConnectionPanel` component that reflects the full lifecycle (`disconnected → connecting → connected → error`) for each supported device.
- Move BLE/UART code into `services/edge`, expose events through the store, and trigger streaming via explicit toggles (e.g., “Stream predictions to device”).
- Handle failures without blocking local inference and surface recoverable errors through structured messaging instead of `alert()`.

### 7. Quality Bar, A11y, and Hardening
- Implement keyboard support for all interactive components, focus management for dialogs, and ARIA live regions tied to store state.
- Add permission failure messaging for camera/mic, sanitize user-provided labels, and pin CDN dependencies (self-host or lock versions).
- Write Cypress/component smoke tests for each page to guard against regression as the refactor proceeds.

## Migration Notes
- Keep existing modules (`src/ml/*`, `src/bluetooth/*`, `src/camera/*`) but refactor them into pure services consumed by the new store/actions; delete unused DOM hooks once the new UI ships.
- Toggle between the legacy shell and the new Alpine-driven SPA via a feature flag/env var until the new flow reaches feature parity, then remove the prototype markup entirely.
