import assert from 'node:assert/strict';
import { createClassController } from '../../src/app/routes/classController.js';
import {
  TRAINING_STATUS,
  DATASET_STATUS,
} from '../../src/app/store/sessionStore.js';

function createStore(overrides = {}) {
  let state = {
    classes: [],
    training: { status: TRAINING_STATUS.IDLE },
    ...overrides,
  };
  return {
    getState: () => state,
    setState: (patch) => {
      state = { ...state, ...patch };
    },
    removeClass: (id) => {
      state = { ...state, classes: state.classes.filter((cls) => cls.id !== id) };
    },
    resetDataset: (id) => {
      state = {
        ...state,
        classes: state.classes.map((cls) =>
          cls.id === id
            ? {
                ...cls,
                dataset: { status: DATASET_STATUS.EMPTY, samples: [] },
              }
            : cls
        ),
      };
    },
  };
}

test('removeClassWithConfirm prompts and removes on approval', () => {
  const store = createStore({
    classes: [{ id: 'c1', name: 'Test' }],
  });
  let captured;
  const confirm = (options) => {
    captured = options;
  };
  const controller = createClassController({ store, confirm });
  const triggered = controller.removeClassWithConfirm(store.getState().classes[0]);
  assert.equal(triggered, true);
  assert.equal(captured.title, 'Klasse löschen?');
  captured.onConfirm();
  assert.equal(store.getState().classes.length, 0);
});

test('discardDatasetWithConfirm clears samples via controller', () => {
  const store = createStore({
    classes: [{ id: 'c1', name: 'Foo', dataset: { status: DATASET_STATUS.READY } }],
  });
  let clearedId = null;
  let captured;
  const controller = createClassController({
    store,
    confirm: (options) => {
      captured = options;
    },
    clearDataset: (id) => {
      clearedId = id;
    },
  });
  const triggered = controller.discardDatasetWithConfirm('c1');
  assert.equal(triggered, true);
  captured.onConfirm();
  assert.equal(clearedId, 'c1');
});

test('actions blocked during training', () => {
  const store = createStore({
    training: { status: TRAINING_STATUS.RUNNING },
    classes: [{ id: 'c1', name: 'Busy' }],
  });
  let called = false;
  const controller = createClassController({ store, confirm: () => (called = true) });
  assert.equal(controller.removeClassWithConfirm(store.getState().classes[0]), false);
  assert.equal(controller.discardDatasetWithConfirm('c1'), false);
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
  console.log('Class controller tests passed.');
}
