import { sessionStore, STEP } from '../store/sessionStore.js';
import {
  canGoToCollect,
  canAccessTraining,
  canAccessInference,
} from '../guards/navigation.js';
import { confirmNavigationIfInferenceRunning } from './navigationGuards.js';

export function createNavigationController(store = sessionStore, options = {}) {
  if (!store || typeof store.getState !== 'function' || typeof store.setStep !== 'function') {
    throw new Error('[navigationController] store with getState/setStep required');
  }
  const confirmNavigation = options.confirmNavigation ?? confirmNavigationIfInferenceRunning;

  const guardedTransition = (check, step) => {
    const state = store.getState();
    if (check && !check(state)) return false;
    if (state.step === step) return true;
    if (!confirmNavigation()) return false;
    store.setStep(step);
    return true;
  };

  const goHome = () => guardedTransition(null, STEP.HOME);
  const goCollect = () => guardedTransition(canGoToCollect, STEP.COLLECT);
  const goTrain = () => guardedTransition(canAccessTraining, STEP.TRAIN);
  const goInfer = () => guardedTransition(canAccessInference, STEP.INFER);

  return {
    goHome,
    goCollect,
    goTrain,
    goInfer,
  };
}

const controller = createNavigationController();
export const goHome = () => controller.goHome();
export const goCollect = () => controller.goCollect();
export const goTrain = () => controller.goTrain();
export const goInfer = () => controller.goInfer();
