import { sessionStore as realStore, TRAINING_STATUS } from '../store/sessionStore.js';
import { openConfirmDialog } from '../../components/common/confirmDialog.js';

export function createSampleController({ store = realStore, confirm = openConfirmDialog } = {}) {
  if (!store || typeof store.getState !== 'function' || typeof store.removeDatasetSample !== 'function') {
    throw new Error('[sampleController] store with getState/removeDatasetSample required');
  }

  const isTrainingLocked = () =>
    store.getState().training?.status === TRAINING_STATUS.RUNNING;

  const removeSampleWithConfirm = (classId, sample) => {
    if (!classId || !sample?.id) return false;
    if (isTrainingLocked()) return false;
    const classState = store.getState().classes.find((cls) => cls.id === classId);
    const label =
      sample.displayLabel ||
      sample.annotation ||
      sample.label ||
      `Sample ${sample.order || ''}`.trim() ||
      'Sample';
    const message = classState
      ? `Das Sample „${label}“ aus „${classState.name || 'Unbenannt'}“ wird dauerhaft gelöscht.`
      : `Das Sample „${label}“ wird dauerhaft gelöscht.`;
    confirm({
      title: 'Sample löschen?',
      message,
      confirmLabel: 'Sample entfernen',
      destructive: true,
      onConfirm: () => {
        store.removeDatasetSample(classId, sample.id);
      },
    });
    return true;
  };

  return {
    removeSampleWithConfirm,
  };
}

const controller = createSampleController();
export const removeSampleWithConfirm = (classId, sample) =>
  controller.removeSampleWithConfirm(classId, sample);
