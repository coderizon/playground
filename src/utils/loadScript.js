const scriptPromises = new Map();

export function loadExternalScript(src) {
  if (!src) {
    return Promise.reject(new Error('[loadExternalScript] Missing script src'));
  }
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }

  if (scriptPromises.has(src)) {
    return scriptPromises.get(src);
  }

  const existing = document.querySelector(`script[data-external-script="${src}"]`);
  if (existing && (existing.dataset.loaded === 'true' || existing.getAttribute('data-loaded') === 'true')) {
    return Promise.resolve();
  }

  const promise = new Promise((resolve, reject) => {
    const script = existing || document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-external-script', src);
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = (event) => {
      const message = `[loadExternalScript] Failed to load ${src}`;
      reject(new Error(message));
    };
    if (!existing) {
      document.head.appendChild(script);
    }
  });

  scriptPromises.set(src, promise);
  return promise;
}
