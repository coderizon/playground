import { sessionStore as realStore, INFERENCE_STATUS } from '../store/sessionStore.js';

export function createInferenceController({ store = realStore, confirm, stopLiveInference } = {}) {
  if (typeof confirm !== 'function') {
    throw new Error('[inferenceController] confirm function required');
  }
  if (typeof stopLiveInference !== 'function') {
    throw new Error('[inferenceController] stopLiveInference function required');
  }

  const ensureInferenceStopped = (next) => {
    const running = store.getState().inference.status === INFERENCE_STATUS.RUNNING;
    if (!running) {
      next?.();
      return true;
    }
    confirm({
      title: 'Inference stoppen?',
      message: 'Bitte stoppe die laufende Inference, bevor du die Seite verlässt.',
      confirmLabel: 'Inference stoppen',
      destructive: true,
      onConfirm: () => {
        stopLiveInference();
        next?.();
      },
    });
    return false;
  };

  return {
    ensureInferenceStopped,
  };
}
