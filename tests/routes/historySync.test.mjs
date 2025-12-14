import assert from 'node:assert/strict';
import { STEP, DATASET_STATUS, TRAINING_STATUS } from '../../src/app/store/sessionStore.js';
import { createNavigationController } from '../../src/app/routes/navigationController.js';
import { initHistorySync } from '../../src/app/routes/historySync.js';

function createStore(initial = {}) {
  let state = {
    step: STEP.HOME,
    selectedTaskModel: null,
    classes: [],
    training: { status: TRAINING_STATUS.IDLE },
    inference: { status: 'idle' },
    ...initial,
  };
  const listeners = new Set();
  return {
    getState: () => state,
    setStep: (step) => {
      state = { ...state, step };
      listeners.forEach((listener) => listener(state));
    },
    setState: (patch) => {
      state = { ...state, ...patch };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function createLocationStub() {
  return {
    pathname: '/',
    search: '',
    hash: '',
  };
}

function updateLocationFromUrl(location, url) {
  if (!location) return;
  const hashIndex = url.indexOf('#');
  location.hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
}

function createHistoryStub(location) {
  return {
    pushes: [],
    replaces: [],
    pushState(state, _title, url) {
      this.state = state;
      this.url = url;
      this.pushes.push({ state, url });
      updateLocationFromUrl(location, url);
    },
    replaceState(state, _title, url) {
      this.state = state;
      this.url = url;
      this.replaces.push({ state, url });
      updateLocationFromUrl(location, url);
    },
  };
}

function createEventTargetStub() {
  const handlers = {};
  return {
    addEventListener(type, handler) {
      handlers[type] = handler;
    },
    removeEventListener(type) {
      delete handlers[type];
    },
    dispatch(type, event) {
      handlers[type]?.(event);
    },
  };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('initial hash navigates to requested step when guard allows', () => {
  const store = createStore({
    selectedTaskModel: { id: 'task' },
  });
  const location = createLocationStub();
  location.hash = '#collect';
  const history = createHistoryStub(location);
  const events = createEventTargetStub();
  const controller = createNavigationController(store);

  const cleanup = initHistorySync({ store, history, location, events, controller });
  assert.equal(store.getState().step, STEP.COLLECT);
  assert.equal(history.replaces.at(-1).url, '/#collect');
  cleanup();
});

test('state transitions push hashes onto history stack', () => {
  const store = createStore({
    selectedTaskModel: { id: 'task' },
  });
  const location = createLocationStub();
  const history = createHistoryStub(location);
  const events = createEventTargetStub();
  const controller = createNavigationController(store);
  const cleanup = initHistorySync({ store, history, location, events, controller });

  store.setStep(STEP.COLLECT);
  assert.equal(history.pushes.length, 1);
  assert.equal(history.pushes[0].url, '/#collect');
  cleanup();
});

test('popstate triggers guarded navigation without duplicate pushes', () => {
  const store = createStore({
    selectedTaskModel: { id: 'task' },
  });
  store.setStep(STEP.COLLECT);
  const location = createLocationStub();
  const history = createHistoryStub(location);
  const events = createEventTargetStub();
  const controller = createNavigationController(store);
  const cleanup = initHistorySync({ store, history, location, events, controller });

  store.setStep(STEP.HOME);
  store.setStep(STEP.COLLECT);
  const pushesBeforePop = history.pushes.length;

  events.dispatch('popstate', { state: { step: STEP.HOME } });
  assert.equal(store.getState().step, STEP.HOME);
  assert.equal(history.pushes.length, pushesBeforePop);
  cleanup();
});

test('popstate reverts history when guard prevents navigation', () => {
  const store = createStore({
    selectedTaskModel: { id: 'task', requiresTraining: true },
    classes: [{ dataset: { status: DATASET_STATUS.READY } }],
  });
  const location = createLocationStub();
  const history = createHistoryStub(location);
  const events = createEventTargetStub();
  const controller = createNavigationController(store);
  const cleanup = initHistorySync({ store, history, location, events, controller });

  store.setStep(STEP.COLLECT);
  const pushesBefore = history.pushes.length;
  events.dispatch('popstate', { state: { step: STEP.TRAIN } });
  assert.equal(store.getState().step, STEP.COLLECT);
  assert.equal(history.pushes.length, pushesBefore + 1);
  assert.equal(history.pushes.at(-1).url, '/#collect');
  cleanup();
});

for (const [name, fn] of tests) {
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
  console.log('History sync tests passed.');
}
