import assert from 'node:assert/strict';
import { createSessionController } from '../../src/app/routes/sessionController.js';
import {
  STEP,
  INFERENCE_STATUS,
  TRAINING_STATUS,
} from '../../src/app/store/sessionStore.js';

function createStore(initial = {}) {
  let state = {
    step: STEP.COLLECT,
    selectedTaskModel: { id: 'demo' },
    inference: { status: INFERENCE_STATUS.IDLE },
    training: { status: TRAINING_STATUS.IDLE },
    ...initial,
  };
  const listeners = new Set();
  const store = {
    getState: () => state,
    setState: (patch) => {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state));
    },
    setStep: (step) => {
      state = { ...state, step };
    },
    discardSession: () => {
      state = {
        step: STEP.HOME,
        selectedTaskModel: null,
        inference: { status: INFERENCE_STATUS.IDLE },
        training: { status: TRAINING_STATUS.IDLE },
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  store.setInferenceStatus = (status, patch = {}) => {
    const next = { ...(state.inference || {}), status, ...patch };
    store.setState({ inference: next });
  };
  return store;
}

test('discardSessionWithConfirm stops inference before discarding', () => {
  const store = createStore({
    step: STEP.INFER,
    inference: { status: INFERENCE_STATUS.RUNNING },
  });
  const controller = createSessionController(store);
  const confirmed = controller.discard({ confirm: () => true });
  assert.equal(confirmed, true);
  assert.equal(store.getState().inference.status, INFERENCE_STATUS.IDLE);
  assert.equal(store.getState().selectedTaskModel, null);
});

test('discardSessionWithConfirm aborts when confirmation returns false', () => {
  const store = createStore({
    step: STEP.COLLECT,
    inference: { status: INFERENCE_STATUS.IDLE },
  });
  const controller = createSessionController(store);
  const confirmed = controller.discard({ confirm: () => false });
  assert.equal(confirmed, false);
  assert.notEqual(store.getState().selectedTaskModel, null);
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
  console.log('Session controller tests passed.');
}
