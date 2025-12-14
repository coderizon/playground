import assert from 'node:assert/strict';

function createSessionStoreMock() {
  const listeners = new Set();
  const state = {
    edge: { status: 'disconnected', deviceInfo: null, selectedDevice: null },
    inference: { status: 'idle', streamToEdge: false, predictions: [] },
  };

  const notify = () => {
    listeners.forEach((listener) => listener(state));
  };

  return {
    state,
    listeners,
    sessionStore: {
      subscribe(listener) {
        listeners.add(listener);
        listener(state);
        return () => listeners.delete(listener);
      },
      setEdgeStatus(status, patch = {}) {
        state.edge = { ...state.edge, status, ...patch };
        notify();
      },
      setInferenceStreaming(enabled) {
        state.inference = { ...state.inference, streamToEdge: enabled };
        notify();
      },
    },
  };
}

function createDeviceStubs() {
  const listeners = {};
  const invoked = {
    arduino: { connect: 0 },
  };
  const connectionState = { arduino: false };

  return {
    listeners,
    connectionState,
    invoked,
    devices: {
      arduino: {
        name: 'Arduino Uno R4',
        connect: async () => {
          invoked.arduino.connect += 1;
        },
        isConnected: () => connectionState.arduino,
        setListener(callback) {
          listeners.arduino = callback;
        },
      },
    },
  };
}

async function loadEdgeService(overrides, salt = '') {
  globalThis.__EDGE_TEST_OVERRIDES = overrides;
  const module = await import(
    `../../src/app/services/edge/edgeService.js?ts=${Date.now()}${salt ? `-${salt}` : ''}`
  );
  return module;
}

async function withEdgeHarness(custom = {}, salt = '') {
  const storeMock = createSessionStoreMock();
  const deviceStubs = createDeviceStubs();
  const sentPayloads = [];
  const selectors = {
    isInferenceRunning: () => custom.inferenceRunning ?? true,
    getInferencePredictions: () => storeMock.state.inference.predictions,
  };
  const senders = {
    arduino: async (payload) => {
      if (custom.throwOnSend) {
        throw new Error('Send failed');
      }
      sentPayloads.push(payload);
    },
  };

  const module = await loadEdgeService(
    {
      sessionStore: storeMock.sessionStore,
      selectors,
      devices: deviceStubs.devices,
      senders,
    },
    salt
  );

  return {
    module,
    storeMock,
    deviceStubs,
    sentPayloads,
  };
}

async function connectAndMarkReady(harness) {
  await harness.module.connectDevice('arduino');
  const deviceListener = harness.deviceStubs.listeners.arduino;
  if (!deviceListener) throw new Error('No device listener registered');
  harness.deviceStubs.connectionState.arduino = true;
  deviceListener(true);
}

async function streamingSendsPrediction() {
  const harness = await withEdgeHarness({}, 'success');
  await connectAndMarkReady(harness);
  harness.storeMock.state.inference.predictions = [
    { name: 'Foo', value: 0.4, isBest: false },
    { name: 'Bar', value: 0.87, isBest: true },
  ];
  await harness.module.setStreaming(true);
  assert.equal(harness.storeMock.state.inference.streamToEdge, true);
  assert.deepEqual(harness.sentPayloads, ['Bar:87%']);
}

async function streamingFailureSetsError() {
  const harness = await withEdgeHarness({ throwOnSend: true }, 'error');
  await connectAndMarkReady(harness);
  harness.storeMock.state.inference.predictions = [{ name: 'Foo', value: 0.5, isBest: true }];
  await harness.module.setStreaming(true);
  assert.equal(harness.storeMock.state.inference.streamToEdge, false);
  assert.equal(harness.storeMock.state.edge.status, 'error');
  assert.equal(harness.storeMock.state.edge.error, 'Send failed');
}

try {
  await streamingSendsPrediction();
  await streamingFailureSetsError();
  console.log('Edge service tests passed.');
} catch (error) {
  console.error('Edge service tests failed');
  console.error(error);
  process.exitCode = 1;
}
