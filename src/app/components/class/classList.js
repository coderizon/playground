import { sessionStore, DATASET_STATUS, TRAINING_STATUS } from '../../store/sessionStore.js';
import { createClassController } from '../../routes/classController.js';
const classController = createClassController();

export function registerClassComponents(Alpine) {
  Alpine.data('classList', () => ({
    classes: [],
    validationErrors: {},
    trainingLocked: false,
    unsubscribe: null,

    init() {
      this.sync(sessionStore.getState());
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.sync(state);
      });
    },

    destroy() {
      this.unsubscribe?.();
    },

    sync(state) {
      this.classes = state.classes || [];
      this.trainingLocked = state.training?.status === TRAINING_STATUS.RUNNING;
      this.validateAll();
    },

    addClass() {
      if (this.trainingLocked) return;
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
      if (!classItem || this.trainingLocked) return;
      classController.removeClassWithConfirm(classItem);
    },

    datasetLabel(status) {
      switch (status) {
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
