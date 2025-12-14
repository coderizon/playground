import assert from 'node:assert/strict';
import { createSessionStore, PERMISSION_STATUS } from '../../src/app/store/sessionStore.js';

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

test('setPermissionState updates status and message', () => {
  const store = createSessionStore();
  store.setPermissionState('camera', {
    status: PERMISSION_STATUS.BLOCKED,
    message: 'Blockiert',
  });
  let state = store.getState();
  assert.equal(state.permissions.camera.status, PERMISSION_STATUS.BLOCKED);
  assert.equal(state.permissions.camera.message, 'Blockiert');
  assert.ok(state.permissions.camera.updatedAt);

  const previousTimestamp = state.permissions.camera.updatedAt;
  store.setPermissionState('camera', { message: 'Immer noch blockiert' });
  state = store.getState();
  assert.equal(state.permissions.camera.status, PERMISSION_STATUS.BLOCKED);
  assert.equal(state.permissions.camera.message, 'Immer noch blockiert');
  assert.ok(state.permissions.camera.updatedAt >= previousTimestamp);

  store.setPermissionState('microphone', {
    status: PERMISSION_STATUS.GRANTED,
    message: null,
  });
  state = store.getState();
  assert.equal(state.permissions.microphone.status, PERMISSION_STATUS.GRANTED);
});

test('setPermissionState ignores unknown types', () => {
  const store = createSessionStore();
  store.setPermissionState('unknown', {
    status: PERMISSION_STATUS.BLOCKED,
    message: 'nope',
  });
  const state = store.getState();
  assert.ok(!state.permissions.unknown);
});

if (process.exitCode === undefined) {
  console.log('Session store permission tests passed.');
}
