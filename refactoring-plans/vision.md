Perfect — thank you for the clarification.
Below is the **merged, final document**, where:

* **Nothing of the imperative UI/UX journey is lost**
* The **journey text remains the authoritative, declarative “program”**
* The **architectural structure, state model, components, and quality bars** from the earlier version are integrated *around* that journey
* The whole document is **coherent, consistent in wording**, and safe for **LLM-assisted implementation**

You can now treat this as **the single source of truth**.

---

# Playground — UI/UX Architecture & Declarative Journey Specification

> **Status:** Authoritative UI/UX & Frontend Architecture Contract
> **Audience:** Human developers, LLMs, designers
> **Rule:** What is not specified here must not be invented.

---

## Contents

* Vision and non-goals
* The session model
* Global application structure
* Declarative UI/UX journey (Home → Collect → Train → Infer)
* UX building blocks
* Core state model
* Component model
* Device I/O and edge integration
* Quality bar (a11y, performance, security)
* Alpine.js vs React — architectural decision
* Suggested frontend codebase structure

---

## 1. Vision and Non-Goals

### Vision

Playground is a **single-page, guided, in-browser learning application** that enables users to:

1. Select a *(task, model)*,
2. Define semantic classes,
3. Collect labeled datasets via camera or microphone,
4. Train a model when applicable,
5. Run live inference and optionally stream predictions to an edge device.

The UX goal is **clarity, momentum, and safety**:

* the user always knows what to do next,
* progress is visible,
* mistakes are reversible at the session level.

---

### Non-Goals

* No user accounts
* No database
* No persistence across sessions
* No background recording
* No open-ended experimentation beyond the defined flow

Playground is **not a platform**, it is a **guided experience**.

---

## 2. The Session Model (Foundational)

A **session** is the atomic unit of interaction.

### Session lifecycle

* Begins when a *(task, model)* is selected on Home
* Ends when the session is discarded or the page is left/reloaded

### Session invariants

* All data is ephemeral
* All destructive actions are explicit
* A session can always be discarded safely

> **Invariant:**
> The UI must always communicate the current step, available actions, and consequences.

---

## 3. Global Application Structure

Playground is a **Single Page Application (SPA)** structured as an explicit, linear journey:

1. **Home**
2. **Classes & Data Collection**
3. **Training** (conditional)
4. **Inference**

Backward navigation is only allowed when the resulting state remains valid.

---

## 4. Declarative UI/UX Journey (Authoritative)

### 4.1 Home — Task & Model Selection

#### Purpose

The Home page exists **only** to let the user choose *what experiment they want to run*.

#### UI Composition

* A grid of cards, each representing a *(task, model)* combination
* Each card communicates:

  * input modality (camera / audio),
  * whether training is required,
  * interaction type (classification, detection, etc.),
  * relative effort (implicitly).

#### User Action

* Clicking a card:

  * initializes a new session,
  * clears any previous state,
  * transitions to the next required step.

There is no “Back” on Home.

---

### 4.2 Classes & Data Collection

#### Purpose

To let the user **define the meaning of the model** by creating classes and collecting labeled data.

This page is the **core learning surface** of the app.

---

#### Page-Level Controls (Always Visible)

* **Discard session and return Home**
* **Discard all classes**
* **Add class**
* **Go to Training** (disabled until requirements are met)

Disabled controls must always explain *why*.

---

#### Class Lifecycle

A **class** represents a semantic label.

##### Creating a Class

* User clicks **Add class**
* A class card appears
* Class name:

  * required,
  * unique,
  * validated immediately.

A class cannot exist without a valid name.

---

#### Class Card Composition

Each class card contains:

1. Header

   * class name input
   * delete class

2. Dataset status indicator

   * empty | recording | ready

3. Expandable dataset recording section

---

#### Dataset Recording Section

##### Input Preview

* Camera tasks → live camera preview
* Audio tasks → waveform or recording indicator

##### Recording Controls

* Start recording
* Stop recording (when applicable)
* Discard dataset (only after data exists)

---

#### Recording Behavior

* **Camera-based tasks**

  * automatic frame capture
  * stops when expected count is reached

* **Audio-based tasks**

  * one sample per recording
  * fixed duration
  * repeated until expected count is reached

---

#### Progress Feedback

At all times, the UI shows:

* recorded samples,
* expected samples,
* readiness status.

---

#### Navigation Rules

* “Go to Training” is enabled only when:

  * required classes exist,
  * all datasets are sufficient.
* Session and class discarding is always possible.

---

### 4.3 Training (Conditional)

#### Purpose

To transform collected datasets into a usable model.

---

#### UI Composition

* Class and dataset summary
* Training controls:

  * Start training
  * Abort training
* Training progress indicator
* Optional parameter panel (only when safe)

---

#### Rules

* Training locks datasets
* Aborting preserves datasets
* On success:

  * “Go to Inference” becomes enabled
* Session discard remains possible at all times

---

### 4.4 Inference

#### Purpose

To experience the trained (or pre-trained) model live.

---

#### UI Composition

* Input preview (camera / audio)
* Inference controls:

  * start
  * stop
* Live prediction display:

  * class
  * confidence
* Edge device panel:

  * connect / disconnect UART device
  * connection status

---

#### Inference Rules

* Inference runs only when explicitly started
* UI updates are throttled
* While inference is running:

  * destructive navigation requires stopping inference first

---

#### Edge Device Streaming

* UART device lifecycle:

  * disconnected → connecting → connected → error
* Streaming failures do not stop local inference

---

## 5. UX Building Blocks

* **Page** — step-level container
* **Section** — grouped content block
* **Card** — elevated, reusable container
* **Intent-first buttons** — requests with states, not blind actions

---

## 6. Core State Model (Single Source of Truth)

```text
session
 ├─ selectedTaskModel
 ├─ step: home | collect | train | infer
 ├─ classes[]
 │   ├─ id, name
 │   ├─ dataset { status, samples[], recordedCount, expectedCount }
 │   └─ recording { isOpen, isRecording, source }
 ├─ training { status, progress, params, error }
 ├─ inference { status, source, lastPrediction, streamToEdge }
 └─ edge { status, deviceInfo, error }
```

### Status enums

* dataset: `empty | recording | ready | error`
* training: `idle | running | done | aborted | error`
* inference: `idle | running | stopped | error`
* edge: `disconnected | connecting | connected | error`

---

## 7. Component Model

**Pages orchestrate. Components execute.**

### Core components

* TaskModelGrid
* ClassList
* ClassCard
* DatasetRecorder
* CameraPreview
* AudioWaveformPreview
* TrainingPanel
* InferencePanel
* EdgeConnectionPanel
* NoticeBanner
* ConfirmDialog

---

## 8. Device I/O Model

* Permissions requested only when needed
* Clear permission failure states
* No silent background recording
* Always provide a safe exit path

---

## 9. Quality Bar

### Accessibility

* Keyboard navigation
* Visible focus states
* Live announcements for state changes

### Performance

* Isolated high-frequency previews
* Throttled inference UI updates

### Security & Privacy

* Explicit recording indicators
* No silent data transmission
* Sanitized user inputs
* Pinned third-party dependencies

---

## 10. Alpine.js vs React — Final Take

React is the chosen framework **because**:

* Complex state management (media streams, permissions, training locks) requires a stable component lifecycle.
* Declarative rendering eliminates race conditions in DOM manipulation (e.g., camera initialization).
* The ecosystem provides robust tooling for hardware integration (Web Bluetooth, MediaDevices).

### Non-negotiable constraints

1. Single session store (via `useSyncExternalStore`)
2. Functional components with hooks
3. Explicit step transitions
4. Event-driven architecture

Legacy Alpine.js code has been removed.

---

## 11. Suggested Frontend Codebase Structure

```text
src/
  app/
    store/
    routes/
    guards/
  pages/
    Home.jsx
    Collect.jsx
    Train.jsx
    Infer.jsx
  components/
    class/
    dataset/
    training/
    inference/
    edge/
    common/
  services/
    media/
    ml/
    edge/
  styles/
  assets/
```

---

## Final Rule

> **This document is executable intent.
> If a flow, page, section, or transition is not defined here, it must not exist in code.**