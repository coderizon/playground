import { registerClassComponents } from './class/classList.js';
import { registerCollectSummary } from './class/collectSummary.js';
import { registerConfirmDialog } from './common/confirmDialog.js';
import { registerEdgeModal } from './edge/edgeModal.js';
import { registerDatasetComponents } from './dataset/datasetRecorder.js';
import { registerTrainingComponents } from './training/trainingPanel.js';
import { registerInferenceComponents } from './inference/predictionPanel.js';
import { registerInferenceControls } from './inference/inferenceControls.js';
import { registerToastComponent } from './common/toast.js';

export function registerAppComponents(Alpine) {
  registerClassComponents(Alpine);
  registerCollectSummary(Alpine);
  registerConfirmDialog(Alpine);
  registerEdgeModal(Alpine);
  registerDatasetComponents(Alpine);
  registerTrainingComponents(Alpine);
  registerInferenceComponents(Alpine);
  registerInferenceControls(Alpine);
  registerToastComponent(Alpine);
}
