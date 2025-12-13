import {
  sessionStore,
  DATASET_STATUS,
  TRAINING_STATUS,
} from '../../store/sessionStore.js';
import { openConfirmDialog } from '../common/confirmDialog.js';
import { requestCameraStream, stopCameraStream } from '../../services/media/cameraService.js';
import {
  requestMicrophoneStream,
  stopMicrophoneStream,
  recordAudioSample,
} from '../../services/media/microphoneService.js';
import {
  recordSampleFrame,
  clearSamplesForClass,
} from '../../services/ml/modelBridge.js';
import { showToast } from '../common/toast.js';

let activeRecorderId = null;

export function registerDatasetComponents(Alpine) {
  Alpine.data('datasetRecorder', (classId) => ({
    classId,
    classState: null,
    trainingStatus: sessionStore.getState().training.status,
    recording: false,
    error: null,
    sampleInterval: null,
    audioStopRequested: false,
    modality: sessionStore.getState().selectedTaskModel?.inputModality || 'camera',
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
      return (this.dataset.samples || []).map((sample, index) => ({
        ...sample,
        label: `Sample ${index + 1}`,
        canDelete: !this.recording && !this.trainingLocked,
      }));
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

    async startRecording() {
      if (!this.canStart) return;
      if (this.isAudioTask) {
        await this.startAudioRecording();
        return;
      }
      try {
        const stream = await requestCameraStream();
        this.error = null;
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
      openConfirmDialog({
        title: 'Datensatz verwerfen?',
        message: 'Alle aufgezeichneten Beispiele dieser Klasse werden gelöscht.',
        confirmLabel: 'Datensatz löschen',
        destructive: true,
        onConfirm: () => {
          clearSamplesForClass(this.classId);
          sessionStore.resetDataset(this.classId);
        },
      });
    },

    removeSample(sample) {
      if (!sample?.id || this.recording || this.trainingLocked) return;
      sessionStore.removeDatasetSample(this.classId, sample.id);
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
          await recordSampleFrame(
            video,
            this.classId,
            classIndex,
            state.classes.length || 1
          );
          sessionStore.addDatasetSample(this.classId, { source: 'camera' });
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

    async startAudioRecording() {
      try {
        await requestMicrophoneStream();
        this.error = null;
        activeRecorderId = this.classId;
        this.recording = true;
        this.audioStopRequested = false;
        sessionStore.updateDatasetStatus(this.classId, DATASET_STATUS.RECORDING, {
          error: null,
        });
        this.captureAudioSample();
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

    async captureAudioSample() {
      if (!this.recording || this.audioStopRequested) {
        this.updateStatusAfterStop();
        return;
      }
      try {
        await recordAudioSample(2000);
        sessionStore.addDatasetSample(this.classId, {
          source: 'microphone',
          durationMs: 2000,
        });
        const updated = sessionStore
          .getState()
          .classes.find((cls) => cls.id === this.classId);
        if (updated?.dataset?.recordedCount >= (updated?.dataset?.expectedCount || 0)) {
          this.stopRecording();
          return;
        }
        if (!this.audioStopRequested) {
          this.captureAudioSample();
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
  }));
}
