import { sessionStore, TRAINING_STATUS, INFERENCE_STATUS } from '../../store/sessionStore.js';
import { isTrainingReady } from '../../store/selectors.js';

let trainingTimer = null;

export function startMockTraining() {
  const state = sessionStore.getState();
  if (!isTrainingReady(state) || state.training.status === TRAINING_STATUS.RUNNING) return;
  sessionStore.setTrainingStatus(TRAINING_STATUS.RUNNING, { progress: 0, error: null });
  let progress = 0;
  trainingTimer = window.setInterval(() => {
    progress = Math.min(progress + 10, 100);
    sessionStore.setTrainingStatus(TRAINING_STATUS.RUNNING, { progress });
    if (progress >= 100) {
      finishTraining(true);
    }
  }, 400);
}

export function abortMockTraining() {
  if (trainingTimer) {
    window.clearInterval(trainingTimer);
    trainingTimer = null;
  }
  sessionStore.setTrainingStatus(TRAINING_STATUS.ABORTED, { progress: 0 });
}

function finishTraining(success) {
  if (trainingTimer) {
    window.clearInterval(trainingTimer);
    trainingTimer = null;
  }
  if (success) {
    sessionStore.setTrainingStatus(TRAINING_STATUS.DONE, { progress: 100 });
    sessionStore.setInferenceStatus(INFERENCE_STATUS.IDLE, { lastPrediction: null });
  } else {
    sessionStore.setTrainingStatus(TRAINING_STATUS.ERROR, { error: 'Training fehlgeschlagen' });
  }
}
