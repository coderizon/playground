import { sessionStore, STEP } from '../store/sessionStore.js';
import { canGoToCollect, canAccessTraining, canAccessInference } from '../guards/navigation.js';

export function goHome() {
  sessionStore.setStep(STEP.HOME);
}

export function goCollect() {
  const state = sessionStore.getState();
  if (state.step === STEP.COLLECT || state.step === STEP.HOME) return;
  sessionStore.setStep(STEP.COLLECT);
}

export function goTrain() {
  const state = sessionStore.getState();
  if (!canAccessTraining(state)) return;
  sessionStore.setStep(STEP.TRAIN);
}

export function goInfer() {
  const state = sessionStore.getState();
  if (!canAccessInference(state)) return;
  sessionStore.setStep(STEP.INFER);
}
