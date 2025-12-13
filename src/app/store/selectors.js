import { DATASET_STATUS, TRAINING_STATUS, INFERENCE_STATUS } from './sessionStore.js';

export function isTrainingReady(state) {
  if (!state) return false;
  const classes = state.classes || [];
  if (classes.length < 2) return false;
  return classes.every((cls) => cls.dataset?.status === DATASET_STATUS.READY);
}

export function getTrainingSummary(state) {
  const classes = state.classes || [];
  const readyClasses = classes.filter((cls) => cls.dataset?.status === DATASET_STATUS.READY).length;
  const totalSamples = classes.reduce((acc, cls) => acc + (cls.dataset?.recordedCount || 0), 0);
  return {
    totalClasses: classes.length,
    readyClasses,
    totalSamples,
  };
}

export function isTrainingInProgress(state) {
  return state?.training?.status === TRAINING_STATUS.RUNNING;
}

export function isInferenceRunning(state) {
  return state?.inference?.status === INFERENCE_STATUS.RUNNING;
}

export function getInferencePredictions(state) {
  const classes = state?.classes || [];
  const prediction = state?.inference?.lastPrediction;
  const values = Array.isArray(prediction?.values)
    ? prediction.values
    : classes.map(() => 0);
  return classes.map((cls, index) => ({
    name: cls.name || `Class ${index + 1}`,
    value: values[index] ?? 0,
    isBest: index === prediction?.bestIndex,
  }));
}

export function getDatasetReadinessIssues(state) {
  const classes = state?.classes || [];
  return classes
    .filter((cls) => cls.dataset?.status !== DATASET_STATUS.READY)
    .map((cls, index) => ({
      id: cls.id,
      name: cls.name || `Class ${index + 1}`,
      reason: cls.dataset?.readinessReason || 'Datensatz unvollständig.',
      status: cls.dataset?.status || DATASET_STATUS.EMPTY,
    }));
}
