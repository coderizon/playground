import { sessionStore, STEP } from '../store/sessionStore.js';
import { renderHomePage } from '../pages/home/index.js';
import { renderCollectPage } from '../pages/collect/index.js';
import { renderTrainPage } from '../pages/train/index.js';
import { renderInferPage } from '../pages/infer/index.js';

const routeHandlers = {
  [STEP.HOME]: renderHomePage,
  [STEP.COLLECT]: renderCollectPage,
  [STEP.TRAIN]: renderTrainPage,
  [STEP.INFER]: renderInferPage,
};

export function startRouter(root) {
  if (!root) {
    throw new Error('[router] Missing root node');
  }

  const render = () => {
    const state = sessionStore.getState();
    const handler = routeHandlers[state.step] || renderFallback;
    handler(root, state);
    if (window.Alpine && typeof window.Alpine.initTree === 'function') {
      window.Alpine.initTree(root);
    }
  };

  sessionStore.subscribe(render);
  render();
}

function renderFallback(root) {
  root.innerHTML = `
    <section class="placeholder-page">
      <p class="eyebrow">Unbekannter Schritt</p>
      <h1>Dieser Abschnitt ist noch nicht implementiert</h1>
      <button type="button" class="ghost" data-back-home>Zurück zur Auswahl</button>
    </section>
  `;
  root.querySelector('[data-back-home]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.HOME);
  });
}
