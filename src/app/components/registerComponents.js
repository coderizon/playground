import { registerClassComponents } from './class/classList.js';
import { registerCollectSummary } from './class/collectSummary.js';
import { registerCollectToolbar } from './class/collectToolbar.js';
import { registerClassCard } from './class/classCard.js';
import { registerCollectEmptyState } from './class/collectEmpty.js';
import { registerConfirmDialog } from './common/confirmDialog.js';
import { registerEdgeModal } from './edge/edgeModal.js';
import { registerDatasetComponents } from './dataset/datasetRecorder.js';
import { registerTrainingComponents } from './training/trainingPanel.js';
import { registerInferenceComponents } from './inference/predictionPanel.js';
import { registerInferenceControls } from './inference/inferenceControls.js';
import { registerToastComponent } from './common/toast.js';
import { registerPermissionAlerts } from './common/permissionAlerts.js';

export function registerAppComponents(Alpine) {
  registerClassComponents(Alpine);
  registerCollectSummary(Alpine);
  registerCollectToolbar(Alpine);
  registerClassCard(Alpine);
  registerCollectEmptyState(Alpine);
  registerConfirmDialog(Alpine);
  registerEdgeModal(Alpine);
  registerDatasetComponents(Alpine);
  registerTrainingComponents(Alpine);
  registerInferenceComponents(Alpine);
  registerInferenceControls(Alpine);
  registerToastComponent(Alpine);
  registerPermissionAlerts(Alpine);
}
