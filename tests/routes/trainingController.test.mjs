import assert from 'node:assert/strict';
import { createTrainingController } from '../../src/app/routes/trainingController.js';
import { TRAINING_STATUS } from '../../src/app/store/sessionStore.js';

function createStore(status = TRAINING_STATUS.IDLE, params = {}) {
  const state = { training: { status, params } };
  let lastUpdate = null;
  return {
    getState: () => state,
    setTrainingStatus: (s, p) => {
      lastUpdate = { status: s, patch: p };
    },
    getLastUpdate: () => lastUpdate,
  };
}

test('start delegates to trainWithRecordedSamples', () => {
  let started = false;
  const controller = createTrainingController({
    store: createStore(),
    trainWithRecordedSamples: () => {
      started = true;
    },
    abortTraining: () => {},
    confirm: () => {},
  });
  controller.start();
  assert.equal(started, true);
});

test('abort prompts when training running', () => {
  let aborted = false;
  let captured;
  const controller = createTrainingController({
    store: createStore(TRAINING_STATUS.RUNNING),
    confirm: (options) => {
      captured = options;
    },
    abortTraining: () => {
      aborted = true;
    },
    trainWithRecordedSamples: () => {},
  });
  const triggered = controller.abort();
  assert.equal(triggered, true);
  assert.equal(captured.title, 'Training abbrechen?');
  captured.onConfirm();
  assert.equal(aborted, true);
});

test('abort does nothing when idle', () => {
  let called = false;
  const controller = createTrainingController({
    store: createStore(TRAINING_STATUS.IDLE),
    confirm: () => {
      called = true;
    },
    abortTraining: () => {},
    trainWithRecordedSamples: () => {},
  });
  const triggered = controller.abort();
  assert.equal(triggered, false);
  assert.equal(called, false);
});

test('updateParams updates valid params', () => {
  const store = createStore(TRAINING_STATUS.IDLE, { epochs: 10, batchSize: 5, learningRate: 0.001 });
  const controller = createTrainingController({
    store,
    confirm: () => {},
    abortTraining: () => {},
    trainWithRecordedSamples: () => {},
  });
  
  controller.updateParams({ epochs: 20, batchSize: 16 });
  const update = store.getLastUpdate();
  
  assert.equal(update.status, TRAINING_STATUS.IDLE);
  assert.equal(update.patch.params.epochs, 20);
  assert.equal(update.patch.params.batchSize, 16);
  assert.equal(update.patch.params.learningRate, 0.001); // unchanged
});

test('updateParams validates inputs', () => {
  const store = createStore(TRAINING_STATUS.IDLE, { epochs: 10 });
  const controller = createTrainingController({
    store,
    confirm: () => {},
    abortTraining: () => {},
    trainWithRecordedSamples: () => {},
  });
  
  controller.updateParams({ epochs: -5, batchSize: 'invalid' });
  const update = store.getLastUpdate();
  
  assert.equal(update.patch.params.epochs, 1); // min 1
  assert.equal(update.patch.params.batchSize, 1); // fallback
});

test('updateParams does nothing when running', () => {
  const store = createStore(TRAINING_STATUS.RUNNING);
  const controller = createTrainingController({
    store,
    confirm: () => {},
    abortTraining: () => {},
    trainWithRecordedSamples: () => {},
  });
  
  const result = controller.updateParams({ epochs: 20 });
  assert.equal(result, false);
  assert.equal(store.getLastUpdate(), null);
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
  console.log('Training controller tests passed.');
}