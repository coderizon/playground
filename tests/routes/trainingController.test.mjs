import assert from 'node:assert/strict';
import { createTrainingController } from '../../src/app/routes/trainingController.js';
import { TRAINING_STATUS } from '../../src/app/store/sessionStore.js';

function createStore(status = TRAINING_STATUS.IDLE) {
  const state = { training: { status } };
  return {
    getState: () => state,
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
