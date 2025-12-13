import { registerClassComponents } from './class/classList.js';
import { registerConfirmDialog } from './common/confirmDialog.js';
import { registerEdgeComponents } from './edge/edgePanel.js';
import { registerDatasetComponents } from './dataset/datasetRecorder.js';
import { registerTrainingComponents } from './training/trainingPanel.js';
import { registerInferenceComponents } from './inference/predictionPanel.js';

export function registerAppComponents(Alpine) {
  registerClassComponents(Alpine);
  registerConfirmDialog(Alpine);
  registerEdgeComponents(Alpine);
  registerDatasetComponents(Alpine);
  registerTrainingComponents(Alpine);
  registerInferenceComponents(Alpine);
}
