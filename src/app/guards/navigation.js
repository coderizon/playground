import { STEP, DATASET_STATUS } from '../store/sessionStore.js';

export function canGoToCollect(state) {
  if (!state) return false;
  return Boolean(state.selectedTaskModel);
}

export function canGoToTraining(state) {
  if (!state) return false;
  if (state.step !== STEP.COLLECT) return false;
  const classes = state.classes || [];
  if (classes.length < 2) return false;
  return classes.every((classState) => classState.dataset?.status === DATASET_STATUS.READY);
}

export function canAccessTraining(state) {
  if (!state) return false;
  const classes = state.classes || [];
  if (!state.selectedTaskModel || classes.length < 2) return false;
  return classes.every((classState) => classState.dataset?.status === DATASET_STATUS.READY);
}

export function canAccessInference(state) {
  if (!state) return false;
  if (!state.selectedTaskModel) return false;
  return state.training?.status === 'done' || state.selectedTaskModel.requiresTraining === false;
}
