# AGENT GUIDELINES — ML Playground Refactor

Use this as a personal scratchpad so every task stays aligned with the contract in `refactoring-plans/vision.md`.

1. **Always update documentation + backlog**
   - After finishing a slice, reflect it under “Current State Snapshot” and adjust “Remaining Work” in `refactoring-plans/progress.md`.
   - If a backlog item is completed, move its details to the snapshot and reword/remove the bullet so it no longer shows as pending.

2. **Guard everything**
   - Navigation or destructive actions must go through the centralized controllers (`navigationController`, `sessionController`, `classController`, `inferenceController`). Never call `sessionStore.setStep` or `sessionStore` mutators directly from UI code.
   - Add/update unit tests (`tests/run-tests.mjs`) whenever controller behavior changes.

3. **Recording experience parity**
   - Audio: keep presets, background coverage, playback, and annotations consistent with `ml-speech`.
   - Camera: capture thumbnails/frame strips + guidance so users can preview variation without re-recording. Next focus: scrub/annotation polish according to the backlog.

4. **BLE + Edge integrity**
   - Do not remove legacy BLE styling until the new modal meets or exceeds the vision requirements.
   - Always run `npm test` (guards + edge) after touching edge/session store code.

5. **No dual UI**
   - We are rewriting the entire experience to the SPA described in `vision.md`. Do not try to sync or revive the legacy prototype; treat the SPA as the single source of truth.

6. **Commit discipline**
   - After each task: run tests, commit with a descriptive message, then pick the next backlog item. Never leave work uncommitted for the next step. But never push unless explicitely asked by the user to do so.
   
7. **Self-directed slices**
   - When finishing a task, choose the next slice yourself from `refactoring-plans/progress.md` (Remaining Work) until the entire `vision.md` contract is satisfied. Do not wait for explicit instructions between slices.
8. **Backlog hygiene**
   - Before starting a new slice, scan `refactoring-plans/progress.md` to confirm each remaining item is still unresolved in the codebase. If an item is already complete, update the snapshot/remaining sections immediately so the backlog never drifts from reality.
