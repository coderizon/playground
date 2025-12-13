import assert from 'node:assert/strict';
import {
  canGoToCollect,
  canGoToTraining,
  canAccessTraining,
  canAccessInference,
  canDiscardClass,
  canStartInference,
} from '../../src/app/guards/navigation.js';
import {
  STEP,
  DATASET_STATUS,
  TRAINING_STATUS,
  INFERENCE_STATUS,
} from '../../src/app/store/sessionStore.js';

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

function baseState(overrides = {}) {
  return {
    selectedTaskModel: null,
    step: STEP.HOME,
    classes: [],
    training: { status: TRAINING_STATUS.IDLE },
    inference: { status: INFERENCE_STATUS.IDLE },
    ...overrides,
  };
}

test('cannot go to collect without task', () => {
  assert.equal(canGoToCollect(baseState()), false);
});

test('can go to collect once task selected', () => {
  const state = baseState({ selectedTaskModel: { id: 'foo' } });
  assert.equal(canGoToCollect(state), true);
});

test('cannot go to training until classes ready', () => {
  const state = baseState({
    selectedTaskModel: { id: 'foo' },
    step: STEP.COLLECT,
    classes: [{ dataset: { status: DATASET_STATUS.EMPTY } }],
  });
  assert.equal(canGoToTraining(state), false);
});

test('can access training with two ready classes', () => {
  const readyClass = { dataset: { status: DATASET_STATUS.READY } };
  const state = baseState({
    selectedTaskModel: { id: 'foo' },
    step: STEP.COLLECT,
    classes: [readyClass, readyClass],
  });
  assert.equal(canAccessTraining(state), true);
});

test('inference access bypasses training when not required', () => {
  const state = baseState({
    selectedTaskModel: { id: 'foo', requiresTraining: false },
  });
  assert.equal(canAccessInference(state), true);
});

test('inference requires training done when training required', () => {
  const state = baseState({
    selectedTaskModel: { id: 'foo', requiresTraining: true },
    training: { status: TRAINING_STATUS.DONE },
  });
  assert.equal(canAccessInference(state), true);
});

test('class discard blocked during training', () => {
  const running = baseState({ training: { status: TRAINING_STATUS.RUNNING } });
  assert.equal(canDiscardClass(running), false);
  const idle = baseState({ training: { status: TRAINING_STATUS.IDLE } });
  assert.equal(canDiscardClass(idle), true);
});

test('can start inference only when status idle/stopped and access allowed', () => {
  const allowed = baseState({
    selectedTaskModel: { id: 'foo', requiresTraining: true },
    training: { status: TRAINING_STATUS.DONE },
    inference: { status: INFERENCE_STATUS.STOPPED },
  });
  assert.equal(canStartInference(allowed), true);
  const running = { ...allowed, inference: { status: INFERENCE_STATUS.RUNNING } };
  assert.equal(canStartInference(running), false);
});

if (process.exitCode === undefined) {
  console.log('All guard tests passed.');
}
