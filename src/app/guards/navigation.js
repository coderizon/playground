import { STEP, DATASET_STATUS, TRAINING_STATUS } from '../store/sessionStore.js';

/**
 * Guard helpers enforce session invariants defined in the vision document.
 * Each function is pure/deterministic and can be unit-tested in isolation.
 */

export function canGoToCollect(state) {
  if (!state) return false;
  return Boolean(state.selectedTaskModel);
}

export function canGoToTraining(state) {
  if (!state) return false;
  if (state.step !== STEP.COLLECT) return false;
  return areClassesReady(state);
}

export function canAccessTraining(state) {
  if (!state) return false;
  if (!state.selectedTaskModel) return false;
  return areClassesReady(state);
}

export function canAccessInference(state) {
  if (!state) return false;
  if (!state.selectedTaskModel) return false;
  if (state.selectedTaskModel.requiresTraining === false) return true;
  return state.training?.status === TRAINING_STATUS.DONE;
}

function areClassesReady(state) {
  const classes = state.classes || [];
  if (classes.length < 2) return false;
  return classes.every((classState) => classState.dataset?.status === DATASET_STATUS.READY);
}
