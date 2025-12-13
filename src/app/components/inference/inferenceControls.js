import { sessionStore, INFERENCE_STATUS } from '../../store/sessionStore.js';
import { startLiveInference, stopLiveInference } from '../../services/ml/liveInference.js';
import { requestCameraStream } from '../../services/media/cameraService.js';

export function registerInferenceControls(Alpine) {
  Alpine.data('inferenceControls', () => ({
    running: false,
    inference: sessionStore.getState().inference,
    previewReady: false,
    cameraError: null,
    unsubscribe: null,

    init() {
      this.sync(sessionStore.getState());
      this.preparePreview();
      this.unsubscribe = sessionStore.subscribe((state) => this.sync(state));
    },

    destroy() {
      this.unsubscribe?.();
    },

    sync(state) {
      this.inference = state.inference;
      this.running = state.inference?.status === INFERENCE_STATUS.RUNNING;
    },

    async preparePreview() {
      try {
        const stream = await requestCameraStream();
        if (this.$refs.preview) {
          this.$refs.preview.srcObject = stream;
          this.previewReady = true;
        }
      } catch (error) {
        console.error(error);
        this.cameraError = 'Kamera konnte nicht gestartet werden.';
        sessionStore.setInferenceStatus(INFERENCE_STATUS.ERROR, { error: this.cameraError });
      }
    },

    async startInference() {
      if (!this.previewReady || this.running || !this.$refs.preview) return;
      this.cameraError = null;
      try {
        startLiveInference(this.$refs.preview);
      } catch (error) {
        console.error(error);
        this.cameraError = error.message;
        sessionStore.setInferenceStatus(INFERENCE_STATUS.ERROR, { error: error.message });
      }
    },

    stopInference() {
      stopLiveInference();
    },

    statusCopy() {
      if (this.inference?.error) {
        return this.inference.error;
      }
      if (this.running) {
        return 'Inference läuft · stoppe bevor du navigierst.';
      }
      if (!this.previewReady) {
        return 'Kamera wird vorbereitet...';
      }
      return 'Bereit für Inference';
    },
  }));
}
