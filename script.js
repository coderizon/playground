const STATUS = document.getElementById('status');
const CAPTURE_VIDEO = document.getElementById('captureCam');
const PREVIEW_VIDEO = document.getElementById('previewCam');
const RESET_BUTTON = document.getElementById('reset');
const TRAIN_BUTTON = document.getElementById('train');
const MOBILE_NET_INPUT_WIDTH = 224;
const MOBILE_NET_INPUT_HEIGHT = 224;
const STOP_DATA_GATHER = -1;
const GESTURE_OVERLAY = document.getElementById('gestureOverlay');

const mobileStepButtons = document.querySelectorAll('[data-step-target]');
const bodyEl = document.body;
const supportsPointer = 'onpointerdown' in window;
const addClassButton = document.getElementById('add-class');
const classesColumn = document.querySelector('.classes-column');
const probabilityList = document.getElementById('probabilityList');
const menuButton = document.querySelector('.icon-button');
const modeMenu = document.getElementById('modeMenu');
const modeLabel = document.getElementById('modeLabel');

const CLASS_NAMES = [];
const openWebcamButtons = [];
const webcamPanels = [];
const classNameInputs = [];
const captureSlots = [];
const dataCollectorButtons = [];
const countChips = [];
const switchCameraButtons = [];

let currentStream;
let activeClassIndex = 0;
let previewReady = false;
let trainingCompleted = false;
let mobilenet = undefined;
let gatherDataState = STOP_DATA_GATHER;
let videoPlaying = false;
let trainingDataInputs = [];
let trainingDataOutputs = [];
let examplesCount = [];
let predict = false;
let model;
let preferredFacingMode = 'user';
let lastPrediction = [];
let currentMode = 'image';
let gestureRecognizer;
let gestureInitPromise;
let gestureBusy = false;
let drawingUtils;
let gestureConnections;

const BAR_COLORS = [
  ['#f07818', '#ffd8ba'],
  ['#d14ebd', '#ffd6f4'],
  ['#5067ff', '#d4ddff'],
  ['#28b88a', '#c8f1e3'],
  ['#f2b134', '#ffe7bd'],
  ['#8e54e9', '#e3d6ff'],
];
const GESTURE_LABELS = [
  'None',
  'Closed_Fist',
  'Open_Palm',
  'Pointing_Up',
  'Thumb_Down',
  'Thumb_Up',
  'Victory',
  'ILoveYou',
];
const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 17],
];
const MODE_NAMES = {
  image: 'Bildklassifikation',
  gesture: 'Gesture Recognition',
};

TRAIN_BUTTON.addEventListener('click', trainAndPredict);
RESET_BUTTON.addEventListener('click', reset);

mobileStepButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setMobileStep(btn.getAttribute('data-step-target'));
  });
});

initializeExistingClasses();
if (addClassButton) {
  addClassButton.addEventListener('click', addNewClassCard);
  addClassButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      addNewClassCard();
    }
  });
}

if (menuButton) {
  menuButton.addEventListener('click', toggleModeMenu);
}

if (modeMenu) {
  modeMenu.addEventListener('click', (event) => {
    const mode = event.target.getAttribute('data-mode');
    if (mode) {
      setMode(mode);
      closeModeMenu();
    }
  });
}

document.addEventListener('click', (event) => {
  if (!modeMenu || !menuButton) return;
  if (!modeMenu.contains(event.target) && !menuButton.contains(event.target)) {
    closeModeMenu();
  }
});

function initializeExistingClasses() {
  const existingCards = document.querySelectorAll('.class-card');
  existingCards.forEach((card, idx) => {
    setupClassCard(card, idx);
  });
  rebuildModel();
  updateExampleCounts(true);
  renderProbabilities();
  setMode('image');
}

function setupClassCard(card, idx) {
  const nameInput = card.querySelector('.class-name-input');
  const openBtn = card.querySelector('.open-webcam');
  const panel = card.querySelector('.webcam-panel');
  const closeBtn = panel.querySelector('.icon-close');
  const switchBtn = panel.querySelector('.switch-camera');
  const slot = card.querySelector('.capture-slot');
  const collectorBtn = card.querySelector('.dataCollector');
  const countChip = card.querySelector('.count-chip');

  if (!nameInput || !openBtn || !panel || !slot || !collectorBtn || !countChip) return;

  nameInput.setAttribute('data-class-index', idx);
  openBtn.setAttribute('data-class-index', idx);
  panel.setAttribute('data-class-panel', idx);
  slot.setAttribute('data-class-slot', idx);
  collectorBtn.setAttribute('data-1hot', idx);
  countChip.setAttribute('data-count-for', idx);

  const classLabel = nameInput.value || `Class ${idx + 1}`;
  CLASS_NAMES[idx] = classLabel;
  collectorBtn.setAttribute('data-name', classLabel);

  classNameInputs[idx] = nameInput;
  openWebcamButtons[idx] = openBtn;
  webcamPanels[idx] = panel;
  captureSlots[idx] = slot;
  dataCollectorButtons[idx] = collectorBtn;
  countChips[idx] = countChip;
  if (switchBtn) {
    switchCameraButtons[idx] = switchBtn;
  }

  attachNameInputListener(nameInput, idx, collectorBtn);
  attachOpenButtonListener(openBtn, idx);
  attachCollectorButtonListeners(collectorBtn);
  attachSwitchCameraListener(switchBtn);

  if (closeBtn) {
    closeBtn.setAttribute('data-close-panel', idx);
    closeBtn.addEventListener('click', () => hideWebcamPanel(idx));
  }
}

function buildClassCardElement(idx) {
  const card = document.createElement('div');
  card.className = 'card class-card';
  card.innerHTML = `
    <div class="card-header">
      <div class="title-group editable">
        <input class="class-name-input" data-class-index="${idx}" value="Class ${idx + 1}" aria-label="Klassenname eingeben">
      </div>
      <span class="dots">⋮</span>
    </div>
    <p class="section-label">Bildbeispiele hinzufügen:</p>
    <div class="action-row">
      <button class="open-webcam ghost" data-class-index="${idx}">Webcam</button>
    </div>
    <div class="webcam-panel" data-class-panel="${idx}">
      <div class="panel-top">
        <span>Webcam</span>
        <div class="panel-actions">
          <button class="ghost switch-camera" data-switch-camera aria-label="Kamera wechseln">Außenkamera</button>
          <button class="icon-close" data-close-panel="${idx}" aria-label="Panel schließen">×</button>
        </div>
      </div>
      <div class="count-row">
        <span class="count-chip" data-count-for="${idx}">0 Bildbeispiele</span>
      </div>
      <div class="capture-slot" data-class-slot="${idx}"></div>
      <button class="dataCollector primary block" data-1hot="${idx}" data-name="Class ${idx + 1}">Zum Aufnehmen halten</button>
    </div>
  `;
  return card;
}

function attachCollectorButtonListeners(btn) {
  if (supportsPointer) {
    btn.addEventListener('pointerdown', handleCollectStart, { passive: false });
    btn.addEventListener('pointerup', handleCollectEnd);
    btn.addEventListener('pointerleave', handleCollectEnd);
  } else {
    btn.addEventListener('mousedown', handleCollectStart);
    btn.addEventListener('mouseup', handleCollectEnd);
    btn.addEventListener('touchstart', handleCollectStart, { passive: false });
    btn.addEventListener('touchend', handleCollectEnd);
  }
}

function attachOpenButtonListener(btn, idx) {
  btn.addEventListener('click', () => openWebcamForClass(idx));
}

function attachNameInputListener(input, idx, collectorBtn) {
  input.addEventListener('input', () => {
    CLASS_NAMES[idx] = input.value || `Class ${idx + 1}`;
    collectorBtn.setAttribute('data-name', CLASS_NAMES[idx]);
    STATUS.innerText = `Klasse ${idx + 1} benannt als ${CLASS_NAMES[idx]}.`;
    renderProbabilities(lastPrediction);
  });
}

function attachSwitchCameraListener(btn) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    preferredFacingMode = preferredFacingMode === 'user' ? 'environment' : 'user';
    stopCurrentStream();
    moveCaptureToSlot(activeClassIndex);
    enableCam();
    updateSwitchButtonsLabel();
    STATUS.innerText =
      preferredFacingMode === 'environment'
        ? 'Außenkamera aktiviert.'
        : 'Selfie-Kamera aktiviert.';
  });
  updateSwitchButtonsLabel();
}

function addNewClassCard() {
  const newIndex = CLASS_NAMES.length;
  const newCard = buildClassCardElement(newIndex);
  if (classesColumn && addClassButton) {
    classesColumn.insertBefore(newCard, addClassButton);
  } else if (classesColumn) {
    classesColumn.appendChild(newCard);
  }
  setupClassCard(newCard, newIndex);
  examplesCount[newIndex] = 0;
  updateExampleCounts();
  trainingCompleted = false;
  predict = false;
  previewReady = false;
  PREVIEW_VIDEO.classList.add('hidden');
  rebuildModel();
  renderProbabilities();
  STATUS.innerText = `Neue Klasse ${CLASS_NAMES[newIndex]} hinzugefügt.`;
}

function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function stopCurrentStream() {
  if (!currentStream) return;
  currentStream.getTracks().forEach((track) => track.stop());
  currentStream = undefined;
  videoPlaying = false;
  renderProbabilities([]);
}

function updateSwitchButtonsLabel() {
  const targetLabel = preferredFacingMode === 'user' ? 'Außenkamera' : 'Selfie-Kamera';
  switchCameraButtons.forEach((btn) => {
    if (btn) btn.textContent = targetLabel;
  });
}

async function enableCam(allowFallback = true) {
  if (!hasGetUserMedia()) {
    console.warn('getUserMedia() is not supported by your browser');
    return;
  }

  const facingConstraint = preferredFacingMode === 'environment' ? { exact: 'environment' } : 'user';
  const constraints = { video: { width: 640, height: 480, facingMode: facingConstraint } };

  if (currentStream) {
    attachStreamToVideos(currentStream);
    return;
  }

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    attachStreamToVideos(currentStream);
  } catch (err) {
    console.error(err);
    if (allowFallback && preferredFacingMode === 'environment') {
      preferredFacingMode = 'user';
      updateSwitchButtonsLabel();
      STATUS.innerText = 'Außenkamera nicht verfügbar, Selfie-Kamera aktiviert.';
      return enableCam(false);
    }
    STATUS.innerText = 'Webcam konnte nicht gestartet werden.';
  }
}

function attachStreamToVideos(stream) {
  CAPTURE_VIDEO.srcObject = stream;
  PREVIEW_VIDEO.srcObject = stream;
  CAPTURE_VIDEO.addEventListener('loadeddata', function onLoad() {
    videoPlaying = true;
    CAPTURE_VIDEO.classList.remove('hidden');
    CAPTURE_VIDEO.removeEventListener('loadeddata', onLoad);
  });
}

function openWebcamForClass(idx) {
  activeClassIndex = idx;
  webcamPanels.forEach((panel) => {
    panel.classList.toggle('visible', parseInt(panel.getAttribute('data-class-panel')) === idx);
  });
  moveCaptureToSlot(idx);
  enableCam();
  STATUS.innerText = `Webcam geöffnet für ${CLASS_NAMES[idx]}. Halte zum Aufnehmen.`;
}

function moveCaptureToSlot(idx) {
  const slot = captureSlots.find((s) => parseInt(s.getAttribute('data-class-slot')) === idx);
  if (slot && CAPTURE_VIDEO.parentElement !== slot) {
    slot.innerHTML = '';
    slot.appendChild(CAPTURE_VIDEO);
  }
}

function hideWebcamPanel(idx) {
  if (gatherDataState !== STOP_DATA_GATHER) {
    gatherDataState = STOP_DATA_GATHER;
  }
  const panel = webcamPanels.find((p) => parseInt(p.getAttribute('data-class-panel')) === idx);
  if (panel) {
    panel.classList.remove('visible');
  }
}

async function trainAndPredict() {
  if (trainingCompleted) return;
  predict = false;
  tf.util.shuffleCombo(trainingDataInputs, trainingDataOutputs);
  const outputsAsTensor = tf.tensor1d(trainingDataOutputs, 'int32');
  const oneHotOutputs = tf.oneHot(outputsAsTensor, CLASS_NAMES.length);
  const inputsAsTensor = tf.stack(trainingDataInputs);

  await model.fit(inputsAsTensor, oneHotOutputs, {
    shuffle: true,
    batchSize: 5,
    epochs: 10,
    callbacks: { onEpochEnd: logProgress },
  });

  outputsAsTensor.dispose();
  oneHotOutputs.dispose();
  inputsAsTensor.dispose();
  predict = true;
  trainingCompleted = true;
  lockCapturePanels();
  showPreview();
  setMobileStep('preview');
  predictLoop();
}

function logProgress(epoch, logs) {
  console.log('Data for epoch ' + epoch, logs);
}

function showPreview() {
  STATUS.innerText = '';
  PREVIEW_VIDEO.classList.remove('hidden');
  if (PREVIEW_VIDEO.readyState >= 2) {
    previewReady = true;
    renderProbabilities(lastPrediction);
    return;
  }
  PREVIEW_VIDEO.addEventListener(
    'loadeddata',
    function onPreviewReady() {
      previewReady = true;
      renderProbabilities(lastPrediction);
      PREVIEW_VIDEO.removeEventListener('loadeddata', onPreviewReady);
    },
    { once: true }
  );
}

function predictLoop() {
  if (!predict) return;

  if (currentMode === 'gesture') {
    runGestureStep();
    window.requestAnimationFrame(predictLoop);
    return;
  }

  if (previewReady && trainingCompleted) {
    tf.tidy(function () {
      const videoFrameAsTensor = tf.browser.fromPixels(PREVIEW_VIDEO).div(255);
      const resizedTensorFrame = tf.image.resizeBilinear(
        videoFrameAsTensor,
        [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH],
        true
      );

      const imageFeatures = mobilenet.predict(resizedTensorFrame.expandDims());
      const prediction = model.predict(imageFeatures).squeeze();
      const predictionArray = Array.from(prediction.arraySync());
      const highestIndex =
        predictionArray.length > 0
          ? predictionArray.reduce(
              (bestIdx, value, idx, arr) => (value > arr[bestIdx] ? idx : bestIdx),
              0
            )
          : 0;
      renderProbabilities(predictionArray, highestIndex, CLASS_NAMES);
    });
  }

  window.requestAnimationFrame(predictLoop);
}

function renderProbabilities(probArray = lastPrediction, bestIndex = -1, names = CLASS_NAMES) {
  if (!probabilityList) return;

  const safeValues = names.map((_, idx) => {
    if (probArray && probArray[idx] !== undefined) return probArray[idx];
    return 0;
  });
  lastPrediction = safeValues;

  probabilityList.innerHTML = '';

  names.forEach((name, idx) => {
    const value = safeValues[idx] || 0;
    const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
    const row = document.createElement('div');
    row.className = 'probability-row';
    if (idx === bestIndex && predict) {
      row.classList.add('is-top');
    }

    const label = document.createElement('div');
    label.className = 'probability-label';
    label.textContent = name || `Class ${idx + 1}`;

    const bar = document.createElement('div');
    bar.className = 'probability-bar';

    const fill = document.createElement('div');
    fill.className = 'probability-bar-fill';
    const { start, end } = getBarColors(idx);
    fill.style.setProperty('--bar-start', start);
    fill.style.setProperty('--bar-end', end);
    fill.style.width = `${percent}%`;

    const valueEl = document.createElement('span');
    valueEl.className = 'probability-value';
    valueEl.textContent = `${percent}%`;

    bar.appendChild(fill);
    bar.appendChild(valueEl);

    row.appendChild(label);
    row.appendChild(bar);

    probabilityList.appendChild(row);
  });
}

function getBarColors(idx) {
  const palette = BAR_COLORS[idx % BAR_COLORS.length];
  return { start: palette[0], end: palette[1] };
}

function toggleModeMenu() {
  if (!modeMenu) return;
  modeMenu.classList.toggle('hidden');
  updateModeMenuActive();
}

function closeModeMenu() {
  if (!modeMenu) return;
  modeMenu.classList.add('hidden');
}

function updateModeMenuActive() {
  if (!modeMenu) return;
  Array.from(modeMenu.querySelectorAll('[data-mode]')).forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === currentMode);
  });
}

function setMode(newMode) {
  if (newMode !== 'image' && newMode !== 'gesture') return;
  if (newMode === currentMode) {
    updateModeMenuActive();
    return;
  }
  currentMode = newMode;
  if (modeLabel) {
    modeLabel.textContent = MODE_NAMES[newMode] || newMode;
  }
  bodyEl.setAttribute('data-mode', newMode);

  if (newMode === 'gesture') {
    predict = true;
    previewReady = false;
    trainingCompleted = false;
    STATUS.innerText = 'Gesture Recognition wird geladen...';
    setMobileStep('preview');
    showPreview();
    enableCam();
    renderProbabilities([], -1, GESTURE_LABELS);
    if (GESTURE_OVERLAY) {
      GESTURE_OVERLAY.classList.remove('hidden');
      clearOverlay();
    }
    window.requestAnimationFrame(predictLoop);
  } else {
    predict = false;
    previewReady = false;
    trainingCompleted = false;
    STATUS.innerText = 'Bildklassifikation aktiv. Sammle Daten und trainiere.';
    PREVIEW_VIDEO.classList.add('hidden');
    lastPrediction = [];
    renderProbabilities([], -1, CLASS_NAMES);
    clearOverlay();
    if (GESTURE_OVERLAY) {
      GESTURE_OVERLAY.classList.add('hidden');
    }
    setMobileStep('collect');
  }

  updateModeMenuActive();
}

async function ensureGestureRecognizer() {
  if (gestureRecognizer) return gestureRecognizer;
  if (gestureInitPromise) return gestureInitPromise;

  gestureInitPromise = (async () => {
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0');
      const fileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );
      gestureRecognizer = await vision.GestureRecognizer.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
      if (GESTURE_OVERLAY) {
        const ctx = GESTURE_OVERLAY.getContext('2d');
        drawingUtils = new vision.DrawingUtils(ctx);
      }
      gestureConnections = vision.GestureRecognizer.HAND_CONNECTIONS || HAND_CONNECTIONS;
      STATUS.innerText = 'Gesture Recognition bereit.';
      return gestureRecognizer;
    } catch (err) {
      console.error(err);
      STATUS.innerText = 'Gesture Recognition konnte nicht geladen werden.';
      gestureRecognizer = null;
      return null;
    }
  })();

  return gestureInitPromise;
}

async function runGestureStep() {
  if (gestureBusy) return;
  if (!previewReady) return;
  if (!GESTURE_OVERLAY) return;
  gestureBusy = true;
  try {
    const recognizer = await ensureGestureRecognizer();
    if (!recognizer) return;
    const nowInMs = performance.now();
    const result = recognizer.recognizeForVideo(PREVIEW_VIDEO, nowInMs);
    if (!result || !result.gestures || !result.gestures.length) {
      renderProbabilities([], -1, GESTURE_LABELS);
      clearOverlay();
      return;
    }
    const categories = result.gestures[0] || [];
    const probs = GESTURE_LABELS.map((name) => {
      const match = categories.find((c) => c.categoryName === name);
      return match ? match.score : 0;
    });
    const topIndex =
      probs.length > 0
        ? probs.reduce((best, val, idx, arr) => (val > arr[best] ? idx : best), 0)
        : -1;
    renderProbabilities(probs, topIndex, GESTURE_LABELS);

    if (result.landmarks && result.landmarks.length) {
      drawHandOverlay(result.landmarks[0]);
    } else {
      clearOverlay();
    }
  } catch (err) {
    console.error(err);
  } finally {
    gestureBusy = false;
  }
}

function clearOverlay() {
  if (!GESTURE_OVERLAY) return;
  const ctx = GESTURE_OVERLAY.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, GESTURE_OVERLAY.width, GESTURE_OVERLAY.height);
}

function resizeOverlay() {
  if (!GESTURE_OVERLAY || !PREVIEW_VIDEO) return;
  const w = PREVIEW_VIDEO.videoWidth;
  const h = PREVIEW_VIDEO.videoHeight;
  if (!w || !h) return;
  if (GESTURE_OVERLAY.width !== w || GESTURE_OVERLAY.height !== h) {
    GESTURE_OVERLAY.width = w;
    GESTURE_OVERLAY.height = h;
  }
}

function drawHandOverlay(landmarks = []) {
  if (!GESTURE_OVERLAY || !PREVIEW_VIDEO) return;
  resizeOverlay();
  const ctx = GESTURE_OVERLAY.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, GESTURE_OVERLAY.width, GESTURE_OVERLAY.height);

  const connections = gestureConnections || HAND_CONNECTIONS;

  if (drawingUtils && connections) {
    drawingUtils.drawConnectors(landmarks, connections, { color: '#28b88a', lineWidth: 3 });
    drawingUtils.drawLandmarks(landmarks, { color: '#ff3366', lineWidth: 2, radius: 4 });
    return;
  }

  const w = GESTURE_OVERLAY.width;
  const h = GESTURE_OVERLAY.height;

  ctx.strokeStyle = '#28b88a';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  connections.forEach(([a, b]) => {
    if (!landmarks[a] || !landmarks[b]) return;
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  });

  ctx.fillStyle = '#ff3366';
  landmarks.forEach((point) => {
    if (!point) return;
    ctx.beginPath();
    ctx.arc(point.x * w, point.y * h, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function gatherDataForClass() {
  if (trainingCompleted) return;
  const classNumber = parseInt(this.getAttribute('data-1hot'));
  gatherDataState = gatherDataState === STOP_DATA_GATHER ? classNumber : STOP_DATA_GATHER;
  dataGatherLoop();
}

function dataGatherLoop() {
  if (videoPlaying && gatherDataState !== STOP_DATA_GATHER) {
    const imageFeatures = tf.tidy(function () {
      const videoFrameAsTensor = tf.browser.fromPixels(CAPTURE_VIDEO);
      const resizedTensorFrame = tf.image.resizeBilinear(
        videoFrameAsTensor,
        [MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH],
        true
      );
      const normalizedTensorFrame = resizedTensorFrame.div(255);
      return mobilenet.predict(normalizedTensorFrame.expandDims()).squeeze();
    });

    trainingDataInputs.push(imageFeatures);
    trainingDataOutputs.push(gatherDataState);
    vibrateFeedback();

    if (examplesCount[gatherDataState] === undefined) {
      examplesCount[gatherDataState] = 0;
    }
    examplesCount[gatherDataState]++;

    updateExampleCounts();
    window.requestAnimationFrame(dataGatherLoop);
  }
}

function handleCollectStart(event) {
  event.preventDefault();
  const classNumber = parseInt(event.currentTarget.getAttribute('data-1hot'));
  gatherDataState = classNumber;
  dataGatherLoop();
}

function handleCollectEnd(event) {
  event.preventDefault();
  gatherDataState = STOP_DATA_GATHER;
}

function reset() {
  predict = false;
  previewReady = false;
  trainingCompleted = false;
  gatherDataState = STOP_DATA_GATHER;
  examplesCount.length = 0;
  for (let i = 0; i < trainingDataInputs.length; i++) {
    trainingDataInputs[i].dispose();
  }
  trainingDataInputs.length = 0;
  trainingDataOutputs.length = 0;
  STATUS.innerText = 'No data collected';
  PREVIEW_VIDEO.classList.add('hidden');
  unlockCapturePanels();
  rebuildModel();
  updateExampleCounts(true);
  lastPrediction = [];
  renderProbabilities([], -1, CLASS_NAMES);
  setMobileStep('collect');

  console.log('Tensors in memory: ' + tf.memory().numTensors);
}

async function loadMobileNetFeatureModel() {
  const URL =
    'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1';

  mobilenet = await tf.loadGraphModel(URL, { fromTFHub: true });
  STATUS.innerText = 'MobileNet v3 loaded successfully!';

  tf.tidy(function () {
    const answer = mobilenet.predict(tf.zeros([1, MOBILE_NET_INPUT_HEIGHT, MOBILE_NET_INPUT_WIDTH, 3]));
    console.log(answer.shape);
  });
}

loadMobileNetFeatureModel();

function rebuildModel() {
  const outputUnits = Math.max(CLASS_NAMES.length, 1);

  if (model) {
    model.dispose();
  }

  model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [1024], units: 128, activation: 'relu' }));
  model.add(tf.layers.dense({ units: outputUnits, activation: 'softmax' }));

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  model.summary();
}

function lockCapturePanels() {
  webcamPanels.forEach((panel) => panel.classList.remove('visible'));
  CAPTURE_VIDEO.classList.add('hidden');
  openWebcamButtons.forEach((btn) => (btn.disabled = true));
  dataCollectorButtons.forEach((btn) => (btn.disabled = true));
}

function unlockCapturePanels() {
  openWebcamButtons.forEach((btn) => (btn.disabled = false));
  dataCollectorButtons.forEach((btn) => (btn.disabled = false));
  CAPTURE_VIDEO.classList.remove('hidden');
}

function updateExampleCounts(reset = false) {
  countChips.forEach((chip) => {
    const idx = parseInt(chip.getAttribute('data-count-for'));
    const count = reset ? 0 : examplesCount[idx] || 0;
    chip.textContent = `${count} Bildbeispiele`;
  });
}

function setMobileStep(step) {
  bodyEl.setAttribute('data-step', step);
  mobileStepButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-step-target') === step);
  });
}

function vibrateFeedback() {
  if (navigator.vibrate) {
    navigator.vibrate(15);
  }
}
