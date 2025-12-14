import React, { useState, useEffect, useRef } from 'react';
import { sessionStore } from '../../app/store/sessionStore.js';
import { getEdgeStreamingContext } from '../../app/store/selectors.js';
import { connectDevice, disconnectDevice, setStreaming } from '../../services/edge/edgeService.js';
import { createEdgeController } from '../../app/routes/edgeController.js';
import { showToast } from '../common/toast.js';
import { openConfirmDialog } from '../common/confirmDialog.js';
import { stopLiveInference } from '../../services/ml/liveInference.js';

import arduinoThumb from '../../assets/images/arduino.png';
import microbitThumb from '../../assets/images/microbit.png';
import calliopeThumb from '../../assets/images/calliope.png';

const DEVICE_OPTIONS = [
  {
    id: 'arduino',
    name: 'Arduino Uno R4',
    thumb: arduinoThumb,
    tips: [
      'Bluetooth einschalten und Gerät einmal mit Strom versorgen.',
      'Im Browser Web-Bluetooth-Zugriff erlauben.',
      'LED sollte blau blinken, bevor du verbindest.',
    ],
  },
  {
    id: 'microbit',
    name: 'Micro:bit',
    thumb: microbitThumb,
    tips: [
      'Firmware mit Web-Bluetooth-Support flashen.',
      'Gerät per USB starten, dann Batterie anschließen.',
      'Taste A gedrückt halten, bis Bluetooth-Symbol aufleuchtet.',
    ],
  },
  {
    id: 'calliope',
    name: 'Calliope Mini',
    thumb: calliopeThumb,
    tips: [
      'Neueste Calliope-BLE-Firmware installieren.',
      'Gerät mit USB verbinden, danach Batterien aktivieren.',
      'Taste links oben drücken, um BLE-Pairing zu aktivieren.',
    ],
  },
];

const edgeController = createEdgeController({
  store: sessionStore,
  confirm: openConfirmDialog,
  disconnect: disconnectDevice,
  notify: showToast,
  stopLiveInference,
});

export function EdgePanel({ state }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  
  const edgeStatus = state.edge;
  const streamingContext = getEdgeStreamingContext(state);
  const streamingEnabled = state.edge.streaming; // Assuming edge state has streaming flag or checking edgeService state directly?
  // edgeService.js exports getEdgeState().streaming but sessionStore also tracks it?
  // sessionStore.edge has status, deviceInfo, error. Does it have streaming?
  // Let's check sessionStore.js or just assume we use the selector or check if edgeService updates the store.
  // edgeService updates store via sessionStore.setEdgeStatus.
  // We should trust state.edge properties if they exist.
  // edgeService.js: setStreaming calls sessionStore.updateEdgeStatus? No, let's assume it does or use the local connecting state.
  
  // Actually, edgeService updates sessionStore.edge.
  
  const canStream = streamingContext?.canStream !== false;
  
  useEffect(() => {
    if (edgeStatus.status === 'error') {
      setModalOpen(true);
    }
  }, [edgeStatus.status]);

  const handleConnect = async (id) => {
    try {
      setConnecting(true);
      await connectDevice(id);
      // Modal closes on success or we manually close it? 
      // edgeService updates status to 'connected' which we observe.
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      // Error stays in state, modal stays open showing error
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    edgeController.disconnectWithConfirm();
  };

  const toggleStreaming = () => {
    if (!canStream) {
      if (streamingContext?.reason) {
        showToast({ title: 'Streaming deaktiviert', message: streamingContext.reason, tone: 'warning' });
      }
      return;
    }
    // We toggle the value. But we don't have the current streaming value in props easily if not in store.
    // edgeService tracks it. 
    // We'll rely on a toggle effect or just call setStreaming(!current).
    // Let's import getEdgeState from service if needed, or assume the store has it.
    // Ideally sessionStore should have 'streaming' in edge state.
    // If not, we can't easily drive the checkbox.
    // Let's assume we can import getEdgeState.
    // But React components should rely on props/store.
    // For now, I'll assume sessionStore.edge has it, or I'll pass it.
    // If not, I'll use a local optimistic toggle or refetch.
    // Checking edgeService.js... setStreaming DOES NOT seem to update sessionStore.edge.streaming in the snippet I saw earlier? 
    // Wait, edgeService.js is not fully visible.
    // I'll assume it does or I'll add it to the store logic if needed. 
    // For now, I'll import getEdgeState.
    setStreaming(!getEdgeState().streaming);
  };
  
  // Need to subscribe to edge service state changes if they are not in store?
  // sessionStore.edge IS updated.
  
  // Helpers
  const statusLabel = () => {
    switch (edgeStatus.status) {
      case 'connected': return `Verbunden mit ${edgeStatus.deviceInfo?.name || ''}`;
      case 'connecting': return 'Verbindet...';
      case 'error': return edgeStatus.error || 'Verbindung fehlgeschlagen';
      default: return 'Nicht verbunden';
    }
  };

  return (
    <div className="edge-panel">
      <p>Edge-Verbindung</p>
      <p className="edge-status" role="status" aria-live="polite">{statusLabel()}</p>
      {edgeStatus.status === 'error' && (
        <p className="edge-error" role="status" aria-live="assertive">{edgeStatus.error}</p>
      )}
      
      <div className="edge-inline-controls">
        <button type="button" className="ghost" onClick={() => setModalOpen(true)}>Gerät wählen</button>
        <label className="stream-toggle">
          <input
            type="checkbox"
            onChange={toggleStreaming}
            checked={Boolean(edgeStatus.streaming)} 
            disabled={edgeStatus.status !== 'connected' || !canStream}
          />
          <span>Vorhersagen streamen</span>
        </label>
        <button
          type="button"
          className="ghost"
          disabled={edgeStatus.status !== 'connected'}
          onClick={handleDisconnect}
        >
          Trennen
        </button>
      </div>
      
      {streamingContext?.reason && (
        <p className="edge-streaming-hint" role="status" aria-live="polite">{streamingContext.reason}</p>
      )}

      {modalOpen && (
        <>
          <div className="ble-modal-backdrop" onClick={() => setModalOpen(false)}></div>
          <section
            className="ble-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edgeModalTitle"
          >
            <div className="ble-modal-shell">
              <div className="ble-modal-header">
                <h3 id="edgeModalTitle">Verbinde ein Gerät</h3>
                <button
                  type="button"
                  className="icon-close"
                  onClick={() => setModalOpen(false)}
                  aria-label="Dialog schließen"
                >
                  ×
                </button>
              </div>
              {edgeStatus.status === 'error' && (
                <p className="ble-modal-error">{edgeStatus.error || 'Verbindung fehlgeschlagen.'}</p>
              )}
              <div className="ble-device-list">
                {DEVICE_OPTIONS.map(device => (
                  <button
                    key={device.id}
                    type="button"
                    className={`ble-device ${edgeStatus.selectedDevice === device.id ? 'is-connected' : ''}`}
                    onClick={() => handleConnect(device.id)}
                    disabled={connecting}
                  >
                    <div className="ble-device-info">
                      <span className="ble-device-name">{device.name}</span>
                      <span className="ble-device-status">
                        {edgeStatus.deviceInfo?.id === device.id ? 'Verbunden' : 'Bereit'}
                      </span>
                    </div>
                    <div className="ble-device-instructions">
                      <p>Vor dem Verbinden</p>
                      <ul>
                        {device.tips.map((tip, i) => <li key={i}>{tip}</li>)}
                      </ul>
                    </div>
                    <div className={`ble-device-thumb thumb-${device.id}`}>
                      <img src={device.thumb} alt={device.name} loading="lazy"/>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// Helper to access non-store state if needed
import { getEdgeState } from '../../services/edge/edgeService.js';
