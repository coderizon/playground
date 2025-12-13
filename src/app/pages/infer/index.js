import { renderInferencePage } from './view.js';

export function renderInferPage(root, state = sessionStore.getState()) {
  renderInferencePage(root, state);
}
