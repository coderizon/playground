import { sessionStore, STEP } from '../store/sessionStore.js';
import { createNavigationController } from './navigationController.js';

const STEP_HASH = {
  [STEP.HOME]: '',
  [STEP.COLLECT]: '#collect',
  [STEP.TRAIN]: '#train',
  [STEP.INFER]: '#infer',
};

export function initHistorySync(options = {}) {
  if (typeof window === 'undefined' && !options.history) {
    return () => {};
  }
  const store = options.store ?? sessionStore;
  const history = options.history ?? window.history;
  const location = options.location ?? window.location;
  const events = options.events ?? window;
  if (!history || !history.replaceState || !history.pushState || !location) {
    return () => {};
  }

  const controller = options.controller ?? createNavigationController(store);
  let suppressNextPush = false;
  let lastStep = store.getState().step;

  const handlerMap = {
    [STEP.HOME]: controller.goHome,
    [STEP.COLLECT]: controller.goCollect,
    [STEP.TRAIN]: controller.goTrain,
    [STEP.INFER]: controller.goInfer,
  };

  const targetUrl = (step) => {
    const base = `${location.pathname}${location.search}`;
    const hash = STEP_HASH[step] ?? '';
    return `${base}${hash}`;
  };

  const parseHashStep = () => {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return STEP.HOME;
    const value = raw.toLowerCase();
    const valid = Object.values(STEP).find((step) => step === value);
    return valid || STEP.HOME;
  };

  const goToStep = (step) => {
    const handler = handlerMap[step];
    if (!handler) return false;
    suppressNextPush = true;
    const success = handler();
    if (!success) {
      suppressNextPush = false;
    }
    return success;
  };

  const initialHashStep = options.initialStep ?? parseHashStep();
  if (initialHashStep && initialHashStep !== store.getState().step) {
    goToStep(initialHashStep);
  }

  history.replaceState({ step: store.getState().step }, '', targetUrl(store.getState().step));
  lastStep = store.getState().step;

  const unsubscribe = store.subscribe((state) => {
    if (state.step === lastStep) return;
    lastStep = state.step;
    if (suppressNextPush) {
      suppressNextPush = false;
      history.replaceState({ step: state.step }, '', targetUrl(state.step));
      return;
    }
    history.pushState({ step: state.step }, '', targetUrl(state.step));
  });

  const onPopState = (event) => {
    const desiredStep = event.state?.step || parseHashStep();
    const current = store.getState().step;
    if (!desiredStep || desiredStep === current) return;
    const success = goToStep(desiredStep);
    if (!success) {
      history.pushState({ step: current }, '', targetUrl(current));
    }
  };

  events?.addEventListener?.('popstate', onPopState);

  return () => {
    unsubscribe?.();
    events?.removeEventListener?.('popstate', onPopState);
  };
}
