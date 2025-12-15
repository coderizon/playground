import {
  MEDIAPIPE_VISION_BUNDLE_URL,
  MEDIAPIPE_VISION_WASM_URL,
  MEDIAPIPE_HAND_LANDMARKER_ASSET_URL
} from '../../config/externalResources.js';

let handLandmarker = null;

export async function ensureHandDetector() {
  if (handLandmarker) return handLandmarker;

  try {
    const vision = await import(MEDIAPIPE_VISION_BUNDLE_URL);
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_URL);
    handLandmarker = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_HAND_LANDMARKER_ASSET_URL,
        delegate: 'CPU',
      },
      numHands: 2,
      runningMode: 'VIDEO',
    });
    return handLandmarker;
  } catch (err) {
    console.error('Failed to load HandLandmarker', err);
    throw err;
  }
}

export async function detectHands(video) {
  if (!video || video.readyState < 2) return [];
  try {
    const landmarker = await ensureHandDetector();
    if (!landmarker) return [];
    
    const result = landmarker.detectForVideo(video, performance.now());
    
    if (!result || !result.landmarks) return [];
    
    // Return array of objects with keypoints property to match existing consumer contract
    // Keypoints are normalized {x, y, z} (0.0 - 1.0)
    return result.landmarks.map(landmarks => ({
      keypoints: landmarks
    }));
  } catch (err) {
    console.error('Hand detection error:', err);
    return [];
  }
}