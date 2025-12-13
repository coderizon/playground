import { sessionStore, STEP } from '../../store/sessionStore.js';
import { canAccessTraining, canAccessInference } from '../../guards/navigation.js';

export function renderTrainPage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canAccessTraining(state)) {
    renderAccessDenied(root);
    return;
  }

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

      <section class="train-body" x-data="trainingPanel()" x-init="init()">
        <article class="training-panel">
          <h2>Trainingsstatus</h2>
          <p>Status: <strong x-text="statusLabel"></strong></p>
          <p class="training-hint" x-text="lockHint"></p>
          <div class="training-progress">
            <div class="training-progress-bar">
              <div class="training-progress-fill" :style="{'width': (training.progress || 0) + '%'}"></div>
            </div>
            <span x-text="(training.progress || 0) + '%'"></span>
          </div>
          <div class="training-actions">
            <button type="button" class="primary" @click="startTraining" :disabled="!canStart">Training starten</button>
            <button type="button" class="ghost" @click="abortTraining" :disabled="!canAbort">Training abbrechen</button>
          </div>
        </article>
        <aside class="training-summary">
          <h3>Datensatz-Übersicht</h3>
          <p>
            <strong x-text="summary.readyClasses + '/' + summary.totalClasses"></strong>
            Klassen bereit
          </p>
          <p>
            <strong x-text="summary.totalSamples"></strong>
            Samples insgesamt
          </p>
        </aside>
      </section>
    </section>
  `;

  root.querySelector('[data-back-collect]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.COLLECT);
  });
  const goInferBtn = root.querySelector('[data-go-infer]');
  const updateInferButton = () => {
    goInferBtn.disabled = !canAccessInference(sessionStore.getState());
  };
  if (goInferBtn) {
    goInferBtn.addEventListener('click', () => {
      if (canAccessInference(sessionStore.getState())) {
        sessionStore.setStep(STEP.INFER);
      }
    });
    const unsubscribe = sessionStore.subscribe(updateInferButton);
    root.addEventListener(
      'DOMNodeRemoved',
      () => {
        unsubscribe?.();
      },
      { once: true }
    );
  }
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
