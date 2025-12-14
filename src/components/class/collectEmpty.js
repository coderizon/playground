import { sessionStore, TRAINING_STATUS } from '../../app/store/sessionStore.js';

export function registerCollectEmptyState(Alpine) {
  Alpine.data('collectEmpty', () => ({
    trainingLocked: sessionStore.getState().training?.status === TRAINING_STATUS.RUNNING,
    unsubscribe: null,

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.trainingLocked = state.training?.status === TRAINING_STATUS.RUNNING;
      });
    },

    destroy() {
      this.unsubscribe?.();
    },

    addFirstClass() {
      if (this.trainingLocked) return;
      sessionStore.addClass();
    },
  }));
}
