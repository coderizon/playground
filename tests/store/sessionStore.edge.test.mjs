import assert from 'node:assert/strict';
import { createSessionStore, EDGE_STATUS } from '../../src/app/store/sessionStore.js';

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

test('setEdgeStatus stores device info and clears error on recovery', () => {
  const store = createSessionStore();
  store.setEdgeStatus(EDGE_STATUS.CONNECTED, {
    deviceInfo: { id: 'microbit', name: 'Micro:bit' },
    selectedDevice: 'microbit',
    error: null,
  });
  let state = store.getState();
  assert.equal(state.edge.status, EDGE_STATUS.CONNECTED);
  assert.deepEqual(state.edge.deviceInfo, { id: 'microbit', name: 'Micro:bit' });
  assert.equal(state.edge.selectedDevice, 'microbit');
  assert.equal(state.edge.error, null);

  store.setEdgeStatus(EDGE_STATUS.ERROR, { error: 'Verbindung fehlgeschlagen' });
  state = store.getState();
  assert.equal(state.edge.status, EDGE_STATUS.ERROR);
  assert.equal(state.edge.error, 'Verbindung fehlgeschlagen');
  assert.equal(state.edge.selectedDevice, 'microbit');

  store.setEdgeStatus(EDGE_STATUS.CONNECTING, {
    deviceInfo: { id: 'microbit', name: 'Micro:bit' },
  });
  state = store.getState();
  assert.equal(state.edge.status, EDGE_STATUS.CONNECTING);
  assert.equal(state.edge.error, null);
});

test('setEdgeStatus keeps selected device when patch omits it', () => {
  const store = createSessionStore();
  store.setEdgeStatus(EDGE_STATUS.CONNECTED, {
    deviceInfo: { id: 'calliope', name: 'Calliope Mini' },
    selectedDevice: 'calliope',
  });
  store.setEdgeStatus(EDGE_STATUS.ERROR, { error: 'Streaming fehlgeschlagen' });
  let state = store.getState();
  assert.equal(state.edge.selectedDevice, 'calliope');

  store.setEdgeStatus(EDGE_STATUS.DISCONNECTED, {
    deviceInfo: null,
  });
  state = store.getState();
  assert.equal(state.edge.deviceInfo, null);
  assert.equal(state.edge.selectedDevice, 'calliope');
});

if (process.exitCode === undefined) {
  console.log('Session store edge tests passed.');
}
