const DEFAULT_CONSTRAINTS = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user',
  },
};

let activeStream = null;

export async function requestCameraStream(constraints = DEFAULT_CONSTRAINTS) {
  if (activeStream) return activeStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia wird nicht unterstützt.');
  }
  activeStream = await navigator.mediaDevices.getUserMedia(constraints);
  return activeStream;
}

export function stopCameraStream() {
  if (!activeStream) return;
  activeStream.getTracks().forEach((track) => track.stop());
  activeStream = null;
}

export function getActiveStream() {
  return activeStream;
}
