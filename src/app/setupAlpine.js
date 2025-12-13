import Alpine from 'alpinejs';

let alpineStarted = false;

export function ensureAlpineStarted(registerCallbacks = []) {
  if (alpineStarted) return;
  if (!window.Alpine) {
    window.Alpine = Alpine;
  }

  registerCallbacks.forEach((cb) => {
    if (typeof cb === 'function') {
      cb(Alpine);
    }
  });

  Alpine.start();
  alpineStarted = true;
}
