import { startRouter } from './routes/router.js';
import { sessionStore } from './store/sessionStore.js';
import { ensureAlpineStarted } from './setupAlpine.js';
import { registerAppComponents } from '../components/registerComponents.js';

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
  ensureAlpineStarted([registerAppComponents]);
  startRouter(root);
}
