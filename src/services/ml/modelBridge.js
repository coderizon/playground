import { MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH } from './constants.js';
import { sessionStore, TRAINING_STATUS, INFERENCE_STATUS } from '../../app/store/sessionStore.js';
import { isTrainingReady, getLatestDatasetUpdatedAt } from '../../app/store/selectors.js';
import { TF_MOBILENET_FEATURE_VECTOR_URL } from '../../config/externalResources.js';

let featureExtractorPromise = null;
let featureExtractor = null;
let classifier = null;
let recordedSamples = [];
let currentSessionId = null;
let lastPrediction = null;
let trainingAbortRequested = false;
let lastPredictionTimestamp = 0;
const MIN_PREDICTION_INTERVAL_MS = 200;

sessionStore.subscribe((state) => {
  const sessionId = state?.session?.id;
  if (sessionId && sessionId !== currentSessionId) {
    currentSessionId = sessionId;
    resetSamples();
  } else {
    pruneSamples(state);
  }
});

export async function recordSampleFrame(videoEl, classId, classIndex, classCount) {
  if (!videoEl) return;
  const extractor = await ensureFeatureExtractor();
  const featureTensor = tf.tidy(() => {
    const videoFrameAsTensor = tf.browser.fromPixels(videoEl);
    const resized = tf.image.resizeBilinear(
      videoFrameAsTensor,
      [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH],
      true
    );
    const normalized = resized.div(255);
    const embedding = extractor.predict(normalized.expandDims()).squeeze();
    return embedding;
  });
  recordedSamples.push({ classId, classIndex, tensor: featureTensor });
}

export async function trainWithRecordedSamples() {
  const state = sessionStore.getState();
  if (!isTrainingReady(state)) {
    sessionStore.setTrainingStatus(TRAINING_STATUS.ERROR, {
      error: 'Nicht alle Klassen sind bereit.',
    });
    return;
  }
  if (!recordedSamples.length) {
    sessionStore.setTrainingStatus(TRAINING_STATUS.ERROR, {
      error: 'Keine Samples für Training vorhanden.',
    });
    return;
  }

  ensureClassifier(state.classes.length || 1, state.training.params.learningRate);
  trainingAbortRequested = false;
  sessionStore.setTrainingStatus(TRAINING_STATUS.RUNNING, { progress: 0, error: null });

  // Filter valid samples and map to current class indices
  const validSamples = [];
  const currentClassIds = state.classes.map(c => c.id);
  
  recordedSamples.forEach(sample => {
    const currentIndex = currentClassIds.indexOf(sample.classId);
    if (currentIndex !== -1) {
      validSamples.push({ ...sample, classIndex: currentIndex });
    }
  });

  if (!validSamples.length) {
    sessionStore.setTrainingStatus(TRAINING_STATUS.ERROR, {
      error: 'Keine gültigen Samples für aktuelle Klassen vorhanden.',
    });
    return;
  }

  const labels = validSamples.map((sample) => sample.classIndex);
  const xs = tf.stack(validSamples.map((sample) => sample.tensor));
  const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), state.classes.length || 1);
  const { epochs, batchSize } = state.training.params;
  const datasetUpdatedAt = getLatestDatasetUpdatedAt(state) || Date.now();

  try {
    await classifier.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (trainingAbortRequested) {
            classifier.stopTraining = true;
            return;
          }
          const percent = Math.round(((epoch + 1) / epochs) * 100);
          sessionStore.setTrainingStatus(TRAINING_STATUS.RUNNING, {
            progress: percent,
            lastAccuracy: logs?.acc ?? logs?.accuracy ?? null,
          });
        },
      },
    });
    if (trainingAbortRequested || sessionStore.getState().training.status === TRAINING_STATUS.ABORTED) {
      sessionStore.setInferenceStatus(INFERENCE_STATUS.STOPPED, { lastPrediction: null });
    } else {
      sessionStore.setTrainingStatus(TRAINING_STATUS.DONE, {
        progress: 100,
        lastRun: {
          status: TRAINING_STATUS.DONE,
          completedAt: Date.now(),
          error: null,
          datasetUpdatedAt,
        },
      });
      sessionStore.setInferenceStatus(INFERENCE_STATUS.STOPPED, { lastPrediction: null });
    }
  } catch (error) {
    console.error(error);
    sessionStore.setTrainingStatus(TRAINING_STATUS.ERROR, {
      error: error.message,
      lastRun: {
        status: TRAINING_STATUS.ERROR,
        completedAt: Date.now(),
        error: error.message,
        datasetUpdatedAt,
      },
    });
  } finally {
    xs.dispose();
    ys.dispose();
    trainingAbortRequested = false;
  }
}

function resetSamples() {
  recordedSamples.forEach((sample) => sample.tensor.dispose());
  recordedSamples = [];
  lastPrediction?.dispose?.();
  lastPrediction = null;
}

function pruneSamples(state) {
  const allowedIds = new Set((state?.classes || []).map((cls) => cls.id));
  const remaining = [];
  recordedSamples.forEach((sample) => {
    if (allowedIds.has(sample.classId)) {
      remaining.push(sample);
    } else {
      sample.tensor.dispose();
    }
  });
  recordedSamples = remaining;
}

export function clearSamplesForClass(classId) {
  if (!classId) return;
  const remaining = [];
  recordedSamples.forEach((sample) => {
    if (sample.classId === classId) {
      sample.tensor.dispose();
    } else {
      remaining.push(sample);
    }
  });
  recordedSamples = remaining;
}

function ensureClassifier(classCount, learningRate = 0.001) {
  const outputUnits = Math.max(classCount, 1);
  if (classifier && classifier.outputShape?.[1] === outputUnits) {
    classifier.compile({
      optimizer: tf.train.adam(validateLearningRate(learningRate)),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });
    return classifier;
  }
  classifier?.dispose();
  classifier = tf.sequential();
  classifier.add(
    tf.layers.dense({ inputShape: [1024], units: 128, activation: 'relu' })
  );
  classifier.add(tf.layers.dense({ units: outputUnits, activation: 'softmax' }));
  classifier.compile({
    optimizer: tf.train.adam(validateLearningRate(learningRate)),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return classifier;
}

export async function runInference(videoEl) {
  if (!classifier) {
    throw new Error('Kein trainiertes Modell verfügbar.');
  }
  if (!videoEl) {
    throw new Error('Keine Videoquelle für Inferenz vorhanden.');
  }
  if (videoEl.readyState < 2) {
    return null;
  }
  const extractor = await ensureFeatureExtractor();
  const embedding = tf.tidy(() => {
    const frame = tf.browser.fromPixels(videoEl);
    const resized = tf.image.resizeBilinear(
      frame,
      [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH],
      true
    );
    const normalized = resized.div(255);
    return extractor.predict(normalized.expandDims()).squeeze();
  });
  const result = tf.tidy(() => classifier.predict(embedding.expandDims()).squeeze());
  const values = await result.array();
  const bestIndex = values.reduce(
    (best, value, idx, arr) => (value > arr[best] ? idx : best),
    0
  );
  embedding.dispose();
  result.dispose();
  lastPrediction?.dispose?.();
  lastPrediction = null;
  const now = Date.now();
  if (now - lastPredictionTimestamp >= MIN_PREDICTION_INTERVAL_MS) {
    lastPredictionTimestamp = now;
    sessionStore.setInferenceStatus(INFERENCE_STATUS.RUNNING, {
      lastPrediction: { values, bestIndex, updatedAt: now },
    });
  }
  return { values, bestIndex };
}

async function ensureFeatureExtractor() {
  if (featureExtractor) return featureExtractor;
  if (!featureExtractorPromise) {
    featureExtractorPromise = tf.loadGraphModel(TF_MOBILENET_FEATURE_VECTOR_URL, {
      fromTFHub: true,
    });
  }
  featureExtractor = await featureExtractorPromise;
  return featureExtractor;
}

function validateLearningRate(value) {
  const lr = Number(value);
  if (!Number.isFinite(lr) || lr <= 0) return 0.001;
  return lr;
}

export function abortTraining() {
  const state = sessionStore.getState();
  if (state.training.status !== TRAINING_STATUS.RUNNING) return;
  trainingAbortRequested = true;
  const datasetUpdatedAt = getLatestDatasetUpdatedAt(state) || Date.now();
  sessionStore.setTrainingStatus(TRAINING_STATUS.ABORTED, {
    progress: state.training.progress || 0,
    error: null,
    lastRun: {
      status: TRAINING_STATUS.ABORTED,
      completedAt: Date.now(),
      error: null,
      datasetUpdatedAt,
    },
  });
  if (classifier) {
    classifier.stopTraining = true;
  }
}
