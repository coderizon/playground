import { sessionStore, STEP } from '../store/sessionStore.js';
import { renderHomePage } from '../../pages/home/index.js';
import { renderCollectPage } from '../../pages/collect/index.js';
import { renderTrainPage } from '../../pages/train/index.js';
import { renderInferPage } from '../../pages/infer/index.js';
import { goHome } from './navigationController.js';
import { initHistorySync } from './historySync.js';
import { registerNavigationGuards } from './navigationGuards.js';
import { registerKeyboardShortcuts } from './keyboardShortcuts.js';

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

  ensureToastHost();
  ensureConfirmDialogHost();
  registerNavigationGuards();
  registerKeyboardShortcuts();
  initHistorySync();

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
  root.querySelector('[data-back-home]')?.addEventListener('click', goHome);
}

function ensureToastHost() {
  if (document.getElementById('toast-root')) return;
  const toastRoot = document.createElement('div');
  toastRoot.id = 'toast-root';
  toastRoot.className = 'toast-root' ;
  toastRoot.innerHTML = `
    <div class="toast-center" x-data="toastCenter()" x-init="init()">
      <template x-for="toast in toasts" :key="toast.id">
        <div class="toast" :class="'toast--' + toast.tone">
          <strong x-text="toast.title"></strong>
          <p x-text="toast.message"></p>
          <button type="button" class="toast-close" @click="dismissToast(toast.id)">×</button>
        </div>
      </template>
    </div>
  `;
  document.body.appendChild(toastRoot);
  if (window.Alpine && typeof window.Alpine.initTree === 'function') {
    window.Alpine.initTree(toastRoot);
  }
}

function ensureConfirmDialogHost() {
  if (document.getElementById('confirm-dialog-root')) return;
  const confirmRoot = document.createElement('div');
  confirmRoot.id = 'confirm-dialog-root';
  confirmRoot.innerHTML = `
    <div
      x-data="confirmDialog()"
      x-show="open"
      class="confirm-backdrop"
      x-cloak
      @click.self="close()"
      @keydown.window="handleKeydown($event)"
      @keydown.escape.prevent.stop="open && close()"
    >
      <div
        class="confirm-dialog"
        :class="{'is-destructive': destructive}"
        tabindex="-1"
        x-ref="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmDialogTitle"
        aria-describedby="confirmDialogMessage"
      >
        <h3 id="confirmDialogTitle" x-text="title"></h3>
        <p id="confirmDialogMessage" x-text="message"></p>
        <div class="confirm-actions">
          <button
            type="button"
            class="ghost"
            @click="close()"
            x-text="cancelLabel"
            data-dialog-focusable
          ></button>
          <button
            type="button"
            class="primary"
            :class="{'danger': destructive}"
            @click="confirm()"
            x-text="confirmLabel"
            data-dialog-focusable
          ></button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(confirmRoot);
  if (window.Alpine && typeof window.Alpine.initTree === 'function') {
    window.Alpine.initTree(confirmRoot);
  }
}
