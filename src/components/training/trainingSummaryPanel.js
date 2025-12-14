import { sessionStore } from '../../app/store/sessionStore.js';
import {
  getTrainingSummary,
  getDatasetReadinessIssues,
  getAudioBackgroundIssues,
} from '../../app/store/selectors.js';

export function registerTrainingSummaryPanel(Alpine) {
  Alpine.data('trainingSummaryPanel', () => ({
    summary: getTrainingSummary(sessionStore.getState()),
    issues: getDatasetReadinessIssues(sessionStore.getState()),
    backgroundIssues: getAudioBackgroundIssues(sessionStore.getState()),
    unsubscribe: null,

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.summary = getTrainingSummary(state);
        this.issues = getDatasetReadinessIssues(state);
        this.backgroundIssues = getAudioBackgroundIssues(state);
      });
    },

    destroy() {
      this.unsubscribe?.();
    },

    readyCopy() {
      return `${this.summary.readyClasses}/${this.summary.totalClasses} Klassen bereit`;
    },

    totalSamplesCopy() {
      return `${this.summary.totalSamples} Samples insgesamt`;
    },
  }));
}
