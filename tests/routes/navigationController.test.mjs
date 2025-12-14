import assert from 'node:assert/strict';
import { createNavigationController } from '../../src/app/routes/navigationController.js';
import {
  STEP,
  DATASET_STATUS,
  TRAINING_STATUS,
  INFERENCE_STATUS,
} from '../../src/app/store/sessionStore.js';

function createStore(initial = {}) {
  let state = {
    step: STEP.HOME,
    selectedTaskModel: null,
    classes: [],
    training: { status: TRAINING_STATUS.IDLE },
    ...initial,
  };
  const transitions = [];
  return {
    getState: () => state,
    setStep: (next) => {
      state = { ...state, step: next };
      transitions.push(next);
    },
    getTransitions: () => [...transitions],
    setState: (patch) => {
      state = { ...state, ...patch };
    },
  };
}

function readyClass() {
  return { dataset: { status: DATASET_STATUS.READY } };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('goCollect only transitions when a task is selected', () => {
  const store = createStore();
  const controller = createNavigationController(store);
  assert.equal(controller.goCollect(), false);
  assert.deepEqual(store.getTransitions(), []);

  store.setState({
    selectedTaskModel: { id: 'test' },
  });
  assert.equal(controller.goCollect(), true);
  assert.deepEqual(store.getTransitions(), [STEP.COLLECT]);
});

test('goTrain enforces class readiness', () => {
  const store = createStore({
    step: STEP.COLLECT,
    selectedTaskModel: { id: 'foo' },
    classes: [{ dataset: { status: DATASET_STATUS.RECORDING } }, readyClass()],
  });
  const controller = createNavigationController(store);
  assert.equal(controller.goTrain(), false);
  assert.deepEqual(store.getTransitions(), []);

  store.setState({
    classes: [readyClass(), readyClass()],
  });
  assert.equal(controller.goTrain(), true);
  assert.deepEqual(store.getTransitions(), [STEP.TRAIN]);
});

test('goInfer requires inference access conditions', () => {
  const store = createStore({
    selectedTaskModel: { id: 'foo', requiresTraining: true },
    training: { status: TRAINING_STATUS.RUNNING },
  });
  const controller = createNavigationController(store);
  assert.equal(controller.goInfer(), false);

  store.setState({
    training: { status: TRAINING_STATUS.DONE },
    inference: { status: INFERENCE_STATUS.IDLE },
  });
  assert.equal(controller.goInfer(), true);
  assert.deepEqual(store.getTransitions(), [STEP.INFER]);
});

test('goHome always transitions to home', () => {
  const store = createStore({ step: STEP.TRAIN });
  const controller = createNavigationController(store);
  assert.equal(controller.goHome(), true);
  assert.deepEqual(store.getTransitions(), [STEP.HOME]);
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
  console.log('Navigation controller tests passed.');
}
