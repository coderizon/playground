import { MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH } from '../../../../constants.js';
import { sessionStore, TRAINING_STATUS, INFERENCE_STATUS } from '../../store/sessionStore.js';
import { isTrainingReady } from '../../store/selectors.js';

const FEATURE_MODEL_URL =
  'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1';

let featureExtractorPromise = null;
let featureExtractor = null;
let classifier = null;
let recordedSamples = [];
let currentSessionId = null;
let lastPrediction = null;

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
  ensureClassifier(classCount, sessionStore.getState().training.params.learningRate);
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
  sessionStore.setTrainingStatus(TRAINING_STATUS.RUNNING, { progress: 0, error: null });
  const labels = recordedSamples.map((sample) => sample.classIndex);
  const xs = tf.stack(recordedSamples.map((sample) => sample.tensor));
  const ys = tf.oneHot(tf.tensor1d(labels, 'int32'), state.classes.length || 1);
  const { epochs, batchSize } = state.training.params;

  try {
    await classifier.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          const percent = Math.round(((epoch + 1) / epochs) * 100);
          sessionStore.setTrainingStatus(TRAINING_STATUS.RUNNING, {
            progress: percent,
            lastAccuracy: logs?.acc ?? logs?.accuracy ?? null,
          });
        },
      },
    });
    sessionStore.setTrainingStatus(TRAINING_STATUS.DONE, { progress: 100 });
    sessionStore.setInferenceStatus(INFERENCE_STATUS.STOPPED, { lastPrediction: null });
  } catch (error) {
    console.error(error);
    sessionStore.setTrainingStatus(TRAINING_STATUS.ERROR, { error: error.message });
  } finally {
    xs.dispose();
    ys.dispose();
    resetSamples();
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
  sessionStore.setInferenceStatus(INFERENCE_STATUS.RUNNING, {
    lastPrediction: { values, bestIndex },
  });
  return { values, bestIndex };
}

async function ensureFeatureExtractor() {
  if (featureExtractor) return featureExtractor;
  if (!featureExtractorPromise) {
    featureExtractorPromise = tf.loadGraphModel(FEATURE_MODEL_URL, { fromTFHub: true });
  }
  featureExtractor = await featureExtractorPromise;
  return featureExtractor;
}

function validateLearningRate(value) {
  const lr = Number(value);
  if (!Number.isFinite(lr) || lr <= 0) return 0.001;
  return lr;
}
