import { sessionStore, INFERENCE_STATUS } from '../../app/store/sessionStore.js';
import { isInferenceRunning } from '../../app/store/selectors.js';

let inferenceTimer = null;

export function startMockInference() {
  const state = sessionStore.getState();
  if (isInferenceRunning(state)) return;
  if (!state.classes.length) return;
  sessionStore.setInferenceStatus(INFERENCE_STATUS.RUNNING, {
    error: null,
    lastPrediction: { values: buildInitialValues(state), bestIndex: -1 },
  });
  inferenceTimer = window.setInterval(() => {
    const nextValues = buildRandomProbabilities(sessionStore.getState().classes.length);
    const bestIndex = nextValues.reduce(
      (best, value, idx, arr) => (value > arr[best] ? idx : best),
      0
    );
    sessionStore.setInferenceStatus(INFERENCE_STATUS.RUNNING, {
      lastPrediction: { values: nextValues, bestIndex },
    });
  }, 800);
}

export function stopMockInference() {
  if (inferenceTimer) {
    window.clearInterval(inferenceTimer);
    inferenceTimer = null;
  }
  sessionStore.setInferenceStatus(INFERENCE_STATUS.STOPPED, {
    lastPrediction: null,
  });
}

function buildInitialValues(state) {
  return state.classes.map(() => 0);
}

function buildRandomProbabilities(count) {
  if (count === 0) return [];
  const raw = Array.from({ length: count }, () => Math.random());
  const total = raw.reduce((acc, value) => acc + value, 0) || 1;
  return raw.map((value) => Number((value / total).toFixed(2)));
}
