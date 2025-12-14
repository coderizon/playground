import assert from 'node:assert/strict';
import { createShortcutHandler } from '../../src/app/routes/keyboardShortcuts.js';
import { STEP } from '../../src/app/store/sessionStore.js';

function createStore(initial = {}) {
  let state = { step: STEP.COLLECT, selectedTaskModel: null, ...initial };
  return {
    getState: () => state,
    setState: (patch) => {
      state = { ...state, ...patch };
    },
  };
}

function createEvent(overrides = {}) {
  let prevented = false;
  return {
    key: overrides.key ?? '',
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    target: overrides.target ?? { tagName: 'div' },
    defaultPrevented: false,
    preventDefault() {
      prevented = true;
      this.defaultPrevented = true;
    },
    get prevented() {
      return prevented;
    },
  };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('Ctrl+Shift+D discards the session when one is active', () => {
  const store = createStore({ selectedTaskModel: { id: 'foo' } });
  let discarded = 0;
  const handler = createShortcutHandler({
    store,
    discardSession: () => {
      discarded += 1;
    },
    goHome: () => {},
  });
  const event = createEvent({ key: 'd', ctrlKey: true, shiftKey: true });
  handler(event);
  assert.equal(discarded, 1);
  assert.equal(event.prevented, true);
});

test('Ctrl+Shift+D ignored when no session active', () => {
  const store = createStore();
  let discarded = 0;
  const handler = createShortcutHandler({
    store,
    discardSession: () => {
      discarded += 1;
    },
    goHome: () => {},
  });
  handler(createEvent({ key: 'd', ctrlKey: true, shiftKey: true }));
  assert.equal(discarded, 0);
});

test('Ctrl+Shift+H navigates home when not already on home', () => {
  const store = createStore({ step: STEP.COLLECT, selectedTaskModel: { id: 'foo' } });
  let navigations = 0;
  const handler = createShortcutHandler({
    store,
    discardSession: () => {},
    goHome: () => {
      navigations += 1;
    },
  });
  const event = createEvent({ key: 'h', ctrlKey: true, shiftKey: true });
  handler(event);
  assert.equal(navigations, 1);
  assert.equal(event.prevented, true);
});

test('shortcuts ignored when focus inside input elements', () => {
  const store = createStore({ selectedTaskModel: { id: 'foo' } });
  let discarded = 0;
  const handler = createShortcutHandler({
    store,
    discardSession: () => {
      discarded += 1;
    },
    goHome: () => {},
  });
  handler(
    createEvent({
      key: 'd',
      ctrlKey: true,
      shiftKey: true,
      target: { tagName: 'input' },
    })
  );
  assert.equal(discarded, 0);
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
  console.log('Keyboard shortcut tests passed.');
}
