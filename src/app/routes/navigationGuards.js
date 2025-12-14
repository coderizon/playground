import { sessionStore, INFERENCE_STATUS } from '../store/sessionStore.js';

let registered = false;
let confirmFn = null;

export function registerNavigationGuards(options = {}) {
  if (typeof window === 'undefined') return () => {};
  if (registered) return () => {};
  confirmFn = options.confirm || window.confirm;
  const beforeUnload = (event) => {
    if (sessionStore.getState().inference.status === INFERENCE_STATUS.RUNNING) {
      event.preventDefault();
      event.returnValue = '';
      return '';
    }
    return undefined;
  };
  window.addEventListener('beforeunload', beforeUnload);
  registered = true;
  return () => {
    window.removeEventListener('beforeunload', beforeUnload);
    registered = false;
    confirmFn = null;
  };
}

export function confirmNavigationIfInferenceRunning() {
  const running = sessionStore.getState().inference.status === INFERENCE_STATUS.RUNNING;
  if (!running) return true;
  const allow = typeof confirmFn === 'function' ? confirmFn('Inference läuft – wirklich verlassen?') : true;
  if (allow) {
    sessionStore.setInferenceStatus(INFERENCE_STATUS.STOPPED, { lastPrediction: null });
  }
  return allow;
}
