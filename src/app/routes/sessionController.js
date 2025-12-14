import { sessionStore as realStore, STEP, INFERENCE_STATUS } from '../store/sessionStore.js';
import { openConfirmDialog } from '../components/common/confirmDialog.js';
import { showToast } from '../components/common/toast.js';
import { createInferenceController } from './inferenceController.js';
import { stopLiveInference } from '../services/ml/liveInference.js';

function fallbackConfirm(options = {}) {
  const message = options.message || 'Aktion bestätigen?';
  const approved =
    typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm(message)
      : true;
  if (approved) {
    options.onConfirm?.();
    return true;
  }
  return false;
}

export function createSessionController(options = {}) {
  const { store = realStore, confirm = fallbackConfirm, inferenceController } = options;
  const guard =
    inferenceController ||
    createInferenceController({
      store,
      confirm,
      stopLiveInference,
      notify: showToast,
    });

  const runDiscardConfirm = () => {
    const snapshot = store.getState();
    confirm({
      title: 'Session verwerfen?',
      message: snapshot.inference.status === INFERENCE_STATUS.RUNNING
        ? 'Inference läuft – Session und alle gesammelten Daten werden gelöscht.'
        : 'Aktuelle Session verwerfen? Alle gesammelten Daten gehen verloren.',
      destructive: true,
      confirmLabel: 'Session verwerfen',
      onConfirm: () => {
        store.discardSession();
        store.setStep(STEP.HOME);
      },
    });
  };

  return {
    discard() {
      if (!store.getState().selectedTaskModel) return false;
      guard.ensureInferenceStopped(runDiscardConfirm, {
        toastMessage: 'Inference gestoppt, bevor die Session verworfen wird.',
      });
      return true;
    },
  };
}

export const discardSessionWithConfirm = () =>
  createSessionController({
    store: realStore,
    confirm: openConfirmDialog,
  }).discard();
