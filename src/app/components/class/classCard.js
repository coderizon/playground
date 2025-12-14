import { sessionStore, DATASET_STATUS, TRAINING_STATUS } from '../../store/sessionStore.js';
import { createClassController } from '../../routes/classController.js';

const classController = createClassController();

export function registerClassCard(Alpine) {
  Alpine.data('classCard', (classId) => ({
    classId,
    classState: null,
    trainingLocked: sessionStore.getState().training?.status === TRAINING_STATUS.RUNNING,
    nameError: '',
    unsubscribe: null,

    init() {
      this.sync(sessionStore.getState());
      this.unsubscribe = sessionStore.subscribe((state) => this.sync(state));
    },

    destroy() {
      this.unsubscribe?.();
    },

    sync(state) {
      this.classState = state.classes.find((cls) => cls.id === this.classId) || null;
      this.trainingLocked = state.training?.status === TRAINING_STATUS.RUNNING;
    },

    get dataset() {
      return this.classState?.dataset || {
        recordedCount: 0,
        expectedCount: 0,
        status: DATASET_STATUS.EMPTY,
      };
    },

    datasetSummary() {
      return `${this.dataset.recordedCount}/${this.dataset.expectedCount} Beispiele`;
    },

    datasetChipClass() {
      const status = this.dataset.status || DATASET_STATUS.EMPTY;
      return {
        'dataset-chip': true,
        'dataset-chip--ready': status === DATASET_STATUS.READY,
        'dataset-chip--recording': status === DATASET_STATUS.RECORDING,
        'dataset-chip--error': status === DATASET_STATUS.ERROR,
      };
    },

    datasetLabel() {
      switch (this.dataset.status) {
        case DATASET_STATUS.READY:
          return 'Bereit';
        case DATASET_STATUS.RECORDING:
          return 'In Arbeit';
        case DATASET_STATUS.ERROR:
          return 'Fehler';
        default:
          return 'Leer';
      }
    },

    commitName(nextValue) {
      const sanitized = sanitize(nextValue);
      const error = validateName(this.classId, sanitized);
      if (error) {
        this.nameError = error;
        return;
      }
      this.nameError = '';
      sessionStore.setClassName(this.classId, sanitized);
    },

    deleteClass() {
      classController.removeClassWithConfirm(this.classState);
    },

    errorMessage() {
      return this.nameError;
    },
  }));
}

function sanitize(value) {
  return typeof value === 'string' ? value.trim().slice(0, 60) : '';
}

function validateName(id, value) {
  if (!value) return 'Name erforderlich';
  const classes = sessionStore.getState().classes || [];
  const duplicate = classes.some(
    (cls) => cls.id !== id && (cls.name || '').toLowerCase() === value.toLowerCase()
  );
  if (duplicate) return 'Name bereits vergeben';
  return '';
}
