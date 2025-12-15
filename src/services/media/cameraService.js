const DEFAULT_CONSTRAINTS = {
  video: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user',
  },
};

let activeStream = null;
let activeUsers = 0;
let activeStreamPromise = null;

export async function getVideoDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

export async function requestCameraStream(constraints = DEFAULT_CONSTRAINTS, deviceId = null) {
  if (activeStream) {
    activeUsers += 1;
    return activeStream;
  }

  let finalConstraints = constraints;
  if (deviceId) {
    finalConstraints = {
      ...constraints,
      video: {
        ...(constraints.video || {}),
        deviceId: { exact: deviceId },
      },
    };
    if (finalConstraints.video.facingMode) {
      delete finalConstraints.video.facingMode;
    }
  }

  if (!activeStreamPromise) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia wird nicht unterstützt.');
    }
    activeStreamPromise = navigator.mediaDevices
      .getUserMedia(finalConstraints)
      .then((stream) => {
        activeStream = stream;
        return stream;
      })
      .finally(() => {
        activeStreamPromise = null;
      });
  }

  const stream = await activeStreamPromise;
  activeUsers += 1;
  return stream;
}

export function stopCameraStream(force = false) {
  if (force) {
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    activeStream = null;
    activeUsers = 0;
    return;
  }

  if (activeUsers > 0) {
    activeUsers -= 1;
  }
  if (activeUsers <= 0 && activeStream) {
    activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
    activeUsers = 0;
  }
}

export function getActiveStream() {
  return activeStream;
}
