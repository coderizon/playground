import { runInference } from './modelBridge.js';
import { sessionStore, INFERENCE_STATUS } from '../../app/store/sessionStore.js';

let inferenceLoopHandle = null;

export function startLiveInference(videoEl) {
  if (!videoEl) {
    throw new Error('Kein Videoelement für Inferenz vorhanden.');
  }
  stopLiveInference();
  sessionStore.setInferenceStatus(INFERENCE_STATUS.RUNNING, {
    lastPrediction: null,
    error: null,
  });

  const startLoop = () => {
    const loop = async () => {
      if (sessionStore.getState().inference.status !== INFERENCE_STATUS.RUNNING) {
        stopLiveInference();
        return;
      }
      try {
        await runInference(videoEl);
      } catch (error) {
        console.error(error);
        sessionStore.setInferenceStatus(INFERENCE_STATUS.ERROR, { error: error.message });
        stopLiveInference();
        return;
      }
      inferenceLoopHandle = window.requestAnimationFrame(loop);
    };
    inferenceLoopHandle = window.requestAnimationFrame(loop);
  };

  if (videoEl.readyState >= 2) {
    startLoop();
  } else {
    videoEl.onloadeddata = () => {
      startLoop();
      videoEl.onloadeddata = null;
    };
  }
}

export function stopLiveInference() {
  if (inferenceLoopHandle) {
    window.cancelAnimationFrame(inferenceLoopHandle);
    inferenceLoopHandle = null;
  }
  const current = sessionStore.getState();
  if (current.inference.status === INFERENCE_STATUS.RUNNING) {
    sessionStore.setInferenceStatus(INFERENCE_STATUS.STOPPED, { lastPrediction: null });
  }
}
