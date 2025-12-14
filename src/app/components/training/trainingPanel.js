import {
  sessionStore,
  TRAINING_STATUS,
} from '../../store/sessionStore.js';
import {
  isTrainingReady,
  getTrainingSummary,
  getDatasetReadinessIssues,
  getTrainingRetryContext,
} from '../../store/selectors.js';
import {
  trainWithRecordedSamples,
  abortTraining,
} from '../../services/ml/modelBridge.js';

export function registerTrainingComponents(Alpine) {
  const initialState = sessionStore.getState();
  const initialRetry = getTrainingRetryContext(initialState);
  Alpine.data('trainingPanel', () => ({
    training: initialState.training,
    summary: getTrainingSummary(initialState),
    ready: isTrainingReady(initialState),
    step: initialState.step,
    issues: getDatasetReadinessIssues(initialState),
    retry: initialRetry,
    staleClasses: initialRetry?.staleClasses || [],
    unsubscribe: null,

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.training = state.training;
        this.summary = getTrainingSummary(state);
        this.ready = isTrainingReady(state);
        this.step = state.step;
        this.issues = getDatasetReadinessIssues(state);
        this.retry = getTrainingRetryContext(state);
        this.staleClasses = this.retry?.staleClasses || [];
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

    get lastRunLabel() {
      const info = this.retry?.lastRun;
      if (!info) return '';
      const time = info.completedAt ? new Date(info.completedAt).toLocaleTimeString() : '';
      switch (info.status) {
        case TRAINING_STATUS.DONE:
          return `Zuletzt erfolgreich trainiert (${time}).`;
        case TRAINING_STATUS.ABORTED:
          return `Letzter Durchlauf abgebrochen (${time}). Passe deine Daten an und starte erneut.`;
        case TRAINING_STATUS.ERROR:
          return `Letzter Durchlauf fehlgeschlagen (${time}): ${info.error || ''}`;
        default:
          return '';
      }
    },

    get datasetChangeLabel() {
      if (!this.retry?.lastRun) return '';
      if (!this.retry?.latestDatasetUpdate) {
        return '';
      }
      if (!this.retry.datasetChangedSinceLastRun) {
        return 'Seit dem letzten Training wurden keine neuen Samples aufgenommen.';
      }
      if (this.staleClasses.length === 1) {
        return '1 Klasse hat neue Samples seit dem letzten Training.';
      }
      return `${this.staleClasses.length} Klassen haben neue Samples seit dem letzten Training.`;
    },

    get hasRetryInsights() {
      return Boolean(this.retry?.lastRun);
    },

    startTraining() {
      if (!this.canStart) return;
      trainWithRecordedSamples();
    },

    abortTraining() {
      if (!this.canAbort) return;
      abortTraining();
    },

    formatTimestamp(value) {
      if (!value) return '';
      try {
        return new Date(value).toLocaleString();
      } catch {
        return '';
      }
    },
  }));
}
