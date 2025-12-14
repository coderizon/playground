import { sessionStore, TRAINING_STATUS } from '../../app/store/sessionStore.js';

export function registerCollectToolbar(Alpine) {
  Alpine.data('collectToolbar', () => ({
    classCount: (sessionStore.getState().classes || []).length,
    trainingLocked: sessionStore.getState().training?.status === TRAINING_STATUS.RUNNING,
    unsubscribe: null,

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.classCount = (state.classes || []).length;
        this.trainingLocked = state.training?.status === TRAINING_STATUS.RUNNING;
      });
    },

    destroy() {
      this.unsubscribe?.();
    },

    addClass() {
      if (this.trainingLocked) return;
      sessionStore.addClass();
    },

    classCountCopy() {
      if (this.classCount === 1) {
        return '1 Klasse angelegt';
      }
      return `${this.classCount} Klassen angelegt`;
    },
  }));
}
