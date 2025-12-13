import { sessionStore, STEP, DATASET_STATUS } from '../../store/sessionStore.js';
import { canGoToCollect, canGoToTraining } from '../../guards/navigation.js';

export function renderCollectPage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canGoToCollect(state)) {
    renderUnavailable(root);
    return;
  }

  const classes = state.classes || [];
  const trainingHint = trainingGateHint(state);
  root.innerHTML = `
    <section class="collect-page">
      <header class="collect-header">
        <div>
          <p class="eyebrow">Schritt 2 · Classes & Data Collection</p>
          <h1>Definiere deine Klassen</h1>
          <p class="subline">
            Erstelle Klassen, sammle Beispiele und mache den Trainingsschritt bereit.
          </p>
        </div>
        <div class="collect-header__actions">
          <button type="button" class="ghost" data-back-home>Zurück zur Auswahl</button>
          <button type="button" class="secondary" data-go-train disabled>Weiter zu Training</button>
        </div>
      </header>
      <section class="collect-body" x-data="classList()" x-init="init()">
        <div class="collect-toolbar">
          <button type="button" class="primary" @click="addClass">Klasse hinzufügen</button>
          <span class="collect-count" x-text="classes.length + ' Klassen angelegt'"></span>
        </div>
        <div class="collect-class-list">
          <template x-if="classes.length === 0">
            <div class="collect-empty">
              <h3>Noch keine Klassen</h3>
              <p>Füge mindestens zwei Klassen hinzu, benenne sie und sammle Beispiele.</p>
            </div>
          </template>
          <template x-for="(classItem, index) in classes" :key="classItem.id">
            <article class="class-card-v2">
              <header>
                <input
                  type="text"
                  class="class-name-input"
                  :value="classItem.name"
                  maxlength="60"
                  aria-label="Klassenname eingeben"
                  @change="commitName(classItem.id, $event.target.value)"
                  @blur="commitName(classItem.id, $event.target.value)"
                />
                <span :class="datasetChipClass(classItem.dataset.status)">
                  <span x-text="datasetLabel(classItem.dataset.status)"></span>
                </span>
              </header>
              <p class="dataset-summary">
                <span x-text="classItem.dataset.recordedCount"></span>/<span x-text="classItem.dataset.expectedCount"></span>
                Beispiele
              </p>
              <p class="field-error" x-show="validationErrors[classItem.id]" x-text="validationErrors[classItem.id]"></p>
              <div class="class-card-actions">
                <button type="button" class="ghost" disabled>Recorder öffnen</button>
                <button type="button" class="ghost" @click="confirmDelete(classItem)">Entfernen</button>
              </div>
            </article>
          </template>
        </div>
        <p class="guard-hint">${trainingHint}</p>
      </section>
    </section>
  `;

  const backBtn = root.querySelector('[data-back-home]');
  const goTrainBtn = root.querySelector('[data-go-train]');
  if (backBtn) {
    backBtn.addEventListener('click', () => sessionStore.setStep(STEP.HOME));
  }
  if (goTrainBtn) {
    goTrainBtn.disabled = !canGoToTraining(state);
    goTrainBtn.addEventListener('click', () => {
      if (canGoToTraining(sessionStore.getState())) {
        sessionStore.setStep(STEP.TRAIN);
      }
    });
  }

}

function renderUnavailable(root) {
  root.innerHTML = `
    <section class="collect-page">
      <p class="eyebrow">Session erforderlich</p>
      <h1>Starte zuerst eine Session</h1>
      <p>Wähle ein Modell auf der Home-Seite, um Klassen zu definieren.</p>
      <button type="button" class="primary" data-go-home>Zurück zur Auswahl</button>
    </section>
  `;
  root.querySelector('[data-go-home]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.HOME);
  });
}

function trainingGateHint(state) {
  const classes = state.classes || [];
  if (classes.length < 2) {
    return 'Mindestens zwei Klassen sind erforderlich, bevor du weiter trainieren kannst.';
  }
  const incomplete = classes.some(
    (cls) => cls.dataset?.status !== DATASET_STATUS.READY
  );
  if (incomplete) {
    return 'Jede Klasse benötigt einen vollständigen Datensatz (Status „Bereit“).';
  }
  return '';
}
