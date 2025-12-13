import { sessionStore, STEP } from '../store/sessionStore.js';
import { getAvailableTaskModels } from '../data/taskModels.js';

export function renderHomePage(root) {
  if (!root) return;

  root.innerHTML = `
    <section class="new-app-home">
      <header class="new-app-home__header">
        <p class="eyebrow">Playground Journey</p>
        <h1>Wähle deine Aufgabe</h1>
        <p class="subline">
          Jede Karte startet eine frische Session entsprechend der autorisierten Journey
          (Home → Collect → Train → Infer).
        </p>
      </header>

      <div class="task-grid" data-home-grid></div>

      <aside class="session-state" aria-live="polite">
        <h2>Session Status</h2>
        <p data-session-state>Keine Session gestartet.</p>
        <div class="session-controls">
          <button type="button" data-discard-session class="ghost" disabled>Session verwerfen</button>
          <button type="button" data-go-home class="secondary" disabled>Zu Home zurück</button>
        </div>
      </aside>
    </section>
  `;

  const grid = root.querySelector('[data-home-grid]');
  const stateEl = root.querySelector('[data-session-state]');
  const discardBtn = root.querySelector('[data-discard-session]');
  const goHomeBtn = root.querySelector('[data-go-home]');
  if (!grid || !stateEl || !discardBtn || !goHomeBtn) return;

  getAvailableTaskModels().forEach((task) => {
    const disabled = task.status !== 'available';
    const card = document.createElement('button');
    card.className = `task-card task-card--${task.status}`;
    card.type = 'button';
    card.setAttribute('data-task-id', task.id);
    card.disabled = disabled;
    card.innerHTML = `
      <div class="task-card__meta">
        <span class="task-modality">${task.inputModality}</span>
        <span class="task-effort">${task.effortLevel} effort</span>
      </div>
      <div class="task-card__body">
        <h3>${task.name}</h3>
        <p>${task.description}</p>
      </div>
      <dl class="task-summary">
        <div>
          <dt>Training</dt>
          <dd>${task.requiresTraining ? 'Erforderlich' : 'Nicht nötig'}</dd>
        </div>
        <div>
          <dt>Interaktion</dt>
          <dd>${task.interactionType}</dd>
        </div>
        <div>
          <dt>BLE</dt>
          <dd>${task.bleCapable ? 'Ja' : 'Optional'}</dd>
        </div>
      </dl>
      <div class="task-card__tags">
        ${task.badges.map((tag) => `<span class="task-tag">${tag}</span>`).join('')}
      </div>
      ${
        disabled
          ? `<div class="task-card__status"> ${getAvailabilityCopy(task.status)} </div>`
          : ''
      }
    `;
    card.addEventListener('click', () => {
      if (disabled) return;
      sessionStore.startSession(task);
    });
    grid.appendChild(card);
  });

  discardBtn.addEventListener('click', () => {
    if (!sessionStore.getState().selectedTaskModel) return;
    const confirmDiscard = window.confirm(
      'Aktuelle Session verwerfen? Alle nicht gespeicherten Daten gehen verloren.'
    );
    if (confirmDiscard) {
      sessionStore.discardSession();
    }
  });

  goHomeBtn.addEventListener('click', () => {
    sessionStore.setStep(STEP.HOME);
  });

  const renderState = () => {
    const state = sessionStore.getState();
    const hasSession = Boolean(state.selectedTaskModel);
    if (!state.selectedTaskModel) {
      stateEl.textContent = 'Keine Session gestartet. Wähle eine Karte.';
      discardBtn.disabled = true;
      goHomeBtn.disabled = true;
      return;
    }
    const nextStepCopy = describeStep(state.step);
    stateEl.textContent = `Session aktiv für ${state.selectedTaskModel.name}. Nächster Schritt: ${nextStepCopy}.`;
    discardBtn.disabled = false;
    goHomeBtn.disabled = state.step === STEP.HOME;
  };

  sessionStore.subscribe(renderState);
  renderState();
}

function describeStep(step) {
  switch (step) {
    case STEP.COLLECT:
      return 'Classes & Data Collection';
    case STEP.TRAIN:
      return 'Training';
    case STEP.INFER:
      return 'Inference';
    default:
      return 'Home';
  }
}

function getAvailabilityCopy(status) {
  switch (status) {
    case 'coming-soon':
      return 'Demnächst verfügbar';
    case 'planned':
      return 'Geplant';
    default:
      return '';
  }
}
