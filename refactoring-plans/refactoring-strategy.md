# Refactoring Strategy Toward the Vision

## Objectives
1. Replace the ad-hoc prototype with the declarative, session-driven app described in `vision.md` without losing existing TF.js, MediaPipe, or BLE capabilities.
2. Preserve developer velocity by migrating in vertical slices (Home → Collect → Train → Infer) while keeping the app testable after each slice.
3. Introduce an explicit session store, component boundaries, and UX safeguards so every user interaction is governed by the contract in the vision document.

## Guiding Principles
- **Single source of truth**: move all runtime data into a typed session store (`session`, `classes[]`, `training`, `inference`, `edge`) exposed via React hooks (`useSyncExternalStore`) or a lightweight state machine module.
- **Linear journey enforcement**: render one primary page at a time (Home, Collect, Train, Infer); transitions happen only when guard conditions pass.
- **Event-first components**: keep ML, media, and BLE logic in service modules; UI components emit intents that mutate the store, never call services directly.
- **Incremental migration**: keep the prototype shell running while new pages/components are staged under `src/app`, then switch the entry point once feature parity is reached.

## Step-by-Step Plan
### 1. Session Foundation & Directory Layout
- Scaffold the suggested structure (`src/app/store`, `pages`, `components`, `services`).
- Implement the session store with enums for dataset/training/inference/edge statuses plus derived selectors for guards.
- Move global settings (current mode, hyper-parameters, device flags) into the store and expose actions (`selectTaskModel`, `discardSession`, etc.).

### 2. Home Page & Task/Model Grid
- Rebuild the landing grid as a dedicated page component (`Home.jsx`) fed by structured data.
- Clicking a card should create a fresh session via the store, set `step = collect | infer`, and navigate.
- Add explicit session discard flows accessible from all later pages back to Home.

### 3. Classes & Data Collection Page
- Introduce `ClassList`, `ClassCard`, and `DatasetRecorder` React components.
- Enforce validation rules. Display dataset status chips (`empty`, `recording`, `ready`, `error`).
- Use `useEffect`/`useRef` for stable camera stream initialization and cleanup.

### 4. Training Page
- Move training UI into `Train.jsx` with summary cards and intent-first actions (`start`, `abort`).
- Wrap TensorFlow/MediaPipe training loops so the page only dispatches actions and listens for updates.
- Lock datasets while training.

### 5. Inference Page
- Provide explicit start/stop controls in `Infer.jsx`.
- Present prediction output as a dedicated component using selectors to derive class names.
- Ensure navigation away from inference demands stopping the stream.

### 6. Edge Device Panel & Streaming Pipeline
- Build an `EdgePanel` component that reflects the full lifecycle.
- Move BLE/UART code into `services/edge`, expose events through the store.
- Handle failures without blocking local inference.

### 7. Quality Bar, A11y, and Hardening
- Implement keyboard support, focus management, and ARIA live regions.
- Add permission failure messaging for camera/mic.
- Write smoke tests for each page.

## Migration Notes
- Keep existing modules (`src/ml/*`, `src/bluetooth/*`, `src/camera/*`) but refactor them into pure services consumed by the new store/actions.
- Replaced Alpine.js with React to solve DOM race conditions (specifically `x-ref` issues with video elements).
- Toggle between the legacy shell and the new React-driven SPA via a feature flag until parity, then remove the prototype markup.
