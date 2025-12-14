import assert from 'node:assert/strict';
import { createEdgeController } from '../../src/app/routes/edgeController.js';

function createStore(overrides = {}) {
  let state = {
    edge: {
      status: 'connected',
      deviceInfo: { id: 'arduino', name: 'Arduino Uno R4' },
    },
    ...overrides,
  };
  return {
    getState: () => state,
    setState: (next) => {
      state = { ...state, ...next };
    },
  };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('disconnectWithConfirm passes the device name to the confirm dialog', () => {
  const store = createStore();
  let confirmOptions = null;
  const controller = createEdgeController({
    store,
    confirm: (options) => {
      confirmOptions = options;
    },
    disconnect: () => {},
    inferenceController: {
      ensureInferenceStopped: (next) => {
        next?.();
        return true;
      },
    },
  });

  controller.disconnectWithConfirm();
  assert.ok(confirmOptions);
  assert.match(confirmOptions.message, /Arduino Uno R4/);
});

test('disconnectWithConfirm waits for the inference guard and disconnects after confirm', () => {
  const store = createStore();
  let confirmOptions = null;
  let guardNext = null;
  let guardOptions = null;
  let disconnected = false;
  let notifyPayload = null;

  const controller = createEdgeController({
    store,
    confirm: (options) => {
      confirmOptions = options;
    },
    disconnect: () => {
      disconnected = true;
    },
    notify: (payload) => {
      notifyPayload = payload;
    },
    inferenceController: {
      ensureInferenceStopped: (next, options) => {
        guardNext = next;
        guardOptions = options;
        return true;
      },
    },
  });

  controller.disconnectWithConfirm();
  assert.ok(guardNext, 'guard callback provided');
  assert.ok(guardOptions);
  guardNext();
  assert.ok(confirmOptions);
  confirmOptions.onConfirm();
  assert.equal(disconnected, true);
  assert.match(guardOptions.toastMessage, /Inference gestoppt/);
  assert.ok(notifyPayload);
  assert.match(notifyPayload.message, /Arduino Uno R4 wurde getrennt/);
});

test('disconnectWithConfirm aborts when the inference guard blocks execution', () => {
  const store = createStore();
  let confirmCalled = false;
  const controller = createEdgeController({
    store,
    confirm: () => {
      confirmCalled = true;
    },
    disconnect: () => {},
    inferenceController: {
      ensureInferenceStopped: () => false,
    },
  });

  const result = controller.disconnectWithConfirm();
  assert.equal(result, false);
  assert.equal(confirmCalled, false);
});

for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

if (process.exitCode === undefined) {
  console.log('Edge controller tests passed.');
}
