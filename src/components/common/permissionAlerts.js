import { sessionStore } from '../../app/store/sessionStore.js';
import { getPermissionIssues } from '../../app/store/selectors.js';

export function registerPermissionAlerts(Alpine) {
  Alpine.data('permissionAlerts', () => ({
    issues: getPermissionIssues(sessionStore.getState()),
    unsubscribe: null,

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.issues = getPermissionIssues(state);
      });
    },

    destroy() {
      this.unsubscribe?.();
    },

    emptyMessage() {
      return 'Keine Berechtigungsprobleme';
    },
  }));
}
