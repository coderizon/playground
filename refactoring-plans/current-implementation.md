# Current Implementation Snapshot & Alignment Notes

## Architecture & Stack
- Single `index.html` renders both the landing “carousel” and the in-app shell simultaneously; visibility is toggled by `src/landing.js` instead of a router or page components.
- No framework is used even though Alpine.js is listed as a dependency; all behavior lives in vanilla ES modules under `src/`, orchestrated imperatively through DOM queries.
- Application state is a mutable singleton exported from `src/state.js`; it mixes session data, training artifacts, BLE flags, gesture caches, and DOM node registries without an explicit session lifecycle.
- UI is laid out as three side-by-side columns (classes, training, preview) that are always rendered; step switching only toggles CSS attributes via `setMobileStep` to highlight buttons on narrow viewports.
- Media and ML responsibilities are intertwined with UI logic (e.g., `src/ml/training.js` owns TensorFlow.js loops *and* DOM updates), so there is no separation between state transitions and rendering as required by the vision document.

## Journey Implementation
### Home / Landing
- Landing cards (defined inline in `index.html`) show five task “modes” with hero imagery and badges; selecting a card calls `startApp(mode)` in `src/landing.js`, which sets the global mode and hides the landing view.
- Modes correspond to `image`, `gesture`, `face`, plus a disabled audio card; this loosely maps to the vision’s “task/model grid,” but there is no dynamic data source, validation, or contextual metadata beyond static copy.
- Session resets are implicit: clicking a new card simply switches the `body[data-mode]` and clears some state in `setMode` without explicit confirmation or session discard affordances.

### Classes & Data Collection
- Class cards are hard-coded markup duplicated in HTML; additional cards are injected by `src/ui/classes.js` by cloning DOM templates and wiring event listeners.
- Naming rules are lax: fields clear on focus but allow empty values, duplicates, and whitespace; there is no validation workflow or dataset status indicator.
- Data collection is manual “press-and-hold”: buttons emit pointer events to `handleCollectStart/End`, which immediately pipe webcam frames through MobileNet and append tensors per frame. There is no expected sample count, auto-stop, or per-class readiness indicator.
- A single webcam preview element is moved between cards; dataset recording UI remains open concurrently, so multiple cards can appear “recording” even if only one class is active.

### Training
- The training card in `index.html` exposes only a “Modell trainieren” button, optional hyper-parameter inputs, and a linear progress bar. There is no dataset summary, gating, or abort option; errors just update a status label.
- `trainAndPredict` switches behavior based on `state.currentMode` (image vs gesture vs face) but always mutates shared global state. Training locks capture panels only after success; there is no concept of session discard or going back to fix data while preserving samples.

### Inference / Preview
- Preview column always renders a webcam feed plus probability list; inference starts automatically after training completes (`predictLoop`) or immediately for the face mode. Users cannot explicitly start/stop inference as required by the vision contract.
- BLE panel is a modal triggered by a global “BLE connect” button. Cards for Arduino, Calliope, and Micro:Bit merely change copy after `connect*` resolves; streaming only exists for Arduino via UART writes in `renderProbabilities` once predictions exceed a hard-coded threshold.
- Device errors surface through `alert()` dialogs and console logs instead of structured status badges.

### Session & Step Awareness
- The body `data-step` attribute is only updated opportunistically (e.g., after training), so the UI can show “Preview” while the user is still collecting data; there is no guard preventing action buttons from being used out of order.
- Destructive flows (resetting, switching modes) happen instantly without confirmation or context about what will be lost, breaking the “safe exit” requirement.

### Quality & A11y Notes
- Keyboard handling exists only for landing cards; class cards, BLE modal, and recording controls rely on pointer events and are not keyboard accessible.
- Status messaging is routed through a single visually hidden `<p id="status">`, but updates are not synchronized with ARIA live regions, so announcements are unreliable.
- Third-party models are loaded directly from public CDNs at runtime (TensorFlow Hub, jsDelivr) without pinning beyond URL versions, which partially satisfies but does not enforce the “pinned dependencies” requirement.

## Where the Prototype Already Aligns with the Vision
- **Linear intent**: The prototype hints at the Home → Collect → Train → Preview flow, and mobile step buttons replicate the three-step journey described in the vision.
- **Task/model selection**: Even though static, the landing grid conveys modality, training requirement, and BLE support via chips, fulfilling the vision’s communication goals for Home.
- **Class-centric collection**: Data gathering revolves around per-class cards with live camera previews, mirroring the “create classes and record samples” core learning surface.
- **Training feedback**: Progress UI, accuracy readouts, and disabled controls during training deliver clear momentum cues once the action starts.
- **Inference surface**: Users see live camera feed, per-class probabilities, and BLE connection options in one place, satisfying the vision’s requirement for an inference-focused page with optional edge streaming hooks.
- **Ephemeral session**: There is no persistence, log-in, or background recording; refreshing the page drops the session, matching the non-goals in the vision document.

## Notable Gaps to Carry Into the Refactor
- No explicit session object or state machine (vision §2 & §6) — global mutable bag cannot enforce invariants.
- Steps are co-located instead of dedicated pages, so backward navigation, gating, and validation rules are unenforced.
- Dataset lifecycle lacks validation, readiness indicators, expected counts, or discard flows described under “Classes & Data Collection.”
- Training cannot be aborted, and inference cannot be explicitly started/stopped, diverging from §§4.3–4.4 rules.
- Device/edge UX is modal-only, not the structured edge panel specified in §4.4, and streaming occurs silently from inference logic rather than through a controlled pipeline.
- Accessibility, permission handling, and dependency pinning fall short of the quality bar in §9.
