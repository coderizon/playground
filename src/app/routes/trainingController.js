import { sessionStore as realStore, TRAINING_STATUS } from '../store/sessionStore.js';
import { openConfirmDialog } from '../../components/common/confirmDialog.js';
import {
  trainWithRecordedSamples as realTrainWithRecordedSamples,
  abortTraining as realAbortTraining,
} from '../../services/ml/modelBridge.js';

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

  const updateParams = (patch = {}) => {
    const state = store.getState();
    if (state.training?.status === TRAINING_STATUS.RUNNING) return false;

    const currentParams = state.training.params || {};
    const nextParams = { ...currentParams };

    if (patch.epochs !== undefined) {
      nextParams.epochs = Math.max(1, parseInt(patch.epochs, 10) || 1);
    }
    if (patch.batchSize !== undefined) {
      nextParams.batchSize = Math.max(1, parseInt(patch.batchSize, 10) || 1);
    }
    if (patch.learningRate !== undefined) {
      nextParams.learningRate = Math.max(0.0001, parseFloat(patch.learningRate) || 0.001);
    }

    store.setTrainingStatus(state.training.status, { params: nextParams });
    return true;
  };

  return {
    start,
    abort,
    updateParams,
  };
}

const controller = createTrainingController();
export const startTrainingWithController = () => controller.start();
export const abortTrainingWithController = () => controller.abort();
export const updateTrainingParams = (patch) => controller.updateParams(patch);
