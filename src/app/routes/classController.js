import { sessionStore as realStore, TRAINING_STATUS } from '../store/sessionStore.js';
import { openConfirmDialog } from '../../components/common/confirmDialog.js';

export function createClassController({
  store = realStore,
  confirm = openConfirmDialog,
  clearDataset,
} = {}) {
  const isTrainingLocked = () => store.getState().training?.status === TRAINING_STATUS.RUNNING;

  const removeClassWithConfirm = (classState) => {
    if (!classState || !classState.id) return false;
    if (isTrainingLocked()) return false;
    confirm({
      title: 'Klasse löschen?',
      message: `Die Klasse „${classState.name || 'Unbenannt'}“ und alle Daten werden entfernt.`,
      confirmLabel: 'Löschen',
      destructive: true,
      onConfirm: () => store.removeClass(classState.id),
    });
    return true;
  };

  const discardDatasetWithConfirm = (classId) => {
    if (!classId || isTrainingLocked()) return false;
    const classState = store.getState().classes.find((cls) => cls.id === classId);
    if (!classState) return false;
    confirm({
      title: 'Datensatz verwerfen?',
      message: `Alle Samples von „${classState.name || 'Unbenannt'}“ werden gelöscht.`,
      confirmLabel: 'Datensatz löschen',
      destructive: true,
      onConfirm: () => {
        clearDataset?.(classId);
        store.resetDataset(classId);
      },
    });
    return true;
  };

  return {
    removeClassWithConfirm,
    discardDatasetWithConfirm,
  };
}
