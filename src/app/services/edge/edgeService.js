import {
  connectArduino,
  isArduinoConnected,
  setArduinoConnectionListener,
  sendToArduino,
} from '../../../bluetooth/arduino.js';
import {
  connectMicrobit,
  isMicrobitConnected,
  setMicrobitConnectionListener,
} from '../../../bluetooth/microbit.js';
import {
  connectCalliope,
  isCalliopeConnected,
  setCalliopeConnectionListener,
} from '../../../bluetooth/calliope.js';
import { sessionStore } from '../../store/sessionStore.js';
import { isInferenceRunning, getInferencePredictions } from '../../store/selectors.js';

const devices = {
  arduino: {
    name: 'Arduino Uno R4',
    connect: connectArduino,
    isConnected: isArduinoConnected,
    setListener: setArduinoConnectionListener,
  },
  microbit: {
    name: 'Micro:bit',
    connect: connectMicrobit,
    isConnected: isMicrobitConnected,
    setListener: setMicrobitConnectionListener,
  },
  calliope: {
    name: 'Calliope Mini',
    connect: connectCalliope,
    isConnected: isCalliopeConnected,
    setListener: setCalliopeConnectionListener,
  },
};

const state = {
  selectedDevice: null,
  connecting: false,
  error: null,
  streaming: false,
};

Object.entries(devices).forEach(([key, device]) => {
  device.setListener((connected) => {
    if (connected && state.selectedDevice !== key) {
      state.selectedDevice = key;
    }
    sessionStore.setEdgeStatus(connected ? 'connected' : 'disconnected', {
      deviceInfo: connected ? { id: key, name: device.name } : null,
    });
    state.connecting = false;
  });
});

export function getEdgeState() {
  return { ...state };
}

export async function connectDevice(deviceId) {
  const device = devices[deviceId];
  if (!device) throw new Error('Unbekanntes Gerät');
  if (device.isConnected()) {
    sessionStore.setEdgeStatus('connected', { deviceInfo: { id: deviceId, name: device.name } });
    return;
  }
  state.selectedDevice = deviceId;
  state.connecting = true;
  state.error = null;
  sessionStore.setEdgeStatus('connecting', { deviceInfo: { id: deviceId, name: device.name } });
  try {
    await device.connect();
  } catch (error) {
    console.error(error);
    state.error = error.message;
    sessionStore.setEdgeStatus('error', { error: error.message });
    state.connecting = false;
  }
}

export function disconnectDevice() {
  state.selectedDevice = null;
  sessionStore.setEdgeStatus('disconnected', { deviceInfo: null });
  state.streaming = false;
}

sessionStore.subscribe((sessionState) => {
  if (state.streaming && sessionState.edge.status === 'connected' && isInferenceRunning(sessionState)) {
    const predictions = getInferencePredictions(sessionState);
    const top = predictions.find((row) => row.isBest);
    if (top) {
      sendPrediction(`${top.name}:${Math.round((top.value || 0) * 100)}%`);
    }
  }
});

export function setStreaming(enabled) {
  state.streaming = enabled;
}

function sendPrediction(payload) {
  if (state.selectedDevice === 'arduino') {
    sendToArduino(payload);
  }
  // TODO: add implementations for microbit/calliope when available
}
