import assert from 'node:assert/strict';
import { createSessionStore, TRAINING_STATUS } from '../../src/app/store/sessionStore.js';

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

test('resetDataset clears samples when training idle', () => {
  const store = createSessionStore();
  store.addClass({ name: 'Mic' });
  const classId = store.getState().classes[0].id;
  store.addDatasetSample(classId, { source: 'microphone', durationMs: 500 });
  store.resetDataset(classId);
  const state = store.getState();
  assert.equal(state.classes[0].dataset.samples.length, 0);
  assert.equal(state.classes[0].dataset.status, 'empty');
});

test('resetDataset ignored while training runs', () => {
  const store = createSessionStore();
  store.addClass({ name: 'Mic' });
  const classId = store.getState().classes[0].id;
  store.addDatasetSample(classId, { source: 'microphone', durationMs: 500 });
  store.setTrainingStatus(TRAINING_STATUS.RUNNING, { progress: 10 });
  store.resetDataset(classId);
  const state = store.getState();
  assert.equal(state.classes[0].dataset.samples.length, 1);
  assert.notEqual(state.classes[0].dataset.status, 'empty');
});

if (process.exitCode === undefined) {
  console.log('Session store dataset tests passed.');
}
