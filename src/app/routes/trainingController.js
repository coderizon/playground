import { sessionStore as realStore, TRAINING_STATUS } from '../store/sessionStore.js';
import { openConfirmDialog } from '../components/common/confirmDialog.js';
import {
  trainWithRecordedSamples as realTrainWithRecordedSamples,
  abortTraining as realAbortTraining,
} from '../services/ml/modelBridge.js';

export function createTrainingController({
  store = realStore,
  confirm = openConfirmDialog,
  trainWithRecordedSamples = realTrainWithRecordedSamples,
  abortTraining = realAbortTraining,
} = {}) {
  if (!store || typeof store.getState !== 'function') {
    throw new Error('[trainingController] store with getState required');
  }
  if (typeof trainWithRecordedSamples !== 'function' || typeof abortTraining !== 'function') {
    throw new Error('[trainingController] training functions required');
  }

  const start = () => {
    trainWithRecordedSamples();
    return true;
  };

  const abort = () => {
    const state = store.getState();
    if (state.training?.status !== TRAINING_STATUS.RUNNING) return false;
    confirm({
      title: 'Training abbrechen?',
      message:
        'Aktuelles Training stoppen? Die bisher berechneten Gewichte werden verworfen, deine Datensätze bleiben erhalten.',
      confirmLabel: 'Training stoppen',
      destructive: true,
      onConfirm: () => {
        abortTraining();
      },
    });
    return true;
  };

  return {
    start,
    abort,
  };
}

const controller = createTrainingController();
export const startTrainingWithController = () => controller.start();
export const abortTrainingWithController = () => controller.abort();
