import { sessionStore, DATASET_STATUS } from '../../store/sessionStore.js';
import { isTrainingReady } from '../../store/selectors.js';

export function registerCollectSummary(Alpine) {
  Alpine.data('collectSummary', () => ({
    totalClasses: 0,
    readyClasses: 0,
    totalSamples: 0,
    trainingReady: false,
    message: '',
    unsubscribe: null,

    init() {
      this.sync(sessionStore.getState());
      this.unsubscribe = sessionStore.subscribe((state) => this.sync(state));
    },

    destroy() {
      this.unsubscribe?.();
    },

    sync(state) {
      const classes = state.classes || [];
      this.totalClasses = classes.length;
      this.readyClasses = classes.filter(
        (cls) => cls.dataset?.status === DATASET_STATUS.READY
      ).length;
      this.totalSamples = classes.reduce(
        (acc, cls) => acc + (cls.dataset?.recordedCount || 0),
        0
      );
      this.trainingReady = isTrainingReady(state);
      this.message = this.buildMessage(classes);
    },

    buildMessage(classes) {
      if (!classes.length) {
        return 'Lege mindestens zwei Klassen an, um starten zu können.';
      }
      if (!this.trainingReady) {
        const incomplete = classes.filter(
          (cls) => cls.dataset?.status !== DATASET_STATUS.READY
        );
        if (incomplete.length) {
          return `${incomplete.length} Klasse(n) benötigen noch Beispiele.`;
        }
        return 'Mindestens zwei Klassen müssen im Status „Bereit“ sein.';
      }
      return 'Alle Klassen bereit für den Trainingsschritt.';
    },
  }));
}
