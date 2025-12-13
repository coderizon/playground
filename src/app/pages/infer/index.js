import { sessionStore, STEP } from '../../store/sessionStore.js';
import { canAccessInference } from '../../guards/navigation.js';
import { getInferencePredictions, isInferenceRunning } from '../../store/selectors.js';
import { startMockInference, stopMockInference } from '../../services/ml/mockInference.js';

export function renderInferPage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canAccessInference(state)) {
    renderBlocked(root);
    return;
  }

  const predictions = getInferencePredictions(state);
  const running = isInferenceRunning(state);
  root.innerHTML = `
    <section class="infer-page">
      <header class="infer-header">
        <div>
          <p class="eyebrow">Schritt 4 · Inference</p>
          <h1>Teste dein Modell</h1>
          <p class="subline">Starte die Vorschau, beobachte Wahrscheinlichkeiten und verbinde ein Edge-Gerät.</p>
        </div>
        <div class="infer-header__actions">
          <button type="button" class="ghost" data-back-train>Zurück zu Training</button>
          <button type="button" class="secondary" data-discard-session>Session verwerfen</button>
        </div>
      </header>
      <section class="infer-body">
        <article class="inference-panel">
          <h2>Inference</h2>
          <p>Status: ${state.inference.status}</p>
          <div class="inference-actions">
            <button type="button" class="primary" data-start-infer ${running ? 'disabled' : ''}>Inference starten</button>
            <button type="button" class="ghost" data-stop-infer ${running ? '' : 'disabled'}>Stoppen</button>
          </div>
          <div class="prediction-output">
            <h3>Vorhersage</h3>
            <ul>
              ${predictions
                .map(
                  (row) => `
                <li class="${row.isBest && running ? 'is-active' : ''}">
                  <span>${row.name}</span>
                  <strong>${Math.round(row.value * 100)}%</strong>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>
          <div class="edge-panel">
            <p>Edge-Verbindung</p>
            <button type="button" class="ghost" disabled>Edge verbinden</button>
          </div>
        </article>
      </section>
    </section>
  `;

  root.querySelector('[data-back-train]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.TRAIN);
  });
  root.querySelector('[data-discard-session]')?.addEventListener('click', () => {
    sessionStore.discardSession();
  });
  root.querySelector('[data-start-infer]')?.addEventListener('click', () => {
    startMockInference();
  });
  root.querySelector('[data-stop-infer]')?.addEventListener('click', () => {
    stopMockInference();
  });
}

function renderBlocked(root) {
  root.innerHTML = `
    <section class="infer-page">
      <p class="eyebrow">Noch nicht bereit</p>
      <h1>Inference benötigt ein abgeschlossenes Training</h1>
      <p>Trainiere zuerst dein Modell, um die Vorschau zu aktivieren.</p>
      <button type="button" class="primary" data-go-train>Zurück zu Training</button>
    </section>
  `;
  root.querySelector('[data-go-train]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.TRAIN);
  });
}
