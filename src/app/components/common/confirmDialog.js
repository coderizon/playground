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
    previouslyFocused: null,

    init() {
      registerConfirmHandler((options) => this.show(options));
    },

    show(options = {}) {
      this.previouslyFocused = document.activeElement;
      this.title = options.title || 'Bestätigen';
      this.message = options.message || '';
      this.confirmLabel = options.confirmLabel || 'OK';
      this.cancelLabel = options.cancelLabel || 'Abbrechen';
      this.destructive = Boolean(options.destructive);
      this.onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
      this.open = true;
      this.$nextTick(() => this.focusPrimary());
    },

    close() {
      this.open = false;
      this.onConfirm = null;
      this.restoreFocus();
    },

    confirm() {
      this.onConfirm?.();
      this.close();
    },

    handleKeydown(event) {
      if (event.key !== 'Tab') return;
      const focusables = this.focusableElements();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },

    focusableElements() {
      const dialog = this.$refs.dialog;
      if (!dialog) return [];
      return Array.from(dialog.querySelectorAll('[data-dialog-focusable]')).filter(
        (el) => !el.disabled && !el.getAttribute('aria-disabled')
      );
    },

    focusPrimary() {
      const focusables = this.focusableElements();
      if (focusables.length) {
        focusables[focusables.length - 1]?.focus({ preventScroll: true });
      }
    },

    restoreFocus() {
      if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
        this.previouslyFocused.focus({ preventScroll: true });
      }
      this.previouslyFocused = null;
    },
  }));
}
