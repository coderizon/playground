import { sessionStore, INFERENCE_STATUS } from '../../store/sessionStore.js';
import { startLiveInference, stopLiveInference } from '../../services/ml/liveInference.js';
import { requestCameraStream } from '../../services/media/cameraService.js';

export function registerInferenceControls(Alpine) {
  Alpine.data('inferenceControls', () => ({
    running: false,
    inference: sessionStore.getState().inference,
    previewReady: false,
    cameraError: null,
    fps: null,
    lastFrameTime: null,
    unsubscribe: null,
    telemetryActive: false,

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
      if (!this.running) {
        this.telemetryActive = false;
      }
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
      this.fps = null;
      this.lastFrameTime = null;
      try {
        startLiveInference(this.$refs.preview);
        this.startTelemetryLoop();
      } catch (error) {
        console.error(error);
        this.cameraError = error.message;
        sessionStore.setInferenceStatus(INFERENCE_STATUS.ERROR, { error: error.message });
      }
    },

    stopInference() {
      stopLiveInference();
      this.fps = null;
      this.lastFrameTime = null;
      this.telemetryActive = false;
    },

    statusCopy() {
      if (this.inference?.error) {
        return this.inference.error;
      }
      if (this.running) {
        const fpsInfo = this.fps ? ` · ${this.fps} FPS` : '';
        return `Inference läuft${fpsInfo} – stoppe bevor du navigierst.`;
      }
      if (!this.previewReady) {
        return 'Kamera wird vorbereitet...';
      }
      return 'Bereit für Inference';
    },

    handleFrameTick(timestamp = performance.now()) {
      if (!this.telemetryActive) return;
      if (this.lastFrameTime) {
        const delta = timestamp - this.lastFrameTime;
        if (delta > 0) {
          this.fps = Math.round(1000 / delta);
        }
      }
      this.lastFrameTime = timestamp;
      window.requestAnimationFrame((ts) => this.handleFrameTick(ts));
    },

    startTelemetryLoop() {
      this.lastFrameTime = null;
      this.telemetryActive = true;
      window.requestAnimationFrame((ts) => this.handleFrameTick(ts));
    },
  }));
}
