import { sessionStore as realStore, STEP } from '../store/sessionStore.js';
import { discardSessionWithConfirm as realDiscard } from './sessionController.js';
import { goHome as realGoHome } from './navigationController.js';

export function createShortcutHandler({
  store = realStore,
  discardSession = realDiscard,
  goHome = realGoHome,
} = {}) {
  return function handleShortcut(event = {}) {
    if (!event || typeof event.key !== 'string') return;
    if (event.defaultPrevented) return;
    const target = event.target || event.srcElement;
    const tag = target?.tagName?.toLowerCase();
    const isEditable =
      target?.isContentEditable ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select';
    if (isEditable) return;
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!hasModifier || !event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'd') {
      if (!store.getState().selectedTaskModel) return;
      event.preventDefault?.();
      discardSession();
      return;
    }
    if (key === 'h') {
      const step = store.getState().step;
      if (step === STEP.HOME) return;
      event.preventDefault?.();
      goHome();
    }
  };
}

let registered = false;

export function registerKeyboardShortcuts(options = {}) {
  if (registered) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return;
  }
  const handler = createShortcutHandler(options);
  window.addEventListener('keydown', handler);
  registered = true;
}
