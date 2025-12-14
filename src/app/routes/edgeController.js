import { sessionStore as realStore } from '../store/sessionStore.js';
import { openConfirmDialog } from '../components/common/confirmDialog.js';
import { showToast as defaultNotify } from '../components/common/toast.js';
import { createInferenceController } from './inferenceController.js';
import { stopLiveInference as realStopLiveInference } from '../services/ml/liveInference.js';

export function createEdgeController({
  store = realStore,
  confirm = openConfirmDialog,
  disconnect,
  notify = defaultNotify,
  stopLiveInference = realStopLiveInference,
  inferenceController,
} = {}) {
  if (!store || typeof store.getState !== 'function') {
    throw new Error('[edgeController] store with getState required');
  }
  if (typeof confirm !== 'function') {
    throw new Error('[edgeController] confirm function required');
  }
  if (typeof disconnect !== 'function') {
    throw new Error('[edgeController] disconnect function required');
  }

  const guard =
    inferenceController ||
    createInferenceController({
      store,
      confirm,
      stopLiveInference,
      notify,
    });

  if (!guard || typeof guard.ensureInferenceStopped !== 'function') {
    throw new Error('[edgeController] inferenceController with ensureInferenceStopped required');
  }

  const getDeviceLabel = () => {
    const deviceName = store.getState().edge?.deviceInfo?.name;
    return deviceName || 'dein Edge-Gerät';
  };

  const disconnectWithConfirm = () => {
    const toastMessage = 'Inference gestoppt, bevor die Edge-Verbindung getrennt wurde.';
    return guard.ensureInferenceStopped(() => {
      confirm({
        title: 'Edge-Gerät trennen?',
        message: `Die Verbindung zu ${getDeviceLabel()} wird getrennt. Du kannst später erneut verbinden.`,
        confirmLabel: 'Verbindung trennen',
        destructive: true,
        onConfirm: () => {
          disconnect();
          notify?.({
            title: 'Edge getrennt',
            message: `${getDeviceLabel()} wurde getrennt.`,
            tone: 'info',
          });
        },
      });
    }, { toastMessage });
  };

  return {
    disconnectWithConfirm,
  };
}
