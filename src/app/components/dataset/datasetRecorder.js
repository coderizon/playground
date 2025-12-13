import {
  sessionStore,
  DATASET_STATUS,
  TRAINING_STATUS,
} from '../../store/sessionStore.js';
import { openConfirmDialog } from '../common/confirmDialog.js';
import { requestCameraStream, stopCameraStream } from '../../services/media/cameraService.js';
import {
  recordSampleFrame,
  clearSamplesForClass,
} from '../../services/ml/modelBridge.js';

let activeRecorderId = null;

export function registerDatasetComponents(Alpine) {
  Alpine.data('datasetRecorder', (classId) => ({
    classId,
    classState: null,
    trainingStatus: sessionStore.getState().training.status,
    recording: false,
    error: null,
    sampleInterval: null,
    unsubscribe: null,

    init() {
      this.sync(sessionStore.getState());
      this.unsubscribe = sessionStore.subscribe((state) => this.sync(state));
    },

    destroy() {
      this.endSampleLoop();
      this.unsubscribe?.();
      if (activeRecorderId === this.classId) {
        stopCameraStream();
        activeRecorderId = null;
      }
    },

    sync(state) {
      this.classState = state.classes.find((cls) => cls.id === this.classId) || null;
      this.trainingStatus = state.training?.status || TRAINING_STATUS.IDLE;
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

    previewLabel() {
      if (this.isReady) return 'Datensatz bereit';
      if (this.recordedCount > 0) {
        return `${this.recordedCount}/${this.expectedCount} Beispiele`;
      }
      return 'Recorder bereit';
    },

    statusHint() {
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
      }
    },

    stopRecording() {
      if (!this.canStop) return;
      this.endSampleLoop();
      stopCameraStream();
      this.detachPreview();
      this.recording = false;
      activeRecorderId = null;
      const status =
        this.recordedCount >= this.expectedCount
          ? DATASET_STATUS.READY
          : this.recordedCount > 0
          ? DATASET_STATUS.RECORDING
          : DATASET_STATUS.EMPTY;
      sessionStore.updateDatasetStatus(this.classId, status);
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
      const video = this.$refs[`preview-${this.classId}`];
      if (video) {
        video.srcObject = stream;
      }
    },

    detachPreview() {
      const video = this.$refs[`preview-${this.classId}`];
      if (video) {
        video.srcObject = null;
      }
    },
  }));
}
