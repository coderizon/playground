import { loadExternalScript } from '../../utils/loadScript.js';
import { MEDIAPIPE_HANDS_SCRIPT_URL } from '../../config/externalResources.js';
import handPoseUrl from '../../assets/hand-pose-detection.min.js?url';
import { ensureTfLoaded } from '../../utils/loadTf.js';

let detector = null;

export async function ensureHandDetector() {
  if (detector) return detector;

  await ensureTfLoaded();
  // Load MediaPipe Hands global
  await loadExternalScript(MEDIAPIPE_HANDS_SCRIPT_URL);
  // Load the wrapper library
  await loadExternalScript(handPoseUrl);

  if (!window.handPoseDetection) {
    throw new Error('handPoseDetection not found');
  }

  const model = window.handPoseDetection.SupportedModels.MediaPipeHands;
  const detectorConfig = {
    runtime: 'mediapipe',
    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
    modelType: 'full',
    maxHands: 2,
  };

  detector = await window.handPoseDetection.createDetector(model, detectorConfig);
  return detector;
}

export async function detectHands(video) {
  if (!video || video.readyState < 2) return [];
  try {
    const det = await ensureHandDetector();
    const hands = await det.estimateHands(video);
    return hands || [];
  } catch (err) {
    console.error('Hand detection error:', err);
    return [];
  }
}
