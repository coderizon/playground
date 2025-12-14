import { sessionStore, DATASET_STATUS, TRAINING_STATUS } from '../../store/sessionStore.js';
import { createClassController } from '../../routes/classController.js';

const classController = createClassController();

export function registerClassCard(Alpine) {
  Alpine.data('classCard', (classId) => ({
    classId,
    classState: null,
    trainingLocked: sessionStore.getState().training?.status === TRAINING_STATUS.RUNNING,
    validationErrors: {},
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
      this.validationErrors = state.validationErrors || {};
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
      return {
        'dataset-chip': true,
        'dataset-chip--ready': this.dataset.status === DATASET_STATUS.READY,
        'dataset-chip--recording': this.dataset.status === DATASET_STATUS.RECORDING,
        'dataset-chip--error': this.dataset.status === DATASET_STATUS.ERROR,
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
      classController.commitName?.(this.classState, nextValue);
    },

    deleteClass() {
      classController.removeClassWithConfirm(this.classState);
    },

    errorMessage() {
      return this.validationErrors?.[this.classId] || '';
    },
  }));
}
