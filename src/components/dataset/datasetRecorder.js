import {
  sessionStore,
  DATASET_STATUS,
  TRAINING_STATUS,
  PERMISSION_STATUS,
} from '../../app/store/sessionStore.js';
import { createClassController } from '../../app/routes/classController.js';
import { createSampleController } from '../../app/routes/sampleController.js';
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
  const sampleController = createSampleController();
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
      return samples.map((sample, index) => {
        const annotation = sample.annotation || '';
        const capturedLabel = this.formatSampleTimestamp(sample.capturedAt);
        const sourceLabel =
          sample.source === 'microphone'
            ? 'Audioaufnahme'
            : sample.source === 'camera'
            ? 'Kamera'
            : 'Sample';
        const isBackground = this.isBackgroundSample(sample);
        return {
          ...sample,
          label: sample.label || `Sample ${index + 1}`,
          canDelete: !this.recording && !this.trainingLocked,
          displayLabel: this.sampleLabel(sample, index),
          displayDuration: this.sampleDuration(sample),
          thumbnail: sample.thumbnail || null,
          previewFrames: sample.previewFrames || [],
          canAnnotate: Boolean(sample.id),
          annotation,
          annotationLength: annotation.length,
          capturedLabel,
          sourceLabel,
          isBackground,
        };
      });
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
        sessionStore.setPermissionState('camera', {
          status: PERMISSION_STATUS.GRANTED,
          message: null,
        });
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
        sessionStore.setPermissionState('camera', {
          status: PERMISSION_STATUS.BLOCKED,
          message: this.lastPermissionError,
        });
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
      sampleController.removeSampleWithConfirm(this.classId, sample);
    },

    annotateSample(sample, value) {
      if (!sample?.id || this.recording || this.trainingLocked) return;
      const trimmed = value?.trim().slice(0, 80) || '';
      if (trimmed === sample.annotation) return;
      sessionStore.updateDatasetSample(this.classId, sample.id, {
        annotation: trimmed,
      });
    },

    deleteSample(sample) {
      this.removeSample(sample);
    },

    handleHotkey(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      const key = event.key?.toLowerCase();
      if (!key) return;
      if (key === 'r' && this.canStart) {
        event.preventDefault();
        this.startRecording();
        return;
      }
      if (key === 's' && this.canStop) {
        event.preventDefault();
        this.stopRecording();
        return;
      }
      if (key === 'd' && this.canDiscard) {
        event.preventDefault();
        this.discardDataset();
      }
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
          const capture = this.captureFrameSnapshot(video);
          await recordSampleFrame(
            video,
            this.classId,
            classIndex,
            state.classes.length || 1
          );
          sessionStore.addDatasetSample(this.classId, {
            source: 'camera',
            thumbnail: capture?.thumbnail,
            previewFrames: capture?.frames || [],
          });
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
        sessionStore.setPermissionState('microphone', {
          status: PERMISSION_STATUS.GRANTED,
          message: null,
        });
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
        sessionStore.setPermissionState('microphone', {
          status: PERMISSION_STATUS.BLOCKED,
          message: this.error,
        });
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
      const info = this.backgroundSampleInfo();
      if (!info.present) {
        return 'Hintergrundaufnahme fehlt – nimm eine 20s Aufnahme auf, damit das Modell Stille kennt.';
      }
      const timestamp = info.lastCapturedAt ? this.formatSampleTimestamp(info.lastCapturedAt) : '';
      const countCopy = info.count === 1 ? '1 Aufnahme' : `${info.count} Aufnahmen`;
      return timestamp ? `${countCopy} · zuletzt ${timestamp}` : countCopy;
    },

    hasBackgroundSample() {
      return this.backgroundSampleInfo().present;
    },

    sampleLabel(sample, index = 0) {
      if (this.isBackgroundSample(sample)) {
        return 'Hintergrund';
      }
      return sample.label || `Sample ${index + 1}`;
    },

    sampleDuration(sample) {
      if (!sample.durationMs) return sample.source || '';
      return `${(sample.durationMs / 1000).toFixed(1)}s`;
    },

    samplePreview(sample) {
      const frames = (sample.previewFrames || []).length
        ? sample.previewFrames
        : sample.thumbnail
        ? [sample.thumbnail]
        : [];
      return {
        frames,
        index: 0,
        timer: null,
        scrubbing: false,
        currentFrame() {
          return this.frames[this.index] || sample.thumbnail || null;
        },
        start() {
          if (!this.frames.length) return;
          if (this.scrubbing) return;
          this.stop();
          this.scrubbing = false;
          this.timer = window.setInterval(() => {
            this.index = (this.index + 1) % this.frames.length;
          }, 400);
        },
        stop() {
          if (this.timer) {
            window.clearInterval(this.timer);
            this.timer = null;
          }
          if (!this.scrubbing) {
            this.index = 0;
          }
        },
        scrubTo(position) {
          if (!this.frames.length) return;
          this.scrubbing = true;
          this.stop();
          const next = Math.min(
            Math.max(parseInt(position, 10) || 0, 0),
            this.frames.length - 1
          );
          this.index = next;
        },
        releaseScrub() {
          this.scrubbing = false;
        },
        scrubAriaLabel() {
          if (!this.frames.length) return 'Keine Frames verfügbar';
          return `Frame ${this.index + 1} von ${this.frames.length}`;
        },
        destroy() {
          this.stop();
          this.scrubbing = false;
        },
      };
    },

    cameraCoverage(frameSamples) {
      if (!frameSamples.length) return 'Nutzereingabe benötigt';
      const latest = frameSamples.at(-1)?.capturedAt || Date.now();
      const earliest = frameSamples[0]?.capturedAt || latest;
      const spreadSec = Math.max(Math.round((latest - earliest) / 1000), 1);
      return `Variation über ${spreadSec}s`;
    },

    captureFrameSnapshot(video) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frames = [canvas.toDataURL('image/jpeg', 0.7)];
        ctx.drawImage(video, 2, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/jpeg', 0.7));
        return { thumbnail: frames[0], frames };
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

    formatSampleTimestamp(value) {
      if (!value) return '';
      try {
        const date = new Date(value);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch {
        return '';
      }
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
    isBackgroundSample(sample) {
      if (!sample) return false;
      return (
        sample.preset === 'background' ||
        (sample.durationMs || 0) >= BACKGROUND_MIN_DURATION
      );
    },

    backgroundSamples() {
      if (!this.isAudioTask) return [];
      return (this.dataset.samples || []).filter((sample) => this.isBackgroundSample(sample));
    },

    backgroundSampleInfo() {
      const samples = this.backgroundSamples();
      if (!samples.length) {
        return { present: false, count: 0, lastCapturedAt: null };
      }
      const last = samples[samples.length - 1];
      return {
        present: true,
        count: samples.length,
        lastCapturedAt: last?.capturedAt || null,
      };
    },
