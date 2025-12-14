import test from 'node:test';
import assert from 'node:assert/strict';
import { DATASET_STATUS, TRAINING_STATUS, PERMISSION_STATUS } from '../../src/app/store/sessionStore.js';
import {
  getLatestDatasetUpdatedAt,
  getClassesUpdatedSince,
  getTrainingRetryContext,
  getPermissionIssues,
  getEdgeStreamingContext,
  getAudioBackgroundIssues,
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

test('getPermissionIssues returns blocked entries with copy fallback', () => {
  const state = {
    permissions: {
      camera: {
        status: PERMISSION_STATUS.BLOCKED,
        message: 'Kamera deaktiviert',
        updatedAt: 10,
      },
      microphone: {
        status: PERMISSION_STATUS.GRANTED,
        message: null,
        updatedAt: 5,
      },
    },
  };
  const issues = getPermissionIssues(state);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].type, 'camera');
  assert.equal(issues[0].message, 'Kamera deaktiviert');
  assert.equal(issues[0].title.includes('Kamera'), true);
});

test('getEdgeStreamingContext reflects permissions and training recency', () => {
  const baseState = {
    permissions: {
      camera: {
        status: PERMISSION_STATUS.BLOCKED,
        message: 'Kamera deaktiviert',
        updatedAt: 10,
      },
      microphone: {
        status: PERMISSION_STATUS.GRANTED,
      },
    },
    training: {
      lastRun: {
        status: TRAINING_STATUS.DONE,
        completedAt: 100,
        datasetUpdatedAt: 100,
      },
    },
    classes: [],
  };
  let context = getEdgeStreamingContext(baseState);
  assert.equal(context.canStream, false);
  assert.equal(context.reasonType, 'permission');

  const trainingState = {
    ...baseState,
    permissions: {
      camera: { status: PERMISSION_STATUS.GRANTED, message: null },
    },
    classes: [
      {
        id: 'a',
        name: 'A',
        dataset: { status: DATASET_STATUS.READY, lastUpdatedAt: 200 },
      },
    ],
  };
  const stateWithRetry = {
    ...trainingState,
    training: {
      lastRun: {
        status: TRAINING_STATUS.DONE,
        completedAt: 150,
        datasetUpdatedAt: 150,
      },
    },
  };
  context = getEdgeStreamingContext(stateWithRetry);
  assert.equal(context.canStream, false);
  assert.equal(context.reasonType, 'training');
  assert.ok(context.reason.includes('Trainiere erneut'));

  const okState = {
    ...trainingState,
    training: {
      lastRun: {
        status: TRAINING_STATUS.DONE,
        completedAt: 200,
        datasetUpdatedAt: 200,
      },
    },
  };
  context = getEdgeStreamingContext(okState);
  assert.equal(context.canStream, true);
  assert.equal(context.reason, '');
});

test('getAudioBackgroundIssues flags missing background samples during audio sessions', () => {
  const state = {
    selectedTaskModel: { inputModality: 'microphone' },
    classes: [
      {
        id: 'a',
        name: 'A',
        dataset: {
          samples: [
            { id: 'a1', source: 'microphone', durationMs: 1000 },
            { id: 'a2', source: 'microphone', durationMs: 1200 },
          ],
        },
      },
      {
        id: 'b',
        name: 'B',
        dataset: {
          samples: [
            { id: 'b1', source: 'microphone', durationMs: 21000 },
          ],
        },
      },
    ],
  };
  const issues = getAudioBackgroundIssues(state);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].name, 'A');
  assert.ok(issues[0].reason.includes('Hintergrundaufnahme'));

  const okState = {
    ...state,
    classes: [
      {
        id: 'a',
        name: 'A',
        dataset: {
          samples: [{ id: 'bg', preset: 'background', durationMs: 15000 }],
        },
      },
    ],
  };
  assert.equal(getAudioBackgroundIssues(okState).length, 0);

  const nonAudioState = {
    selectedTaskModel: { inputModality: 'camera' },
    classes: state.classes,
  };
  assert.equal(getAudioBackgroundIssues(nonAudioState).length, 0);
});
