import { sessionStore as realStore, STEP, INFERENCE_STATUS } from '../store/sessionStore.js';

export function createSessionController(store = realStore) {
  return {
    discard(options = {}) {
      const confirmDialog = options.confirm ?? window.confirm;
      const state = store.getState();
      if (!state.selectedTaskModel) return false;

      const prompt =
        state.inference.status === INFERENCE_STATUS.RUNNING
          ? 'Inference läuft – Session wirklich verwerfen?'
          : 'Aktuelle Session verwerfen?';
      const approved = typeof confirmDialog === 'function' ? Boolean(confirmDialog(prompt)) : true;
      if (!approved) return false;

      if (state.inference.status === INFERENCE_STATUS.RUNNING) {
        store.setInferenceStatus(INFERENCE_STATUS.STOPPED, { lastPrediction: null });
      }
      store.discardSession();
      store.setStep(STEP.HOME);
      return true;
    },
  };
}

export const discardSessionWithConfirm = (options) => createSessionController().discard(options);
