import {
  sessionStore,
  TRAINING_STATUS,
} from '../../store/sessionStore.js';
import { isTrainingReady, getTrainingSummary, getDatasetReadinessIssues } from '../../store/selectors.js';
import {
  trainWithRecordedSamples,
  abortTraining,
} from '../../services/ml/modelBridge.js';

export function registerTrainingComponents(Alpine) {
  Alpine.data('trainingPanel', () => ({
    training: sessionStore.getState().training,
    summary: getTrainingSummary(sessionStore.getState()),
    ready: isTrainingReady(sessionStore.getState()),
    step: sessionStore.getState().step,
    issues: getDatasetReadinessIssues(sessionStore.getState()),
    unsubscribe: null,

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.training = state.training;
        this.summary = getTrainingSummary(state);
        this.ready = isTrainingReady(state);
        this.step = state.step;
        this.issues = getDatasetReadinessIssues(state);
      });
    },

    destroy() {
      this.unsubscribe?.();
    },

    get isRunning() {
      return this.training?.status === TRAINING_STATUS.RUNNING;
    },

    get canStart() {
      return this.ready && !this.isRunning;
    },

    get canAbort() {
      return this.isRunning;
    },

    get statusLabel() {
      switch (this.training?.status) {
        case TRAINING_STATUS.DONE:
          return 'Abgeschlossen';
        case TRAINING_STATUS.RUNNING:
          return 'Läuft';
        case TRAINING_STATUS.ABORTED:
          return 'Abgebrochen';
        case TRAINING_STATUS.ERROR:
          return `Fehler: ${this.training?.error || ''}`;
        default:
          return 'Bereit';
      }
    },

    get lockHint() {
      if (this.isRunning) {
        return 'Während des Trainings sind Klassen gesperrt. Brich ab, um neue Daten zu sammeln.';
      }
      if (!this.ready) {
        return 'Sammle je Klasse genügend Beispiele, bevor du startest.';
      }
      return 'Alles bereit – starte das Training.';
    },

    startTraining() {
      if (!this.canStart) return;
      trainWithRecordedSamples();
    },

    abortTraining() {
      if (!this.canAbort) return;
      abortTraining();
    },
  }));
}
