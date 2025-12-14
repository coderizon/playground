import { registerEdgeComponents } from './edgePanel.js';

export function registerEdgeModal(Alpine) {
  Alpine.data('edgeModal', () => ({
    open: false,

    init() {
      window.addEventListener('keydown', this.handleKeydown.bind(this));
    },

    destroy() {
      window.removeEventListener('keydown', this.handleKeydown.bind(this));
    },

    handleKeydown(event) {
      if (event.key === 'Escape' && this.open) {
        this.close();
      }
    },

    toggle() {
      this.open = !this.open;
    },

    close() {
      this.open = false;
    },
  }));

  registerEdgeComponents(Alpine);
}
