import { sessionStore, STEP } from '../../store/sessionStore.js';
import { getAvailableTaskModels } from '../../data/taskModels.js';
import { goHome } from '../../routes/navigationController.js';
import { discardSessionWithConfirm } from '../../routes/sessionController.js';

export function renderHomePage(root, state = sessionStore.getState()) {
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

      <p class="task-grid-instructions" id="taskGridHint">
        Nutze Tab, um Karten zu fokussieren, und bestätige mit Enter oder Leertaste. Verfügbarkeit und Aufwand werden vorgelesen.
      </p>
      <div class="task-grid" data-home-grid role="list" aria-describedby="taskGridHint"></div>

      <aside class="session-state" aria-live="polite">
        <h2>Session Status</h2>
        <p data-session-state>Keine Session gestartet.</p>
        <div class="session-controls">
          <button type="button" data-discard-session class="ghost" disabled>Session verwerfen</button>
          <button type="button" data-go-home class="secondary" disabled>Zu Home zurück</button>
        </div>
        <p class="session-shortcuts" role="note" aria-live="polite">
          Tastatur:
          <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> Session verwerfen</span>
          ·
          <span><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> Zurück nach Home</span>
        </p>
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
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    const titleId = `task-${task.id}-title`;
    const descId = `task-${task.id}-desc`;
    const metaId = `task-${task.id}-meta`;
    card.setAttribute('aria-labelledby', `${titleId}`);
    card.setAttribute('aria-describedby', `${descId} ${metaId}`);
    card.innerHTML = `
      <div class="task-card__meta" id="${metaId}">
        <span class="task-modality" aria-label="Modality ${task.inputModality}">${task.inputModality}</span>
        <span class="task-effort" aria-label="Aufwand ${task.effortLevel}">${task.effortLevel} effort</span>
      </div>
      <div class="task-card__body">
        <h3 id="${titleId}">${task.name}</h3>
        <p id="${descId}">${task.description}</p>
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
          ? `<div class="task-card__status" role="status" aria-live="polite">${getAvailabilityCopy(task.status)}</div>`
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
    discardSessionWithConfirm();
  });

  goHomeBtn.addEventListener('click', goHome);

  if (!state?.selectedTaskModel) {
    stateEl.textContent = 'Keine Session gestartet. Wähle eine Karte.';
    discardBtn.disabled = true;
    goHomeBtn.disabled = true;
  } else {
    const nextStepCopy = describeStep(state.step);
    stateEl.textContent = `Session aktiv für ${state.selectedTaskModel.name}. Nächster Schritt: ${nextStepCopy}.`;
    discardBtn.disabled = false;
    goHomeBtn.disabled = state.step === STEP.HOME;
  }
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
