import { sessionStore, STEP } from '../store/sessionStore.js';
import {
  canGoToCollect,
  canAccessTraining,
  canAccessInference,
} from '../guards/navigation.js';

export function createNavigationController(store = sessionStore) {
  if (!store || typeof store.getState !== 'function' || typeof store.setStep !== 'function') {
    throw new Error('[navigationController] store with getState/setStep required');
  }

  const goHome = () => {
    store.setStep(STEP.HOME);
    return true;
  };

  const goCollect = () => {
    const state = store.getState();
    if (!canGoToCollect(state)) return false;
    if (state.step === STEP.COLLECT) return true;
    store.setStep(STEP.COLLECT);
    return true;
  };

  const goTrain = () => {
    const state = store.getState();
    if (!canAccessTraining(state)) return false;
    store.setStep(STEP.TRAIN);
    return true;
  };

  const goInfer = () => {
    const state = store.getState();
    if (!canAccessInference(state)) return false;
    store.setStep(STEP.INFER);
    return true;
  };

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
