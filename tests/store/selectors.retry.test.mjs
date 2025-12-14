import test from 'node:test';
import assert from 'node:assert/strict';
import { DATASET_STATUS, TRAINING_STATUS } from '../../src/app/store/sessionStore.js';
import {
  getLatestDatasetUpdatedAt,
  getClassesUpdatedSince,
  getTrainingRetryContext,
} from '../../src/app/store/selectors.js';

test('getLatestDatasetUpdatedAt returns newest dataset timestamp', () => {
  const state = {
    classes: [
      { id: 'a', dataset: { status: DATASET_STATUS.READY, lastUpdatedAt: 10 } },
      { id: 'b', dataset: { status: DATASET_STATUS.READY, lastUpdatedAt: 25 } },
    ],
  };
  assert.equal(getLatestDatasetUpdatedAt(state), 25);
  assert.equal(getLatestDatasetUpdatedAt({ classes: [] }), null);
});

test('getClassesUpdatedSince filters classes and retry context surfaces metadata', () => {
  const state = {
    classes: [
      { id: 'a', name: 'A', dataset: { status: DATASET_STATUS.READY, lastUpdatedAt: 10 } },
      { id: 'b', name: 'B', dataset: { status: DATASET_STATUS.READY, lastUpdatedAt: 50 } },
      { id: 'c', name: 'C', dataset: { status: DATASET_STATUS.READY, lastUpdatedAt: null } },
    ],
    training: {
      lastRun: {
        status: TRAINING_STATUS.DONE,
        completedAt: 60,
        datasetUpdatedAt: 20,
      },
    },
  };
  const updates = getClassesUpdatedSince(state, 20);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, 'b');

  const context = getTrainingRetryContext(state);
  assert.equal(context.latestDatasetUpdate, 50);
  assert.equal(context.datasetChangedSinceLastRun, true);
  assert.equal(context.staleClasses.length, 1);
  assert.equal(context.staleClasses[0].name, 'B');

  const emptyContext = getTrainingRetryContext({ classes: [], training: {} });
  assert.equal(emptyContext.datasetChangedSinceLastRun, false);
  assert.equal(emptyContext.staleClasses.length, 0);
});
