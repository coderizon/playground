import { sessionStore, STEP } from '../../store/sessionStore.js';
import { canAccessInference } from '../../guards/navigation.js';

export function renderInferPage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canAccessInference(state)) {
    renderBlocked(root);
    return;
  }

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
            <button type="button" class="primary" disabled>Inference starten</button>
            <button type="button" class="ghost" disabled>Stoppen</button>
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
