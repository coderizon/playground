const STEP = Object.freeze({
  HOME: 'home',
  COLLECT: 'collect',
  TRAIN: 'train',
  INFER: 'infer',
});

const DATASET_STATUS = Object.freeze({
  EMPTY: 'empty',
  RECORDING: 'recording',
  READY: 'ready',
  ERROR: 'error',
});

const TRAINING_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  DONE: 'done',
  ABORTED: 'aborted',
  ERROR: 'error',
});

const INFERENCE_STATUS = Object.freeze({
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPED: 'stopped',
  ERROR: 'error',
});

const EDGE_STATUS = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
});

export {
  STEP,
  DATASET_STATUS,
  TRAINING_STATUS,
  INFERENCE_STATUS,
  EDGE_STATUS,
};

export function createInitialSessionState(overrides = {}) {
  const now = Date.now();
  const baseState = {
    session: {
      id: createId(),
      startedAt: now,
      discardedAt: null,
    },
    selectedTaskModel: null,
    step: STEP.HOME,
    classes: [],
    training: {
      status: TRAINING_STATUS.IDLE,
      progress: 0,
      params: {
        epochs: 10,
        batchSize: 5,
        learningRate: 0.001,
      },
      error: null,
    },
    inference: {
      status: INFERENCE_STATUS.IDLE,
      source: null,
      lastPrediction: null,
      streamToEdge: false,
      error: null,
    },
    edge: {
      status: EDGE_STATUS.DISCONNECTED,
      deviceInfo: null,
      error: null,
      selectedDevice: null,
    },
  };

  return {
    ...baseState,
    ...overrides,
  };
}

export function createSessionStore(initial = createInitialSessionState()) {
  let state = freezeState(initial);
  const listeners = new Set();

  const notify = () => {
    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('[sessionStore] listener error', err);
      }
    });
  };

  const setState = (updater) => {
    const nextState = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
    state = freezeState(nextState);
    notify();
  };

  const subscribe = (listener) => {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const startSession = (taskModel) => {
    if (!taskModel) return;
    setState((current) => ({
      ...current,
      selectedTaskModel: taskModel,
      step: taskModel.requiresTraining ? STEP.COLLECT : STEP.INFER,
      session: {
        id: createId(),
        startedAt: Date.now(),
        discardedAt: null,
      },
      classes: [],
      training: {
        ...current.training,
        status: TRAINING_STATUS.IDLE,
        progress: 0,
        error: null,
      },
      inference: {
        ...current.inference,
        status: INFERENCE_STATUS.IDLE,
        lastPrediction: null,
        source: taskModel.defaultInferenceSource || null,
        error: null,
      },
    }));
  };

  const discardSession = () => {
    setState((current) => {
      const next = createInitialSessionState();
      next.session.discardedAt = Date.now();
      return next;
    });
  };

  const addClass = (options = {}) => {
    if (state.training?.status === TRAINING_STATUS.RUNNING) return;
    setState((current) => {
      const nextClass = createClassState(options);
      return {
        ...current,
        classes: [...current.classes, nextClass],
      };
    });
  };

  const addDatasetSample = (classId, sample = {}) => {
    if (!classId) return;
    if (state.training?.status === TRAINING_STATUS.RUNNING) return;
    setState((current) => ({
      ...current,
      classes: current.classes.map((classState) => {
        if (classState.id !== classId) return classState;
        const samples = [...(classState.dataset.samples || []), enrichSample(sample)];
        const recordedCount = samples.length;
        const status =
          recordedCount >= classState.dataset.expectedCount
            ? DATASET_STATUS.READY
            : DATASET_STATUS.RECORDING;
        const readinessReason = describeReadiness({
          ...classState.dataset,
          recordedCount,
          status,
        });
        return freezeState({
          ...classState,
          dataset: {
            ...classState.dataset,
            samples,
            recordedCount,
            status,
            readinessReason,
          },
        });
      }),
    }));
  };

  const removeDatasetSample = (classId, sampleId) => {
    if (!classId || !sampleId) return;
    if (state.training?.status === TRAINING_STATUS.RUNNING) return;
    setState((current) => ({
      ...current,
      classes: current.classes.map((classState) => {
        if (classState.id !== classId) return classState;
        const samples = (classState.dataset.samples || []).filter((sample) => sample.id !== sampleId);
        const recordedCount = samples.length;
        const status =
          recordedCount >= classState.dataset.expectedCount && recordedCount > 0
            ? DATASET_STATUS.READY
            : recordedCount > 0
            ? DATASET_STATUS.RECORDING
            : DATASET_STATUS.EMPTY;
        const readinessReason = describeReadiness({
          ...classState.dataset,
          recordedCount,
          samples,
          status,
        });
        return freezeState({
          ...classState,
          dataset: {
            ...classState.dataset,
            samples,
            recordedCount,
            status,
            readinessReason,
          },
        });
      }),
    }));
  };

  const updateDatasetSample = (classId, sampleId, patch = {}) => {
    if (!classId || !sampleId) return;
    if (state.training?.status === TRAINING_STATUS.RUNNING) return;
    setState((current) => ({
      ...current,
      classes: current.classes.map((classState) => {
        if (classState.id !== classId) return classState;
        const samples = (classState.dataset.samples || []).map((sample) => {
          if (sample.id !== sampleId) return sample;
          return freezeState({ ...sample, ...patch });
        });
        return freezeState({
          ...classState,
          dataset: {
            ...classState.dataset,
            samples,
          },
        });
      }),
    }));
  };

  const removeClass = (classId) => {
    if (!classId) return;
    if (state.training?.status === TRAINING_STATUS.RUNNING) return;
    setState((current) => ({
      ...current,
      classes: current.classes.filter((classState) => classState.id !== classId),
    }));
  };

  const setClassName = (classId, name) => {
    if (!classId) return;
    if (state.training?.status === TRAINING_STATUS.RUNNING) return;
    setState((current) => ({
      ...current,
      classes: current.classes.map((classState, index) => {
        if (classState.id !== classId) return classState;
        const sanitized = sanitizeClassNameInput(name);
        const fallback = `Klasse ${index + 1}`;
        return freezeState({
          ...classState,
          name: sanitized || fallback,
        });
      }),
    }));
  };

  const updateClass = (classId, updater) => {
    if (!classId) return;
    setState((current) => ({
      ...current,
      classes: current.classes.map((classState) => {
        if (classState.id !== classId) return classState;
        const updates = typeof updater === 'function' ? updater(classState) : updater;
        return freezeState({ ...classState, ...updates });
      }),
    }));
  };

  const updateDatasetStatus = (classId, status, patch = {}) => {
    updateClass(classId, (classState) => ({
      dataset: {
        ...classState.dataset,
        status: validateDatasetStatus(status) || classState.dataset.status,
        ...patch,
        readinessReason:
          patch.readinessReason ||
          describeReadiness({
            ...classState.dataset,
            status: validateDatasetStatus(status) || classState.dataset.status,
            ...patch,
          }),
      },
    }));
  };

  const resetDataset = (classId) => {
    if (!classId) return;
    updateClass(classId, (classState) => ({
      dataset: {
        ...classState.dataset,
        samples: [],
        recordedCount: 0,
        status: DATASET_STATUS.EMPTY,
        error: null,
        readinessReason: describeReadiness({
          ...classState.dataset,
          samples: [],
          recordedCount: 0,
          status: DATASET_STATUS.EMPTY,
          error: null,
        }),
      },
    }));
  };

  const setTrainingStatus = (status, patch = {}) => {
    setState((current) => ({
      ...current,
      training: {
        ...current.training,
        status: validateTrainingStatus(status) || current.training.status,
        ...patch,
      },
    }));
  };

  const setInferenceStatus = (status, patch = {}) => {
    setState((current) => ({
      ...current,
      inference: {
        ...current.inference,
        status: validateInferenceStatus(status) || current.inference.status,
        ...patch,
      },
    }));
  };

  const setInferenceStreaming = (enabled) => {
    setState((current) => ({
      ...current,
      inference: {
        ...current.inference,
        streamToEdge: Boolean(enabled),
      },
    }));
  };

  const setEdgeStatus = (status, patch = {}) => {
    setState((current) => {
      const nextStatus = validateEdgeStatus(status) || current.edge.status;
      const nextEdge = {
        ...current.edge,
        status: nextStatus,
      };

      if (Object.prototype.hasOwnProperty.call(patch, 'deviceInfo')) {
        nextEdge.deviceInfo = patch.deviceInfo;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'selectedDevice')) {
        nextEdge.selectedDevice = patch.selectedDevice;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'error')) {
        nextEdge.error = patch.error;
      } else if (nextStatus !== EDGE_STATUS.ERROR) {
        nextEdge.error = null;
      }

      return {
        ...current,
        edge: nextEdge,
      };
    });
  };

  const setStep = (step) => {
    if (!Object.values(STEP).includes(step)) return;
    setState((current) => ({
      ...current,
      step,
    }));
  };

  return {
    getState: () => state,
    setState,
    subscribe,
    startSession,
    discardSession,
    addClass: (options) => {
      const state = sessionStore.getState();
      if (state.training?.status === TRAINING_STATUS.RUNNING) return;
      addClass(options);
    },
    addDatasetSample,
    removeDatasetSample,
    updateClass,
    updateDatasetStatus,
    updateDatasetSample,
    resetDataset,
    setTrainingStatus,
    setInferenceStatus,
    setEdgeStatus,
    setInferenceStreaming,
    setStep,
    removeClass: (classId) => {
      const state = sessionStore.getState();
      if (state.training?.status === TRAINING_STATUS.RUNNING) return;
      removeClass(classId);
    },
    setClassName: (classId, name) => {
      const state = sessionStore.getState();
      if (state.training?.status === TRAINING_STATUS.RUNNING) return;
      setClassName(classId, name);
    },
  };
}

export const sessionStore = createSessionStore();

function createClassState(options = {}) {
  const id = options.id || createId();
  const defaultName = options.name?.trim() || `Class ${id.slice(-4)}`;
  const samples = options.dataset?.samples ? [...options.dataset.samples] : [];
  const dataset = {
    status: validateDatasetStatus(options.dataset?.status) || DATASET_STATUS.EMPTY,
    samples,
    recordedCount:
      typeof options.dataset?.recordedCount === 'number'
        ? options.dataset.recordedCount
        : samples.length,
    expectedCount: options.dataset?.expectedCount ?? 20,
    error: options.dataset?.error ?? null,
    source: options.dataset?.source ?? null,
  };
  const readinessReason = describeReadiness(dataset);
  return freezeState({
    id,
    name: defaultName,
    dataset: { ...dataset, readinessReason },
    recording: {
      isOpen: options.recording?.isOpen ?? false,
      isRecording: options.recording?.isRecording ?? false,
      source: options.recording?.source ?? null,
    },
  });
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Math.random().toString(36).slice(2, 10)}`;
}

function freezeState(target) {
  return Object.freeze(structuredCloneIfPossible(target));
}

function structuredCloneIfPossible(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function validateDatasetStatus(status) {
  return Object.values(DATASET_STATUS).includes(status) ? status : null;
}

function validateTrainingStatus(status) {
  return Object.values(TRAINING_STATUS).includes(status) ? status : null;
}

function validateInferenceStatus(status) {
  return Object.values(INFERENCE_STATUS).includes(status) ? status : null;
}

function validateEdgeStatus(status) {
  return Object.values(EDGE_STATUS).includes(status) ? status : null;
}

function sanitizeClassNameInput(name) {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, 60);
}

function enrichSample(sample) {
  return {
    id: createId(),
    capturedAt: Date.now(),
    ...sample,
  };
}

function describeReadiness(dataset = {}) {
  if (!dataset) return '';
  if (dataset.status === DATASET_STATUS.ERROR) {
    return dataset.error || 'Aufnahme fehlgeschlagen.';
  }
  if (dataset.status === DATASET_STATUS.READY) {
    return 'Bereit für Training.';
  }
  const missing = Math.max((dataset.expectedCount || 0) - (dataset.recordedCount || 0), 0);
  if (missing > 0) {
    return `Noch ${missing} Beispiel${missing === 1 ? '' : 'e'} erforderlich.`;
  }
  return 'Datensatz unvollständig.';
}
