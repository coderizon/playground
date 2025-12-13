import { sessionStore, STEP } from '../../store/sessionStore.js';
import { renderClassList } from '../../components/class/classList.js';
import { canGoToCollect, canGoToTraining } from '../../guards/navigation.js';

export function renderCollectPage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canGoToCollect(state)) {
    renderUnavailable(root);
    return;
  }

  const classes = state.classes || [];
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
      <section class="collect-body">
        <div class="collect-toolbar">
          <button type="button" class="primary" data-add-class>Klasse hinzufügen</button>
          <span class="collect-count">${classes.length} Klassen angelegt</span>
        </div>
        <div class="collect-class-list" data-class-list></div>
      </section>
    </section>
  `;

  const addBtn = root.querySelector('[data-add-class]');
  const backBtn = root.querySelector('[data-back-home]');
  const goTrainBtn = root.querySelector('[data-go-train]');
  const classListEl = root.querySelector('[data-class-list]');

  if (addBtn) {
    addBtn.addEventListener('click', () => sessionStore.addClass());
  }
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

  renderClassList(classListEl, classes);
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
