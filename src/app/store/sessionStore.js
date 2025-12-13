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
    setState((current) => {
      const nextClass = createClassState(options);
      return {
        ...current,
        classes: [...current.classes, nextClass],
      };
    });
  };

  const removeClass = (classId) => {
    if (!classId) return;
    setState((current) => ({
      ...current,
      classes: current.classes.filter((classState) => classState.id !== classId),
    }));
  };

  const setClassName = (classId, name) => {
    if (!classId) return;
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

  const setEdgeStatus = (status, patch = {}) => {
    setState((current) => ({
      ...current,
      edge: {
        ...current.edge,
        status: validateEdgeStatus(status) || current.edge.status,
        ...patch,
      },
    }));
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
    addClass,
    updateClass,
    updateDatasetStatus,
    setTrainingStatus,
    setInferenceStatus,
    setEdgeStatus,
    setStep,
    removeClass,
    setClassName,
  };
}

export const sessionStore = createSessionStore();

function createClassState(options = {}) {
  const id = options.id || createId();
  const defaultName = options.name?.trim() || `Class ${id.slice(-4)}`;
  return freezeState({
    id,
    name: defaultName,
    dataset: {
      status: validateDatasetStatus(options.dataset?.status) || DATASET_STATUS.EMPTY,
      samples: options.dataset?.samples ?? [],
      recordedCount: options.dataset?.recordedCount ?? 0,
      expectedCount: options.dataset?.expectedCount ?? 20,
      error: options.dataset?.error ?? null,
      source: options.dataset?.source ?? null,
    },
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
