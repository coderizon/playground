import { sessionStore, INFERENCE_STATUS } from '../../store/sessionStore.js';
import { getInferencePredictions } from '../../store/selectors.js';

export function registerInferenceComponents(Alpine) {
  Alpine.data('predictionPanel', () => ({
    predictions: [],
    isRunning: false,
    lastUpdatedAt: null,
    unsubscribe: null,
    inferenceStatus: sessionStore.getState().inference,

    init() {
      this.sync(sessionStore.getState());
      this.unsubscribe = sessionStore.subscribe((state) => this.sync(state));
    },

    destroy() {
      this.unsubscribe?.();
    },

    sync(state) {
      this.predictions = getInferencePredictions(state);
      this.isRunning = state.inference?.status === INFERENCE_STATUS.RUNNING;
      this.inferenceStatus = state.inference;
      this.lastUpdatedAt = state.inference?.lastPrediction?.updatedAt || null;
    },

    formatPercent(value) {
      return `${Math.round((value || 0) * 100)}%`;
    },

    statusCopy() {
      if (this.inferenceStatus?.error) {
        return this.inferenceStatus.error;
      }
      if (this.isRunning) {
        return 'Inference läuft';
      }
      return 'Inference gestoppt';
    },

    readableTimestamp() {
      if (!this.lastUpdatedAt) return null;
      return new Date(this.lastUpdatedAt).toLocaleTimeString();
    },
  }));
}
