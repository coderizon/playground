import { sessionStore, STEP, TRAINING_STATUS } from '../../store/sessionStore.js';
import { canAccessTraining, canAccessInference } from '../../guards/navigation.js';
import { renderNoticeBanner } from '../../components/common/noticeBanner.js';
import { isTrainingReady, getTrainingSummary } from '../../store/selectors.js';
import { startMockTraining, abortMockTraining } from '../../services/ml/mockTraining.js';

export function renderTrainPage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canAccessTraining(state)) {
    renderAccessDenied(root);
    return;
  }

  const trainingState = state.training;
  const summary = getTrainingSummary(state);
  const readyForTraining = isTrainingReady(state);
  const isRunning = trainingState.status === TRAINING_STATUS.RUNNING;
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
          <div class="training-progress">
            <div class="training-progress-bar">
              <div class="training-progress-fill" style="width: ${trainingState.progress}%"></div>
            </div>
            <span>${trainingState.progress}%</span>
          </div>
          <div class="training-actions">
            <button type="button" class="primary" data-start-training ${
              readyForTraining && !isRunning ? '' : 'disabled'
            }>Training starten</button>
            <button type="button" class="ghost" data-abort-training ${
              isRunning ? '' : 'disabled'
            }>Training abbrechen</button>
          </div>
        </article>
      </section>
    </section>
  `;

  renderNoticeBanner(document.getElementById('trainNotice'), {
    tone: readyForTraining ? 'info' : 'warning',
    title: 'Trainingsbereitschaft',
    message: trainingSummaryMessage(summary, readyForTraining),
  });

  root.querySelector('[data-back-collect]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.COLLECT);
  });
  root.querySelector('[data-go-infer]')?.addEventListener('click', () => {
    if (canAccessInference(sessionStore.getState())) {
      sessionStore.setStep(STEP.INFER);
    }
  });
  const startBtn = root.querySelector('[data-start-training]');
  startBtn?.addEventListener('click', () => {
    startMockTraining();
  });
  const abortBtn = root.querySelector('[data-abort-training]');
  abortBtn?.addEventListener('click', () => {
    abortMockTraining();
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

function trainingSummaryMessage(summary, ready) {
  const base = `${summary.readyClasses}/${summary.totalClasses} Klassen bereit · ${summary.totalSamples} Samples`;
  if (ready) {
    return `${base}. Du kannst das Training starten.`;
  }
  return `${base}. Stelle sicher, dass alle Klassen Datensätze im Status „Bereit“ haben.`;
}
