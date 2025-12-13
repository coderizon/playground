const TOAST_DURATION_MS = 5000;

let listeners = new Set();
let counter = 0;

export function registerToastComponent(Alpine) {
  Alpine.data('toastCenter', () => ({
    toasts: [],
    listenerRef: null,
    init() {
      this.listenerRef = (toast) => this.pushToast(toast);
      listeners.add(this.listenerRef);
    },
    destroy() {
      if (this.listenerRef) {
        listeners.delete(this.listenerRef);
      }
    },
    pushToast(toast) {
      this.toasts = [...this.toasts, toast];
      window.setTimeout(() => this.dismissToast(toast.id), toast.duration || TOAST_DURATION_MS);
    },
    dismissToast(id) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
    },
  }));
}

export function showToast({ title, message, tone = 'info', duration = TOAST_DURATION_MS }) {
  const toast = {
    id: `toast_${++counter}`,
    title,
    message,
    tone,
    duration,
  };
  listeners.forEach((listener) => listener(toast));
}
