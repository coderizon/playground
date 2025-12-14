import {
  MEDIAPIPE_VISION_BUNDLE_URL,
  MEDIAPIPE_VISION_WASM_URL,
  MEDIAPIPE_FACE_LANDMARKER_ASSET_URL,
} from '../../config/externalResources.js';

let vision = null;
let faceLandmarker = null;
let drawingUtils = null;

export const BLENDSHAPE_LABELS_DE = {
  neutral: 'Neutral',
  browDownLeft: 'Augenbraue unten links',
  browDownRight: 'Augenbraue unten rechts',
  browInnerUp: 'Innere Braue hoch',
  browOuterUpLeft: 'Äußere Braue hoch links',
  browOuterUpRight: 'Äußere Braue hoch rechts',
  cheekPuff: 'Wangen aufblasen',
  cheekSquintLeft: 'Wangenkneifen links',
  cheekSquintRight: 'Wangenkneifen rechts',
  eyeBlinkLeft: 'Augenblinzeln links',
  eyeBlinkRight: 'Augenblinzeln rechts',
  eyeLookDownLeft: 'Blick nach unten links',
  eyeLookDownRight: 'Blick nach unten rechts',
  eyeLookInLeft: 'Blick nach innen links',
  eyeLookInRight: 'Blick nach innen rechts',
  eyeLookOutLeft: 'Blick nach außen links',
  eyeLookOutRight: 'Blick nach außen rechts',
  eyeLookUpLeft: 'Blick nach oben links',
  eyeLookUpRight: 'Blick nach oben rechts',
  eyeSquintLeft: 'Augen kneifen links',
  eyeSquintRight: 'Augen kneifen rechts',
  eyeWideLeft: 'Augen aufreißen links',
  eyeWideRight: 'Augen aufreißen rechts',
  jawForward: 'Kiefer vor',
  jawLeft: 'Kiefer links',
  jawOpen: 'Kiefer öffnen',
  jawRight: 'Kiefer rechts',
  mouthClose: 'Mund schließen',
  mouthFrownLeft: 'Mundwinkel unten links',
  mouthFrownRight: 'Mundwinkel unten rechts',
  mouthFunnel: 'Mund spitzen',
  mouthLeft: 'Mund nach links',
  mouthLowerDownLeft: 'Unterlippe runter links',
  mouthLowerDownRight: 'Unterlippe runter rechts',
  mouthPressLeft: 'Lippe pressen links',
  mouthPressRight: 'Lippe pressen rechts',
  mouthPucker: 'Mund küssen',
  mouthRight: 'Mund nach rechts',
  mouthRollLower: 'Unterlippe einrollen',
  mouthRollUpper: 'Oberlippe einrollen',
  mouthShrugLower: 'Unterlippe heben',
  mouthShrugUpper: 'Oberlippe heben',
  mouthSmileLeft: 'Lächeln links',
  mouthSmileRight: 'Lächeln rechts',
  mouthStretchLeft: 'Mund ziehen links',
  mouthStretchRight: 'Mund ziehen rechts',
  mouthUpperUpLeft: 'Oberlippe hoch links',
  mouthUpperUpRight: 'Oberlippe hoch rechts',
  noseSneerLeft: 'Nase rümpfen links',
  noseSneerRight: 'Nase rümpfen rechts',
  mouthDimpleLeft: 'Grübchen links',
  mouthDimpleRight: 'Grübchen rechts',
  tongueOut: 'Zunge raus',
};

export const BLENDSHAPE_WHITELIST = [
  'mouthSmileLeft',
  'mouthSmileRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'browInnerUp',
  'browDownLeft',
  'browDownRight',
  'jawOpen',
  'mouthPucker',
  'cheekPuff',
  'tongueOut',
  'eyeWideLeft',
  'eyeWideRight',
  'mouthFrownLeft',
  'mouthFrownRight',
];

async function ensureVision() {
  if (vision) return vision;
  vision = await import(/* @vite-ignore */ MEDIAPIPE_VISION_BUNDLE_URL);
  return vision;
}

export async function ensureFaceLandmarker() {
  if (faceLandmarker) return faceLandmarker;
  
  const v = await ensureVision();
  const filesetResolver = await v.FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_URL);
  
  faceLandmarker = await v.FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_ASSET_URL,
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    outputFaceBlendshapes: true,
    numFaces: 1,
  });
  
  return faceLandmarker;
}

export async function detectFace(video, timestamp) {
  if (!video || video.readyState < 2) return null;
  
  const landmarker = await ensureFaceLandmarker();
  const result = landmarker.detectForVideo(video, timestamp);
  return result;
}

export async function getDrawingUtils(ctx) {
  if (drawingUtils) return drawingUtils;
  const v = await ensureVision();
  drawingUtils = new v.DrawingUtils(ctx);
  return drawingUtils;
}

export function drawFaceLandmarks(ctx, result) {
  if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) return;
  
  getDrawingUtils(ctx).then(utils => {
    const landmarks = result.faceLandmarks[0];
    const v = vision; // Closure capture or re-ensure? simpler to assume vision loaded if drawingUtils exists
    
    // Using standard tessellation from vision bundle constants if available, 
    // otherwise DrawingUtils usually has default connections.
    // The legacy code used vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION etc.
    
    utils.drawConnectors(landmarks, v.FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
      color: '#C0C0C070',
      lineWidth: 1,
    });
    utils.drawConnectors(landmarks, v.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
      color: '#FF3030',
    });
    utils.drawConnectors(landmarks, v.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {
      color: '#FF3030',
    });
    utils.drawConnectors(landmarks, v.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
      color: '#30FF30',
    });
    utils.drawConnectors(landmarks, v.FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {
      color: '#30FF30',
    });
    utils.drawConnectors(landmarks, v.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
      color: '#E0E0E0',
    });
    utils.drawConnectors(landmarks, v.FaceLandmarker.FACE_LANDMARKS_LIPS, {
      color: '#E0E0E0',
    });
  });
}
