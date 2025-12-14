import assert from 'node:assert/strict';
import { createInferenceController } from '../../src/app/routes/inferenceController.js';
import { INFERENCE_STATUS } from '../../src/app/store/sessionStore.js';

function createStore(overrides = {}) {
  let state = {
    inference: { status: INFERENCE_STATUS.IDLE },
    ...overrides,
  };
  return {
    getState: () => state,
    setInferenceStatus: (status) => {
      state = { ...state, inference: { ...state.inference, status } };
    },
  };
}

test('ensureInferenceStopped runs callback immediately when idle', () => {
  const store = createStore();
  let nextCalled = false;
  const confirm = () => {
    throw new Error('confirm should not be called');
  };
  const controller = createInferenceController({
    store,
    confirm,
    stopLiveInference: () => {},
  });
  const result = controller.ensureInferenceStopped(() => {
    nextCalled = true;
  });
  assert.equal(result, true);
  assert.equal(nextCalled, true);
});

test('ensureInferenceStopped opens confirm when running', () => {
  const store = createStore({
    inference: { status: INFERENCE_STATUS.RUNNING },
  });
  let confirmOptions = null;
  let stopCalled = false;
  const controller = createInferenceController({
    store,
    confirm: (options) => {
      confirmOptions = options;
    },
    stopLiveInference: () => {
      stopCalled = true;
    },
  });
  const result = controller.ensureInferenceStopped(() => {
    stopCalled = stopCalled && true;
  });
  assert.equal(result, false);
  assert.equal(typeof confirmOptions.onConfirm, 'function');
  confirmOptions.onConfirm();
  assert.equal(stopCalled, true);
});

function test(name, fn) {
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
  console.log('Inference controller tests passed.');
}
