import { sessionStore, DATASET_STATUS } from '../../store/sessionStore.js';
import { openConfirmDialog } from '../common/confirmDialog.js';
import { requestCameraStream, stopCameraStream } from '../../services/media/cameraService.js';

export function registerClassComponents(Alpine) {
  Alpine.data('classList', () => ({
    classes: [],
    validationErrors: {},
    unsubscribe: null,
    recordingClassId: null,
    recordingError: null,
    sampleInterval: null,

    init() {
      this.sync(sessionStore.getState());
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.sync(state);
      });
    },

    isRecording(id) {
      return this.recordingClassId === id;
    },

    async startRecording(classItem) {
      if (!classItem || this.recordingClassId) return;
      try {
        const stream = await requestCameraStream();
        this.recordingClassId = classItem.id;
        this.attachPreview(stream);
        sessionStore.updateDatasetStatus(classItem.id, DATASET_STATUS.RECORDING);
        this.beginSampleLoop(classItem.id);
      } catch (error) {
        console.error(error);
        this.recordingError = 'Kamera konnte nicht gestartet werden.';
      }
    },

    stopRecording(classItem) {
      if (!classItem || this.recordingClassId !== classItem.id) return;
      stopCameraStream();
      this.detachPreview();
      this.endSampleLoop();
      this.recordingClassId = null;
      sessionStore.updateDatasetStatus(classItem.id, DATASET_STATUS.READY, {
        recordedCount: classItem.dataset.expectedCount,
      });
    },

    attachPreview(stream) {
      const video = this.$refs[`preview-${this.recordingClassId}`];
      if (video) {
        video.srcObject = stream;
      }
    },

    detachPreview() {
      const video = this.$refs[`preview-${this.recordingClassId}`];
      if (video) {
        video.srcObject = null;
      }
    },

    beginSampleLoop(classId) {
      this.endSampleLoop();
      this.sampleInterval = window.setInterval(() => {
        sessionStore.addDatasetSample(classId, { source: 'camera' });
        const state = sessionStore.getState();
        const classState = state.classes.find((cls) => cls.id === classId);
        if (!classState) return;
        if (classState.dataset.recordedCount >= classState.dataset.expectedCount) {
          this.stopRecording(classState);
        }
      }, 1200);
    },

    endSampleLoop() {
      if (this.sampleInterval) {
        window.clearInterval(this.sampleInterval);
        this.sampleInterval = null;
      }
    },

    destroy() {
      this.endSampleLoop();
      this.unsubscribe?.();
    },

    sync(state) {
      this.classes = state.classes || [];
      this.validateAll();
    },

    addClass() {
      sessionStore.addClass();
    },

    commitName(id, rawValue) {
      const sanitized = sanitize(rawValue);
      const error = this.validateName(id, sanitized);
      if (error) {
        this.setError(id, error);
        return;
      }
      this.clearError(id);
      sessionStore.setClassName(id, sanitized);
    },

    confirmDelete(classItem) {
      if (!classItem) return;
      openConfirmDialog({
        title: 'Klasse löschen?',
        message: `Die Klasse \"${classItem.name}\" und ihre Daten werden entfernt.`,
        confirmLabel: 'Löschen',
        destructive: true,
        onConfirm: () => sessionStore.removeClass(classItem.id),
      });
    },

    datasetLabel(status) {
      switch (status) {
        case DATASET_STATUS.READY:
          return 'Bereit';
        case DATASET_STATUS.RECORDING:
          return 'Aufnahme läuft';
        case DATASET_STATUS.ERROR:
          return 'Fehler';
        default:
          return 'Leer';
      }
    },

    datasetChipClass(status) {
      return `dataset-chip dataset-chip--${status}`;
    },

    validateName(id, value) {
      if (!value) return 'Name erforderlich';
      const classes = sessionStore.getState().classes || [];
      const duplicate = classes.some(
        (cls) => cls.id !== id && (cls.name || '').toLowerCase() === value.toLowerCase()
      );
      if (duplicate) return 'Name bereits vergeben';
      return '';
    },

    validateAll() {
      const classes = sessionStore.getState().classes || [];
      const nextErrors = {};
      classes.forEach((cls) => {
        const err = this.validateName(cls.id, (cls.name || '').trim());
        if (err) nextErrors[cls.id] = err;
      });
      this.validationErrors = nextErrors;
    },

    setError(id, message) {
      this.validationErrors = { ...this.validationErrors, [id]: message };
    },

    clearError(id) {
      if (!this.validationErrors[id]) return;
      const next = { ...this.validationErrors };
      delete next[id];
      this.validationErrors = next;
    },
  }));
}

function sanitize(value) {
  return typeof value === 'string' ? value.trim().slice(0, 60) : '';
}
