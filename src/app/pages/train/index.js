import { sessionStore, STEP } from '../../store/sessionStore.js';
import { canAccessTraining, canAccessInference } from '../../guards/navigation.js';
import { renderNoticeBanner } from '../../components/common/noticeBanner.js';

export function renderTrainPage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canAccessTraining(state)) {
    renderAccessDenied(root);
    return;
  }

  const trainingState = state.training;
  root.innerHTML = `
    <section class="train-page">
      <header class="train-header">
        <div>
          <p class="eyebrow">Schritt 3 · Training</p>
          <h1>Trainiere dein Modell</h1>
          <p class="subline">
            Überprüfe deine Klassen und starte das Training. Währenddessen bleiben Datensätze gesperrt.
          </p>
        </div>
        <div class="train-header__actions">
          <button type="button" class="ghost" data-back-collect>Zurück zu Klassen</button>
          <button type="button" class="secondary" data-go-infer ${canAccessInference(state) ? '' : 'disabled'}>Weiter zur Inferenz</button>
        </div>
      </header>

      <section class="train-body">
        <div id="trainNotice"></div>
        <article class="training-panel">
          <h2>Trainingsstatus</h2>
          <p>Status: <strong>${trainingState.status}</strong></p>
          <p>Fortschritt: ${trainingState.progress}%</p>
          <div class="training-actions">
            <button type="button" class="primary" data-start-training disabled>Training starten</button>
            <button type="button" class="ghost" data-abort-training disabled>Training abbrechen</button>
          </div>
        </article>
      </section>
    </section>
  `;

  renderNoticeBanner(document.getElementById('trainNotice'), {
    tone: 'warning',
    title: 'Training kommt bald',
    message: 'Dieser Schritt zeigt aktuell nur Platzhalter. Der Trainingsfluss wird als nächstes angebunden.',
  });

  root.querySelector('[data-back-collect]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.COLLECT);
  });
  root.querySelector('[data-go-infer]')?.addEventListener('click', () => {
    if (canAccessInference(sessionStore.getState())) {
      sessionStore.setStep(STEP.INFER);
    }
  });
}

function renderAccessDenied(root) {
  root.innerHTML = `
    <section class="train-page">
      <p class="eyebrow">Noch nicht bereit</p>
      <h1>Training erst nach vollständiger Datensammlung</h1>
      <p>Stelle sicher, dass mindestens zwei Klassen vorhanden sind und Datensätze bereit sind.</p>
      <button type="button" class="primary" data-go-collect>Zurück zu Collect</button>
    </section>
  `;
  root.querySelector('[data-go-collect]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.COLLECT);
  });
}
