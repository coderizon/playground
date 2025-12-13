import { STEP } from '../store/sessionStore.js';
import { canGoToCollect, canAccessTraining, canAccessInference } from '../guards/navigation.js';

export function getAllowedSteps(state) {
  if (!state?.selectedTaskModel) {
    return [STEP.HOME];
  }
  const allowed = [STEP.HOME, STEP.COLLECT];
  if (canGoToCollect(state)) {
    allowed.push(STEP.COLLECT);
  }
  if (canAccessTraining(state)) {
    allowed.push(STEP.TRAIN);
  }
  if (canAccessInference(state)) {
    allowed.push(STEP.INFER);
  }
  return Array.from(new Set(allowed));
}
