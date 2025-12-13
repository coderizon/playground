let openHandler = null;

export function registerConfirmHandler(fn) {
  openHandler = fn;
}

export function openConfirmDialog(options) {
  if (typeof openHandler === 'function') {
    openHandler(options);
  }
}

export function registerConfirmDialog(Alpine) {
  Alpine.data('confirmDialog', () => ({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'OK',
    cancelLabel: 'Abbrechen',
    destructive: false,
    onConfirm: null,

    init() {
      registerConfirmHandler((options) => this.show(options));
    },

    show(options = {}) {
      this.title = options.title || 'Bestätigen';
      this.message = options.message || '';
      this.confirmLabel = options.confirmLabel || 'OK';
      this.cancelLabel = options.cancelLabel || 'Abbrechen';
      this.destructive = Boolean(options.destructive);
      this.onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
      this.open = true;
    },

    close() {
      this.open = false;
      this.onConfirm = null;
    },

    confirm() {
      this.onConfirm?.();
      this.close();
    },
  }));
}
