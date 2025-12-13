import { sessionStore, STEP } from './store/sessionStore.js';
import { renderHomePage } from './pages/home/index.js';
import { renderCollectPage } from './pages/collect/index.js';

const LEGACY_ROOT_IDS = ['landing-page', 'app-shell'];

function hideLegacyPrototypeShell() {
  LEGACY_ROOT_IDS.forEach((id) => {
    const node = document.getElementById(id);
    if (node) {
      node.setAttribute('aria-hidden', 'true');
      node.style.display = 'none';
    }
  });
}

export async function bootstrapNewApp({ targetSelector = '#new-app-root' } = {}) {
  hideLegacyPrototypeShell();
  const root = document.querySelector(targetSelector);
  if (!root) {
    console.error('[new-app] Missing root node', targetSelector);
    return;
  }

  root.removeAttribute('hidden');
  root.classList.add('new-app-root-active');
  const render = () => {
    const state = sessionStore.getState();
    switch (state.step) {
      case STEP.COLLECT:
        renderCollectPage(root, state);
        break;
      case STEP.TRAIN:
      case STEP.INFER:
        renderPlaceholder(root, state.step);
        break;
      default:
        renderHomePage(root, state);
    }
  };

  sessionStore.subscribe(render);
  render();
}

function renderPlaceholder(root, step) {
  const label = step === STEP.TRAIN ? 'Training' : 'Inference';
  root.innerHTML = `
    <section class="placeholder-page">
      <p class="eyebrow">Schritt in Arbeit</p>
      <h1>${label} ist noch nicht implementiert</h1>
      <p>Du kannst weiterhin Klassen anlegen und Daten sammeln. Der nächste Schritt folgt bald.</p>
      <button type="button" class="ghost" data-back-home>Zurück zur Auswahl</button>
    </section>
  `;
  root.querySelector('[data-back-home]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.HOME);
  });
}
