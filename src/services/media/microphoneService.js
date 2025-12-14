const DEFAULT_AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    channelCount: 1,
  },
};

let microphoneStream = null;

export async function requestMicrophoneStream(constraints = DEFAULT_AUDIO_CONSTRAINTS) {
  if (microphoneStream) return microphoneStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Mikrofonzugriff wird nicht unterstützt.');
  }
  microphoneStream = await navigator.mediaDevices.getUserMedia(constraints);
  return microphoneStream;
}

export function stopMicrophoneStream() {
  if (!microphoneStream) return;
  microphoneStream.getTracks().forEach((track) => track.stop());
  microphoneStream = null;
}

export async function recordAudioSample(durationMs = 2000) {
  const stream = await requestMicrophoneStream();
  if (typeof window.MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder wird nicht unterstützt.');
  }
  return new Promise((resolve, reject) => {
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    let stopped = false;

    const finalize = () => {
      if (stopped) return;
      stopped = true;
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        resolve({ blob, durationMs });
      } catch (error) {
        reject(error);
      }
    };

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        chunks.push(event.data);
      }
    };
    recorder.onerror = (event) => reject(event.error || new Error('Audioaufnahme fehlgeschlagen.'));
    recorder.onstop = finalize;
    recorder.start();
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, durationMs);
  });
}
