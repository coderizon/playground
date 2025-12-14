import {
  DATASET_STATUS,
  TRAINING_STATUS,
  INFERENCE_STATUS,
  PERMISSION_STATUS,
} from './sessionStore.js';

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

export function getPermissionIssues(state) {
  const permissions = state?.permissions || {};
  return Object.entries(permissions)
    .map(([type, meta]) => {
      const status = meta?.status || PERMISSION_STATUS.UNKNOWN;
      const copy = permissionCopy(type);
      return {
        id: type,
        type,
        status,
        title: copy.title,
        hint: copy.hint,
        message: meta?.message || copy.message,
        updatedAt: meta?.updatedAt || null,
      };
    })
    .filter((issue) => issue.status === PERMISSION_STATUS.BLOCKED);
}

export function getEdgeStreamingContext(state) {
  const permissionIssues = getPermissionIssues(state);
  if (permissionIssues.some((issue) => issue.type === 'camera')) {
    const cameraIssue = permissionIssues.find((issue) => issue.type === 'camera');
    return {
      canStream: false,
      reasonType: 'permission',
      reason:
        cameraIssue?.message ||
        cameraIssue?.hint ||
        'Kamerazugriff blockiert – erlauben, um Streaming zu aktivieren.',
      staleClasses: [],
    };
  }
  const retry = getTrainingRetryContext(state);
  if (retry?.datasetChangedSinceLastRun) {
    return {
      canStream: false,
      reasonType: 'training',
      reason:
        retry.staleClasses?.length === 1
          ? `${retry.staleClasses[0].name} enthält neue Samples. Trainiere erneut, bevor du streamst.`
          : 'Datensätze wurden seit dem letzten Training geändert. Trainiere erneut, bevor du streamst.',
      staleClasses: retry.staleClasses || [],
    };
  }
  return {
    canStream: true,
    reasonType: null,
    reason: '',
    staleClasses: [],
  };
}

function permissionCopy(type) {
  switch (type) {
    case 'camera':
      return {
        title: 'Kamerazugriff blockiert',
        hint: 'Erlaube die Kamera in der Browser-Leiste und lade die Seite neu, falls nötig.',
        message: 'Die Kamera wurde blockiert. Bitte überprüfe deine Browser-Berechtigungen.',
      };
    case 'microphone':
      return {
        title: 'Mikrofon blockiert',
        hint: 'Erteile dem Browser Zugriff auf das Mikrofon oder wähle ein funktionierendes Gerät.',
        message: 'Das Mikrofon wurde blockiert. Bitte überprüfe deine Browser-Berechtigungen.',
      };
    default:
      return {
        title: 'Zugriff blockiert',
        hint: 'Prüfe deine Geräteberechtigungen.',
        message: 'Ein Gerät wurde blockiert.',
      };
  }
}
