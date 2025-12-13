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
  root.innerHTML = `
    <div class="new-app-coming-soon">
      <p>Playground refactor shell mounted.</p>
      <p>The session-driven UI will render here as slices ship.</p>
    </div>
  `;
}
