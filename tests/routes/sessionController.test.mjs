import assert from 'node:assert/strict';
import { createSessionController } from '../../src/app/routes/sessionController.js';
import { STEP, INFERENCE_STATUS, TRAINING_STATUS } from '../../src/app/store/sessionStore.js';

function createStore(initial = {}) {
  let state = {
    step: STEP.COLLECT,
    selectedTaskModel: { id: 'demo' },
    inference: { status: INFERENCE_STATUS.IDLE },
    training: { status: TRAINING_STATUS.IDLE },
    ...initial,
  };
  return {
    getState: () => state,
    setState: (patch) => {
      state = { ...state, ...patch };
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
    setInferenceStatus: (status, patch = {}) => {
      state = {
        ...state,
        inference: { ...(state.inference || {}), status, ...patch },
      };
    },
  };
}

function createConfirmStub({ approve = true } = {}) {
  return (options = {}) => {
    if (approve) {
      options.onConfirm?.();
      return true;
    }
    return false;
  };
}

test('discard invokes inference guard before showing confirm', () => {
  const store = createStore({
    step: STEP.INFER,
    inference: { status: INFERENCE_STATUS.RUNNING },
  });
  let guardCalled = false;
  let confirmOptions = null;
  const controller = createSessionController({
    store,
    confirm: (options) => {
      confirmOptions = options;
      options.onConfirm?.();
      return true;
    },
    inferenceController: {
      ensureInferenceStopped: (next) => {
        guardCalled = true;
        store.setInferenceStatus(INFERENCE_STATUS.IDLE, { lastPrediction: null });
        next?.();
        return true;
      },
    },
  });
  controller.discard();
  assert.equal(guardCalled, true);
  assert.ok(confirmOptions);
  assert.equal(store.getState().selectedTaskModel, null);
});

test('discard aborts when confirm declines', () => {
  const store = createStore({
    step: STEP.COLLECT,
    inference: { status: INFERENCE_STATUS.IDLE },
  });
  const controller = createSessionController({
    store,
    confirm: createConfirmStub({ approve: false }),
    inferenceController: {
      ensureInferenceStopped: (next) => {
        next?.();
        return true;
      },
    },
  });
  controller.discard();
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
