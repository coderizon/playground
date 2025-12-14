import { sessionStore } from '../../app/store/sessionStore.js';
import { canAccessTraining, canAccessInference } from '../../app/guards/navigation.js';
import { goCollect, goInfer } from '../../app/routes/navigationController.js';

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

      <section class="train-body" x-data="trainingPanel()" x-init="init()" @keydown.window="handleHotkey($event)">
        <article class="training-panel">
          <h2>Trainingsstatus</h2>
          <p role="status" aria-live="polite" aria-atomic="true">Status: <strong x-text="statusLabel"></strong></p>
          <p class="training-hint" x-text="lockHint" role="status" aria-live="polite" aria-atomic="true"></p>
          <div class="training-progress">
            <div class="training-progress-bar">
              <div class="training-progress-fill" :style="{'width': (training.progress || 0) + '%'}"></div>
            </div>
            <span x-text="(training.progress || 0) + '%'"></span>
          </div>
          <div class="training-actions">
            <button type="button" class="primary" @click="startTraining" :disabled="!canStart" x-text="startCtaLabel"></button>
            <button type="button" class="ghost" @click="abortTraining" :disabled="!canAbort">Training abbrechen</button>
          </div>
          <div class="training-hotkeys" aria-hidden="true">
            <span><kbd>T</kbd> Start</span>
            <span><kbd>A</kbd>/<kbd>Esc</kbd> Abbrechen</span>
          </div>
          <p class="training-hint" x-show="startCtaSubline" x-text="startCtaSubline"></p>
          <div class="training-meta">
            <p class="eyebrow">Trainingshistorie</p>
            <p x-text="lastRunLabel || 'Noch kein Training durchgeführt.'" role="status" aria-live="polite" aria-atomic="true"></p>
            <p class="training-hint" x-show="datasetChangeLabel" x-text="datasetChangeLabel" role="status" aria-live="polite" aria-atomic="true"></p>
          </div>
          <template x-if="staleClasses.length">
            <div class="training-meta">
              <p class="eyebrow">Seit letztem Training aktualisiert</p>
              <ul>
                <template x-for="cls in staleClasses" :key="cls.id">
                  <li>
                    <strong x-text="cls.name"></strong>
                    <span class="hint" x-text="formatTimestamp(cls.updatedAt)"></span>
                  </li>
                </template>
              </ul>
            </div>
          </template>
        </article>
        <aside class="training-summary" x-data="trainingSummaryPanel()" x-init="init()">
          <h3>Datensatz-Übersicht</h3>
          <p>
            <strong x-text="summary.readyClasses + '/' + summary.totalClasses"></strong>
            Klassen bereit
          </p>
          <p>
            <strong x-text="summary.totalSamples"></strong>
            Samples insgesamt
          </p>
          <template x-if="issues.length">
            <div class="training-issues">
              <p class="eyebrow">Offene Aufgaben</p>
              <ul>
                <template x-for="issue in issues" :key="issue.id">
                  <li>
                    <strong x-text="issue.name"></strong>
                    <span x-text="issue.reason"></span>
                  </li>
                </template>
              </ul>
            </div>
          </template>
          <template x-if="backgroundIssues.length">
            <div class="training-issues training-issues--background">
              <p class="eyebrow">Audio-Check</p>
              <ul>
                <template x-for="issue in backgroundIssues" :key="issue.id">
                  <li>
                    <strong x-text="issue.name"></strong>
                    <span x-text="issue.reason"></span>
                  </li>
                </template>
              </ul>
            </div>
          </template>
        </aside>
      </section>
    </section>
  `;

  root.querySelector('[data-back-collect]')?.addEventListener('click', () => {
    goCollect();
  });
  const goInferBtn = root.querySelector('[data-go-infer]');
  const updateInferButton = () => {
    goInferBtn.disabled = !canAccessInference(sessionStore.getState());
  };
  if (goInferBtn) {
    goInferBtn.addEventListener('click', () => {
      if (canAccessInference(sessionStore.getState())) {
        goInfer();
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
    goCollect();
  });
}

function trainingSummaryMessage(summary, ready) {
  const base = `${summary.readyClasses}/${summary.totalClasses} Klassen bereit · ${summary.totalSamples} Samples`;
  if (ready) {
    return `${base}. Du kannst das Training starten.`;
  }
  return `${base}. Stelle sicher, dass alle Klassen Datensätze im Status „Bereit“ haben.`;
}
