import { registerClassComponents } from './class/classList.js';
import { registerConfirmDialog } from './common/confirmDialog.js';

export function registerAppComponents(Alpine) {
  registerClassComponents(Alpine);
  registerConfirmDialog(Alpine);
}
