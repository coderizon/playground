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
        ${trainingHint ? `<div class="notice notice--info">${trainingHint}</div>` : ''}
        <div class="collect-toolbar">
          <button type="button" class="primary" @click="addClass" :disabled="trainingLocked">Klasse hinzufügen</button>
          <span class="collect-count" x-text="classes.length + ' Klassen angelegt'"></span>
        </div>
        <p class="collect-lock-hint" x-show="trainingLocked">
          Training läuft – Daten- und Klassenänderungen sind vorübergehend gesperrt.
        </p>
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
              <section class="dataset-recorder" x-data="datasetRecorder(classItem.id)" x-init="init()">
                <div class="dataset-preview">
                  <template x-if="recording">
                    <video autoplay muted playsinline :x-ref="'preview-'+classItem.id" class="preview-video"></video>
                  </template>
                  <template x-if="!recording">
                    <div class="preview-placeholder" x-text="previewLabel()"></div>
                  </template>
                </div>
                <p class="field-error" x-show="error" x-text="error"></p>
                <div class="class-card-actions">
                  <button type="button" class="ghost" @click="startRecording()" :disabled="!canStart">Aufnahme starten</button>
                  <button type="button" class="ghost" @click="stopRecording()" :disabled="!canStop">Stoppen</button>
                  <button type="button" class="ghost" @click="discardDataset()" :disabled="!canDiscard">Datensatz verwerfen</button>
                </div>
                <p class="dataset-hint" x-text="statusHint()"></p>
              </section>
              <div class="class-card-actions">
                <button type="button" class="ghost" @click="confirmDelete(classItem)" :disabled="trainingLocked">Klasse entfernen</button>
              </div>
            </article>
          </template>
        </div>
      </section>
    </section>
    <div x-data="confirmDialog()" x-show="open" class="confirm-backdrop" x-cloak @click.self="close()">
      <div class="confirm-dialog" :class="{'is-destructive': destructive}">
        <h3 x-text="title"></h3>
        <p x-text="message"></p>
        <div class="confirm-actions">
          <button type="button" class="ghost" @click="close()" x-text="cancelLabel"></button>
          <button type="button" class="primary" :class="{'danger': destructive}" @click="confirm()" x-text="confirmLabel"></button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-back-home]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.HOME);
  });
  const goTrainBtn = root.querySelector('[data-go-train]');
  const updateTrainButton = () => {
    const nextState = sessionStore.getState();
    goTrainBtn.disabled = !canGoToTraining(nextState);
  };
  if (goTrainBtn) {
    goTrainBtn.disabled = !canGoToTraining(state);
    goTrainBtn.addEventListener('click', () => {
      if (canGoToTraining(sessionStore.getState())) {
        sessionStore.setStep(STEP.TRAIN);
      }
    });
    const unsubscribe = sessionStore.subscribe(updateTrainButton);
    root.addEventListener(
      'DOMNodeRemoved',
      () => {
        unsubscribe?.();
      },
      { once: true }
    );
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
