import { registerClassComponents } from './class/classList.js';
import { registerConfirmDialog } from './common/confirmDialog.js';
import { registerEdgeComponents } from './edge/edgePanel.js';
import { registerDatasetComponents } from './dataset/datasetRecorder.js';

export function registerAppComponents(Alpine) {
  registerClassComponents(Alpine);
  registerConfirmDialog(Alpine);
  registerEdgeComponents(Alpine);
  registerDatasetComponents(Alpine);
}
