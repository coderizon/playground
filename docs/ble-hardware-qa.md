# Edge Streaming Hardware QA Checklist

> Goal: verify that camera inference + BLE streaming works on the physical boards (Arduino Uno R4 WiFi, BBC Micro:bit V2, Calliope Mini) before every release that touches `services/edge/*`, `sessionStore.edge`, or the inference UI.

## 1. Test Bench Preparation

1. **Browser**: Chrome ≥ 120 or Edge ≥ 120 on desktop; enable Web Bluetooth (`chrome://flags/#enable-experimental-web-platform-features` if required).
2. **Serve the app via HTTPS** (e.g., `npm run dev -- --host 0.0.0.0 --https`) so Web Bluetooth can pair.
3. **Test account**: none needed, but clear previous sessions (`localStorage.clear()`).
4. **Models**: pick the default “Bildklassifikation” model so camera inference + streaming are available without custom setup.
5. **Camera permissions**: grant once on Home or Collect to avoid pop-ups during inference.

## 2. Device-Specific Prep

| Device       | Firmware / Sketch                                             | Power / Pairing hints                                             |
|--------------|---------------------------------------------------------------|-------------------------------------------------------------------|
| Arduino R4   | `ArduinoBLE` UART sketch exposing UUID `6e400001-b5a3-f393-e0a9-e50e24dcca9e`. | Connect USB for power, toggle reset so the blue BLE LED pulses.   |
| Micro:bit V2 | MakeCode program with BLE UART service + handler for UART text. | Hold **A** on power-up to ensure BLE pairing mode, verify LED “Bluetooth” icon. |
| Calliope Mini| Latest BLE firmware with UART notifications.                  | Connect USB first, then enable batteries; press upper-left button for pairing. |

## 3. Release Validation Flow

Repeat the following steps once per device; capture findings in the release checklist.

1. **Start New Session**
   - Load `/` → choose any trainable vision task.
   - Add two classes, record ≥ 5 samples each (webcam).
   - Train the model (mock or real).
2. **Connect Edge Device**
   - Go to Inference.
   - Click “Gerät wählen”.
   - Pick the device under test; approve the Web Bluetooth prompt.
   - Verify the modal updates to “Verbunden” and the panel shows the device name.
3. **Stream Predictions**
   - Start inference (camera preview should be active).
   - Toggle “Vorhersagen streamen”.
   - Move an object the model recognizes; confirm:
     - In-app predictions update.
     - Device receives UART text (`<CLASS>:<PERCENT>%`). For Arduino, watch Serial Monitor; for Micro:bit/Calliope, log via USB or BLE console.
4. **Error Handling Check**
   - Physically reset the device or walk out of range while streaming.
   - Expect: BLE modal auto-opens, streaming toggle turns off, `edgeStatus` shows an error.
   - Reconnect and ensure streaming resumes without page reload.
5. **Disconnect Flow**
   - Use the inline “Trennen” button.
   - Confirm modal status resets to “Bereit”, streaming toggle clears, and no residual errors remain.

## 4. Logging and Sign-Off

- Record firmware versions, browser version, and OS build.
- Capture console logs for any failures (download via `chrome://device-log` if needed).
- File bugs referencing the exact checklist step number.
- Release is blocked if **any** device fails steps 2–5; mitigations must be documented in `progress.md`.

## 5. Troubleshooting Tips

- If the modal stays in “Verbindet…”, unplug the device and retry from step 2.
- For Micro:bit/Calliope, ensure no other BLE tab is paired; use OS settings to remove stale bonds.
- Use the new `npm test` suite (guards + store + edgeService) locally before running this checklist; fix unit failures first to avoid chasing hardware issues caused by logic regressions.
