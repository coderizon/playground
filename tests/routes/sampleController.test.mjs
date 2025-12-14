import assert from 'node:assert/strict';
import { createSampleController } from '../../src/app/routes/sampleController.js';
import { TRAINING_STATUS } from '../../src/app/store/sessionStore.js';

function createStore(overrides = {}) {
  let state = {
    training: { status: TRAINING_STATUS.IDLE },
    classes: [],
    ...overrides,
  };
  return {
    getState: () => state,
    removeDatasetSample: (classId, sampleId) => {
      state = {
        ...state,
        classes: state.classes.map((cls) =>
          cls.id === classId
            ? {
                ...cls,
                dataset: {
                  ...(cls.dataset || {}),
                  samples: (cls.dataset?.samples || []).filter((sample) => sample.id !== sampleId),
                },
              }
            : cls
        ),
      };
    },
    removeDatasetSamples: (classId, sampleIds = []) => {
      const idSet = new Set(sampleIds);
      state = {
        ...state,
        classes: state.classes.map((cls) =>
          cls.id === classId
            ? {
                ...cls,
                dataset: {
                  ...(cls.dataset || {}),
                  samples: (cls.dataset?.samples || []).filter((sample) => !idSet.has(sample.id)),
                },
              }
            : cls
        ),
      };
    },
  };
}

test('removeSampleWithConfirm prompts and removes sample on approval', () => {
  const store = createStore({
    classes: [
      {
        id: 'c1',
        name: 'Test',
        dataset: { samples: [{ id: 's1', label: 'Frame 1' }] },
      },
    ],
  });
  let captured;
  const controller = createSampleController({
    store,
    confirm: (options) => {
      captured = options;
    },
  });
  const didTrigger = controller.removeSampleWithConfirm('c1', { id: 's1', label: 'Frame 1' });
  assert.equal(didTrigger, true);
  assert.equal(captured.title, 'Sample löschen?');
  captured.onConfirm();
  const samples = store.getState().classes[0].dataset.samples;
  assert.equal(samples.length, 0);
});

test('actions blocked while training is running', () => {
  const store = createStore({
    training: { status: TRAINING_STATUS.RUNNING },
    classes: [
      {
        id: 'c1',
        name: 'Busy',
        dataset: { samples: [{ id: 's1' }] },
      },
    ],
  });
  let called = false;
  const controller = createSampleController({
    store,
    confirm: () => {
      called = true;
    },
  });
  const didTrigger = controller.removeSampleWithConfirm('c1', { id: 's1' });
  assert.equal(didTrigger, false);
  assert.equal(called, false);
});

test('removeSamplesWithConfirm handles bulk removal', () => {
  const store = createStore({
    classes: [
      {
        id: 'c1',
        name: 'Bulk',
        dataset: { samples: [{ id: 's1' }, { id: 's2' }] },
      },
    ],
  });
  let confirmArgs;
  const controller = createSampleController({
    store,
    confirm: (opts) => {
      confirmArgs = opts;
    },
  });
  const triggered = controller.removeSamplesWithConfirm('c1', ['s1', 's2']);
  assert.equal(triggered, true);
  assert.equal(confirmArgs.title, 'Samples löschen?');
  confirmArgs.onConfirm();
  const samples = store.getState().classes[0].dataset.samples;
  assert.equal(samples.length, 0);
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
  console.log('Sample controller tests passed.');
}
