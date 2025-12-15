import { DATASET_STATUS, TRAINING_STATUS, STEP, PERMISSION_STATUS } from './sessionStore.js';

export function getSystemHints(state) {
  const hints = [];
  if (!state) return hints;

  const classes = state.classes || [];
  const trainingLocked = state.training?.status === TRAINING_STATUS.RUNNING;
  const step = state.step;
  const isCollect = step === STEP.COLLECT;

  // 1. Permission Issues (Global)
  if (state.permissions?.camera?.status === PERMISSION_STATUS.BLOCKED) {
    hints.push({
      id: 'perm-cam',
      message: 'Kamera blockiert. Bitte Zugriff im Browser erlauben.',
      tone: 'error',
    });
  }
  if (state.permissions?.microphone?.status === PERMISSION_STATUS.BLOCKED) {
    hints.push({
      id: 'perm-mic',
      message: 'Mikrofon blockiert. Bitte Zugriff im Browser erlauben.',
      tone: 'error',
    });
  }

  // 2. Training Lock (Global)
  if (trainingLocked) {
    hints.push({
      id: 'train-lock',
      message: 'Training läuft – Änderungen sind gesperrt.',
      tone: 'info',
    });
  }

  // 3. Collection Hints (Context-aware)
  if (isCollect) {
    const isAnyRecording = classes.some((c) => c.dataset?.status === DATASET_STATUS.RECORDING);
    const hasEmptyClass = classes.some((c) => (c.dataset?.recordedCount || 0) === 0);

    if (isAnyRecording) {
      hints.push({
        id: 'recording-active',
        message: 'Aufnahme läuft – bitte abschließen vor weiteren Aktionen.',
        tone: 'info',
      });
    }

    // "Training Gate" hints
    if (classes.length < 2) {
      hints.push({
        id: 'min-classes',
        message: 'Mindestens zwei Klassen für das Training erforderlich.',
        tone: 'warning',
      });
    } else {
      const incomplete = classes.some((c) => c.dataset?.status !== DATASET_STATUS.READY);
      if (incomplete) {
        hints.push({
          id: 'incomplete-classes',
          message: 'Fülle alle Klassen, bis sie „Bereit“ sind.',
          tone: 'info',
        });
      }
    }

    if (hasEmptyClass && !trainingLocked) {
      // Only show if not covered by min-classes?
      // Collect.jsx logic: if hasEmptyClass -> "Fülle zuerst..."
      // This might duplicate "incomplete-classes" message logic.
      // But let's keep it specific if the user is adding new classes.
      // Actually, "incomplete-classes" covers "empty".
      // But Collect.jsx had specific logic for "Adding class disabled".
      // Let's stick to the high-level guidance.
    }
  }

  return hints;
}
