import { sessionStore as realStore, TRAINING_STATUS } from '../store/sessionStore.js';
import { openConfirmDialog } from '../../components/common/confirmDialog.js';

export function createSampleController({ store = realStore, confirm = openConfirmDialog } = {}) {
  if (
    !store ||
    typeof store.getState !== 'function' ||
    typeof store.removeDatasetSample !== 'function'
  ) {
    throw new Error('[sampleController] store with getState/removeDatasetSample required');
  }
  if (typeof store.removeDatasetSamples !== 'function') {
    throw new Error('[sampleController] store must expose removeDatasetSamples');
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

  const removeSamplesWithConfirm = (classId, sampleIds = []) => {
    if (!classId || !Array.isArray(sampleIds) || sampleIds.length === 0) return false;
    if (isTrainingLocked()) return false;
    const classState = store.getState().classes.find((cls) => cls.id === classId);
    const message = classState
      ? `${sampleIds.length} Samples aus „${classState.name || 'Unbenannt'}“ werden dauerhaft gelöscht.`
      : `${sampleIds.length} Samples werden dauerhaft gelöscht.`;
    confirm({
      title: 'Samples löschen?',
      message,
      confirmLabel: 'Samples entfernen',
      destructive: true,
      onConfirm: () => {
        store.removeDatasetSamples(classId, sampleIds);
      },
    });
    return true;
  };

  return {
    removeSampleWithConfirm,
    removeSamplesWithConfirm,
  };
}

const controller = createSampleController();
export const removeSampleWithConfirm = (classId, sample) =>
  controller.removeSampleWithConfirm(classId, sample);
export const removeSamplesWithConfirm = (classId, sampleIds) =>
  controller.removeSamplesWithConfirm(classId, sampleIds);
