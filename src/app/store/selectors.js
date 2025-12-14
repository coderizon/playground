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

export function getLatestDatasetUpdatedAt(state) {
  const classes = state?.classes || [];
  const latest = classes.reduce((max, cls) => {
    const timestamp = Number(cls.dataset?.lastUpdatedAt) || 0;
    return timestamp > max ? timestamp : max;
  }, 0);
  return latest > 0 ? latest : null;
}

export function getClassesUpdatedSince(state, sinceTimestamp) {
  const classes = state?.classes || [];
  const baseline = Number(sinceTimestamp) || 0;
  return classes
    .map((cls, index) => ({
      id: cls.id,
      name: cls.name || `Class ${index + 1}`,
      updatedAt: Number(cls.dataset?.lastUpdatedAt) || null,
    }))
    .filter((cls) => cls.updatedAt && cls.updatedAt > baseline);
}

export function getTrainingRetryContext(state) {
  if (!state) {
    return {
      lastRun: null,
      latestDatasetUpdate: null,
      datasetChangedSinceLastRun: false,
      staleClasses: [],
    };
  }
  const lastRun = state.training?.lastRun || null;
  const latestDatasetUpdate = getLatestDatasetUpdatedAt(state);
  const staleClasses = lastRun
    ? getClassesUpdatedSince(state, lastRun.datasetUpdatedAt || 0)
    : [];
  return {
    lastRun,
    latestDatasetUpdate,
    datasetChangedSinceLastRun:
      Boolean(lastRun?.datasetUpdatedAt) &&
      Boolean(latestDatasetUpdate) &&
      latestDatasetUpdate > (lastRun.datasetUpdatedAt || 0),
    staleClasses,
  };
}
