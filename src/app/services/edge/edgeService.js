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
  sendToMicrobit,
} from '../../../bluetooth/microbit.js';
import {
  connectCalliope,
  isCalliopeConnected,
  setCalliopeConnectionListener,
  sendToCalliope,
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
      error: null,
      selectedDevice: state.selectedDevice,
    });
    state.connecting = false;
    if (!connected) {
      state.streaming = false;
    }
  });
});

export function getEdgeState() {
  return { ...state };
}

export async function connectDevice(deviceId) {
  const device = devices[deviceId];
  if (!device) throw new Error('Unbekanntes Gerät');
  if (device.isConnected()) {
    state.selectedDevice = deviceId;
    sessionStore.setEdgeStatus('connected', {
      deviceInfo: { id: deviceId, name: device.name },
      selectedDevice: state.selectedDevice,
      error: null,
    });
    return;
  }
  state.selectedDevice = deviceId;
  state.connecting = true;
  state.error = null;
  sessionStore.setEdgeStatus('connecting', {
    deviceInfo: { id: deviceId, name: device.name },
    selectedDevice: state.selectedDevice,
    error: null,
  });
  try {
    await device.connect();
  } catch (error) {
    console.error(error);
    state.error = error.message;
    sessionStore.setEdgeStatus('error', {
      error: error.message,
      selectedDevice: state.selectedDevice,
      deviceInfo: { id: deviceId, name: device.name },
    });
    state.connecting = false;
  }
}

export function disconnectDevice() {
  sessionStore.setEdgeStatus('disconnected', {
    deviceInfo: null,
    selectedDevice: state.selectedDevice,
  });
  state.streaming = false;
  state.error = null;
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
  sessionStore.setInferenceStreaming(enabled);
}

async function sendPrediction(payload) {
  if (!state.selectedDevice) return;
  try {
    switch (state.selectedDevice) {
      case 'arduino':
        await sendToArduino(payload);
        break;
      case 'microbit':
        await sendToMicrobit(payload);
        break;
      case 'calliope':
        await sendToCalliope(payload);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error('Streaming fehlgeschlagen', error);
    handleStreamingError(error);
  }
}

function handleStreamingError(error) {
  state.error = error?.message || 'Streaming fehlgeschlagen';
  state.streaming = false;
  sessionStore.setInferenceStreaming(false);
  sessionStore.setEdgeStatus('error', {
    error: state.error,
    deviceInfo: state.selectedDevice
      ? { id: state.selectedDevice, name: devices[state.selectedDevice]?.name }
      : null,
    selectedDevice: state.selectedDevice,
  });
}
