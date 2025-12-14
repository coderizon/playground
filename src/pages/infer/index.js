import { sessionStore } from '../../app/store/sessionStore.js';
import { renderInferencePage } from './view.js';

export function renderInferPage(root, state = sessionStore.getState()) {
  renderInferencePage(root, state);
}
