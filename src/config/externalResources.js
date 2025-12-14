const TFJS_VERSION = '3.11.0';
const MEDIAPIPE_VISION_VERSION = '0.10.3';

export const TFJS_SCRIPT_URL = `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@${TFJS_VERSION}/dist/tf.min.js`;

export const TF_MOBILENET_FEATURE_VECTOR_URL =
  'https://tfhub.dev/google/tfjs-model/imagenet/mobilenet_v3_small_100_224/feature_vector/5/default/1';

export const MEDIAPIPE_VISION_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VISION_VERSION}`;
export const MEDIAPIPE_VISION_WASM_URL = `${MEDIAPIPE_VISION_BUNDLE_URL}/wasm`;

export const MEDIAPIPE_HAND_LANDMARKER_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
export const MEDIAPIPE_FACE_LANDMARKER_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
