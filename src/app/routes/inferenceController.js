import { sessionStore as realStore, INFERENCE_STATUS } from '../store/sessionStore.js';

export function createInferenceController({
  store = realStore,
  confirm,
  stopLiveInference,
  notify,
} = {}) {
  if (typeof confirm !== 'function') {
    throw new Error('[inferenceController] confirm function required');
  }
  if (typeof stopLiveInference !== 'function') {
    throw new Error('[inferenceController] stopLiveInference function required');
  }

  const sendToast = (options = {}) => {
    if (typeof notify !== 'function') return;
    if (!options.message) return;
    notify({
      title: options.title || 'Inference gestoppt',
      message: options.message,
      tone: options.tone || 'info',
    });
  };

  const ensureInferenceStopped = (next, options = {}) => {
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
        sendToast({
          title: options.toastTitle,
          message: options.toastMessage,
          tone: options.toastTone,
        });
        next?.();
      },
    });
    return false;
  };

  return {
    ensureInferenceStopped,
  };
}
