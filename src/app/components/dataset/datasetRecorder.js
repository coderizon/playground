import {
  sessionStore,
  DATASET_STATUS,
  TRAINING_STATUS,
} from '../../store/sessionStore.js';
import { createClassController } from '../../routes/classController.js';
import { requestCameraStream, stopCameraStream } from '../../services/media/cameraService.js';
import {
  requestMicrophoneStream,
  stopMicrophoneStream,
  recordAudioSample,
} from '../../services/media/microphoneService.js';
import { recordSampleFrame, clearSamplesForClass } from '../../services/ml/modelBridge.js';
import { showToast } from '../common/toast.js';

const AUDIO_PRESETS = {
  clip: {
    label: 'Kurzclip',
    duration: 2000,
    hint: 'Nimm 2s Clips mit klaren Geräuschen oder Wörtern auf.',
  },
  background: {
    label: 'Hintergrund',
    duration: 20000,
    hint: 'Halte 20s Umgebungsgeräusche fest, damit das Modell Stille erkennt.',
  },
};
const BACKGROUND_MIN_DURATION = 15000;

let activeRecorderId = null;

export function registerDatasetComponents(Alpine) {
  const datasetController = createClassController({
    clearDataset: clearSamplesForClass,
  });
  Alpine.data('datasetRecorder', (classId) => ({
    classId,
    classState: null,
    trainingStatus: sessionStore.getState().training.status,
    recording: false,
    error: null,
    sampleInterval: null,
    audioStopRequested: false,
    modality: sessionStore.getState().selectedTaskModel?.inputModality || 'camera',
    lastPermissionError: '',
    audioProgress: 0,
    audioProgressHandle: null,
    activePreset: 'clip',
    unsubscribe: null,

    init() {
      this.sync(sessionStore.getState());
      this.unsubscribe = sessionStore.subscribe((state) => this.sync(state));
    },

    destroy() {
      this.endSampleLoop();
      this.unsubscribe?.();
      if (activeRecorderId === this.classId) {
        this.teardownStreams();
        activeRecorderId = null;
      }
      this.resetAudioProgress();
    },

    sync(state) {
      this.classState = state.classes.find((cls) => cls.id === this.classId) || null;
      this.trainingStatus = state.training?.status || TRAINING_STATUS.IDLE;
      this.modality = state.selectedTaskModel?.inputModality || 'camera';
      if (this.trainingLocked && this.recording) {
        this.stopRecording();
      }
      if (activeRecorderId !== this.classId && this.recording) {
        // Recorder was force-stopped elsewhere, keep UI in sync.
        this.recording = false;
        this.endSampleLoop();
        this.detachPreview();
      }
    },

    get dataset() {
      return this.classState?.dataset || {
        recordedCount: 0,
        expectedCount: 0,
        status: DATASET_STATUS.EMPTY,
      };
    },

    get recordedCount() {
      return this.dataset.recordedCount || 0;
    },

    get expectedCount() {
      return this.dataset.expectedCount || 0;
    },

    get isReady() {
      return this.dataset.status === DATASET_STATUS.READY;
    },

    get requiresMoreSamples() {
      return this.recordedCount < this.expectedCount;
    },

    get trainingLocked() {
      return this.trainingStatus === TRAINING_STATUS.RUNNING;
    },

    get isAudioTask() {
      return this.modality === 'microphone';
    },

    get canStart() {
      if (this.trainingLocked) return false;
      if (this.recording) return false;
      if (!this.classState) return false;
      if (this.isReady) return false;
      if (activeRecorderId && activeRecorderId !== this.classId) return false;
      return true;
    },

    get canStop() {
      return this.recording;
    },

    get canDiscard() {
      return !this.recording && this.recordedCount > 0;
    },

    sampleList() {
      const samples = this.dataset.samples || [];
      return samples.map((sample, index) => ({
        ...sample,
        label: sample.label || `Sample ${index + 1}`,
        canDelete: !this.recording && !this.trainingLocked,
        displayLabel: this.sampleLabel(sample, index),
        displayDuration: this.sampleDuration(sample),
        thumbnail: this.resolveThumbnail(sample),
        canAnnotate: Boolean(sample.id),
        annotation: sample.annotation || '',
      }));
    },

    audioStats() {
      const samples = this.dataset.samples || [];
      const audioSamples = samples.filter((sample) => sample.source === 'microphone');
      if (!audioSamples.length) return null;
      const totalDuration = audioSamples.reduce(
        (sum, sample) => sum + (sample.durationMs || 0),
        0
      );
      const average = Math.round(totalDuration / audioSamples.length);
      const shortClip = audioSamples.some((sample) => (sample.durationMs || 0) < 1500);
      return {
        average,
        shortClip,
      };
    },

    cameraStats() {
      if (this.isAudioTask) return null;
      const samples = this.dataset.samples || [];
      const frameSamples = samples.filter((sample) => sample.source === 'camera');
      if (!frameSamples.length) return null;
      return {
        count: frameSamples.length,
        warning: frameSamples.length < this.expectedCount / 2,
        coverage: this.cameraCoverage(frameSamples),
      };
    },

    previewLabel() {
      if (this.isReady) return 'Datensatz bereit';
      if (this.recordedCount > 0) {
        return `${this.recordedCount}/${this.expectedCount} Beispiele`;
      }
      return 'Recorder bereit';
    },

    statusHint() {
      if (this.dataset?.readinessReason) {
        return this.dataset.readinessReason;
      }
      if (this.isReady) {
        return 'Datensatz vollständig · weiter zum Training möglich';
      }
      if (this.recordedCount === 0) {
        return `Benötigt ${this.expectedCount} Beispiele`;
      }
      return `Noch ${Math.max(this.expectedCount - this.recordedCount, 0)} Beispiele sammeln`;
    },

    async startRecording(options = {}) {
      if (!this.canStart) return;
      if (this.isAudioTask) {
        await this.startAudioRecording(options);
        return;
      }
      try {
        const stream = await requestCameraStream();
        this.error = null;
        this.lastPermissionError = '';
        this.attachPreview(stream);
        activeRecorderId = this.classId;
        this.recording = true;
        sessionStore.updateDatasetStatus(this.classId, DATASET_STATUS.RECORDING, {
          error: null,
        });
        this.beginSampleLoop();
      } catch (err) {
        console.error(err);
        this.error = 'Kamera konnte nicht gestartet werden.';
        this.lastPermissionError = err?.message || 'Bitte erlaube den Zugriff und versuche es erneut.';
        showToast({
          title: 'Kamera blockiert',
          message: this.lastPermissionError,
          tone: 'warning',
        });
      }
    },

    stopRecording() {
      if (!this.canStop) return;
      this.audioStopRequested = true;
      if (this.isAudioTask) {
        stopMicrophoneStream();
      } else {
        this.endSampleLoop();
        stopCameraStream();
        this.detachPreview();
      }
      this.recording = false;
      activeRecorderId = null;
      this.updateStatusAfterStop();
    },

    discardDataset() {
      if (!this.canDiscard) return;
      datasetController.discardDatasetWithConfirm(this.classId);
    },

    removeSample(sample) {
      if (!sample?.id || this.recording || this.trainingLocked) return;
      sessionStore.removeDatasetSample(this.classId, sample.id);
    },

    annotateSample(sample, value) {
      if (!sample?.id || this.recording || this.trainingLocked) return;
      sessionStore.updateDatasetSample(this.classId, sample.id, {
        annotation: value?.trim().slice(0, 80) || '',
      });
    },

    beginSampleLoop() {
      this.endSampleLoop();
      this.sampleInterval = window.setInterval(async () => {
        try {
          const state = sessionStore.getState();
          const video = this.$refs[`preview-${this.classId}`];
          if (!video) {
            throw new Error('Recorder-Vorschau fehlt.');
          }
          const classIndex = state.classes.findIndex((cls) => cls.id === this.classId);
          if (classIndex === -1) {
            this.stopRecording();
            return;
          }
          const thumbnail = this.captureFrameSnapshot(video);
          await recordSampleFrame(
            video,
            this.classId,
            classIndex,
            state.classes.length || 1
          );
          sessionStore.addDatasetSample(this.classId, { source: 'camera', thumbnail });
          const updated = sessionStore
            .getState()
            .classes.find((cls) => cls.id === this.classId);
          if (updated?.dataset?.recordedCount >= (updated?.dataset?.expectedCount || 0)) {
            this.stopRecording();
          }
      } catch (err) {
        console.error(err);
        this.error = 'Aufnahme fehlgeschlagen.';
        showToast({
          title: 'Recorder-Fehler',
          message: err?.message || 'Bitte versuche die Aufnahme erneut.',
          tone: 'error',
        });
        this.stopRecording();
        sessionStore.updateDatasetStatus(this.classId, DATASET_STATUS.ERROR, {
          error: err.message,
        });
        }
      }, 1200);
    },

    endSampleLoop() {
      if (this.sampleInterval) {
        window.clearInterval(this.sampleInterval);
        this.sampleInterval = null;
      }
    },

    attachPreview(stream) {
      if (this.isAudioTask) return;
      const video = this.$refs[`preview-${this.classId}`];
      if (video) {
        video.srcObject = stream;
      }
    },

    detachPreview() {
      if (this.isAudioTask) return;
      const video = this.$refs[`preview-${this.classId}`];
      if (video) {
        video.srcObject = null;
      }
    },

    async startAudioRecording({ duration, preset = 'clip' } = {}) {
      try {
        const config = AUDIO_PRESETS[preset] || AUDIO_PRESETS.clip;
        const durationMs = duration ?? config.duration;
        await requestMicrophoneStream();
        this.error = null;
        this.lastPermissionError = '';
        activeRecorderId = this.classId;
        this.recording = true;
        this.audioStopRequested = false;
        this.audioProgress = 0;
        this.currentAudioDuration = durationMs;
        this.activePreset = preset;
        sessionStore.updateDatasetStatus(this.classId, DATASET_STATUS.RECORDING, {
          error: null,
        });
        this.animateAudioProgress(durationMs);
        this.captureAudioSample(durationMs);
      } catch (error) {
        console.error(error);
        this.error = error?.message || 'Mikrofon konnte nicht gestartet werden.';
        this.lastPermissionError = this.error;
        showToast({
          title: 'Mikrofon blockiert',
          message: this.error,
          tone: 'warning',
        });
      }
    },

    async captureAudioSample(durationMs = 2000) {
      if (!this.recording || this.audioStopRequested) {
        this.updateStatusAfterStop();
        return;
      }
      try {
        const result = await recordAudioSample(durationMs);
        sessionStore.addDatasetSample(this.classId, {
          source: 'microphone',
          durationMs: result?.durationMs || durationMs,
        });
        const updated = sessionStore
          .getState()
          .classes.find((cls) => cls.id === this.classId);
        if (updated?.dataset?.recordedCount >= (updated?.dataset?.expectedCount || 0)) {
          this.stopRecording();
          return;
        }
        if (!this.audioStopRequested) {
          this.animateAudioProgress(durationMs);
          this.captureAudioSample(durationMs);
        }
      } catch (error) {
        console.error(error);
        this.error = error?.message || 'Audioaufnahme fehlgeschlagen.';
        showToast({
          title: 'Audioaufnahme fehlgeschlagen',
          message: this.error,
          tone: 'error',
        });
        this.stopRecording();
        sessionStore.updateDatasetStatus(this.classId, DATASET_STATUS.ERROR, {
          error: this.error,
        });
      }
    },

    updateStatusAfterStop() {
      const status =
        this.recordedCount >= this.expectedCount
          ? DATASET_STATUS.READY
          : this.recordedCount > 0
          ? DATASET_STATUS.RECORDING
          : DATASET_STATUS.EMPTY;
      sessionStore.updateDatasetStatus(this.classId, status);
      if (this.isAudioTask) {
        this.resetAudioProgress();
      }
    },

    teardownStreams() {
      if (this.isAudioTask) {
        stopMicrophoneStream();
      } else {
        stopCameraStream();
      }
    },

    audioStatusLabel() {
      if (this.recording) return 'Audioaufnahme läuft';
      if (this.recordedCount > 0) {
        return `${this.recordedCount}/${this.expectedCount} Clips`;
      }
      return 'Recorder bereit';
    },

    audioPresetHint() {
      if (!this.isAudioTask) return '';
      const preset = AUDIO_PRESETS[this.activePreset] || AUDIO_PRESETS.clip;
      return preset.hint;
    },

    activePresetLabel() {
      const preset = AUDIO_PRESETS[this.activePreset] || AUDIO_PRESETS.clip;
      return preset.label;
    },

    audioBackgroundStatus() {
      if (!this.isAudioTask) return '';
      return this.hasBackgroundSample()
        ? 'Hintergrund erfasst – kombiniere ihn mit Kurzclips für klare Signale.'
        : 'Füge eine 20s Hintergrundaufnahme hinzu, damit das Modell Stille erkennt.';
    },

    hasBackgroundSample() {
      const samples = this.dataset.samples || [];
      return samples.some((sample) => (sample.durationMs || 0) >= BACKGROUND_MIN_DURATION);
    },

    sampleLabel(sample, index = 0) {
      if ((sample.durationMs || 0) >= BACKGROUND_MIN_DURATION || sample.preset === 'background') {
        return 'Hintergrund';
      }
      return sample.label || `Sample ${index + 1}`;
    },

    sampleDuration(sample) {
      if (!sample.durationMs) return sample.source || '';
      return `${(sample.durationMs / 1000).toFixed(1)}s`;
    },

    resolveThumbnail(sample) {
      if (sample.thumbnail) return sample.thumbnail;
      if (sample.source === 'camera') {
        return this.generateCameraPreview();
      }
      return null;
    },

    generateCameraPreview() {
      const video = this.$refs[`preview-${this.classId}`];
      if (!video) return null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.7);
      } catch (error) {
        console.warn('Vorschau konnte nicht erstellt werden', error);
        return null;
      }
    },

    cameraCoverage(frameSamples) {
      if (!frameSamples.length) return 'Nutzereingabe benötigt';
      const latest = frameSamples.at(-1)?.capturedAt || Date.now();
      const earliest = frameSamples[0]?.capturedAt || latest;
      const spreadSec = Math.max(Math.round((latest - earliest) / 1000), 1);
      return `Variation über ${spreadSec}s`;
    },

    audioPresetHint() {
      if (!this.isAudioTask) return '';
      const preset = AUDIO_PRESETS[this.activePreset] || AUDIO_PRESETS.clip;
      return preset.hint;
    },

    activePresetLabel() {
      const preset = AUDIO_PRESETS[this.activePreset] || AUDIO_PRESETS.clip;
      return preset.label;
    },

    audioBackgroundStatus() {
      if (!this.isAudioTask) return '';
      return this.hasBackgroundSample()
        ? 'Hintergrund erfasst · kombiniere mit Kurzclips.'
        : 'Füge eine 20s Hintergrundaufnahme hinzu, damit das Modell Stille kennt.';
    },

    hasBackgroundSample() {
      const samples = this.classState?.dataset?.samples || [];
      return samples.some((sample) => (sample.durationMs || 0) >= BACKGROUND_MIN_DURATION);
    },

    captureFrameSnapshot(video) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.7);
      } catch (error) {
        console.warn('Snapshot konnte nicht erstellt werden.', error);
        return null;
      }
    },

    animateAudioProgress(durationMs) {
      this.resetAudioProgress();
      const start = performance.now();
      const tick = (now) => {
        if (!this.recording || this.audioStopRequested) {
          this.audioProgress = 0;
          return;
        }
        const elapsed = now - start;
        this.audioProgress = Math.min(100, Math.round((elapsed / durationMs) * 100));
        if (elapsed < durationMs) {
          this.audioProgressHandle = requestAnimationFrame(tick);
        }
      };
      this.audioProgressHandle = requestAnimationFrame(tick);
    },

    resetAudioProgress() {
      if (this.audioProgressHandle) {
        cancelAnimationFrame(this.audioProgressHandle);
        this.audioProgressHandle = null;
      }
      this.audioProgress = 0;
    },
  }));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
