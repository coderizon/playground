import { sessionStore, STEP } from '../../store/sessionStore.js';
import { getAvailableTaskModels } from '../../data/taskModels.js';
import { goHome } from '../../routes/navigationController.js';
import { discardSessionWithConfirm } from '../../routes/sessionController.js';

const JOURNEY_STEPS = [
  {
    step: 'Home',
    title: 'Task wählen',
    description: 'Jede Karte startet eine neue Session mit den passenden Modalitäten und Guardrails.',
  },
  {
    step: 'Collect',
    title: 'Klassen definieren',
    description: 'Klassen benennen, Samples aufnehmen, Hintergrund-Abdeckung sicherstellen.',
  },
  {
    step: 'Train',
    title: 'Modell aktualisieren',
    description: 'TF.js Trainingslauf starten, Sperren respektieren und Abbruch bestätigen.',
  },
  {
    step: 'Infer',
    title: 'Live testen & streamen',
    description: 'Inference nur nach Training starten, Edge-Streaming bewusst aktivieren.',
  },
];

const SESSION_RULES = [
  'Sessions sind flüchtig – Reload oder Verwerfen löscht alle Daten.',
  'Destruktive Aktionen laufen über die Controller + Dialoge, nie direkt über Stores.',
  'Inference & Edge-Streaming stoppen bevor Navigation oder Disconnect passiert.',
];

export function renderHomePage(root, state = sessionStore.getState()) {
  if (!root) return;

  root.innerHTML = `
    <section class="new-app-home">
      <header class="new-app-home__header">
        <div class="home-hero">
          <p class="eyebrow">Playground Journey</p>
          <h1>Starte dein Experiment</h1>
          <p class="subline">
            Playground ist eine geführte SPA: Jede Session folgt exakt Home → Collect → Train → Infer.
            Diese Seite ist der einzige Eintrittspunkt – hier entscheidest du über Modalität, Aufwand und ob BLE-Streaming nötig ist.
          </p>
          <ul class="home-journey" role="list">
            ${renderJourneySteps()}
          </ul>
        </div>

        <div class="home-guardrails" aria-live="polite">
          <p class="eyebrow">Session Guardrails</p>
          <p class="home-guardrails__copy">
            Alle Sessions sind deterministisch: Guards blockieren destruktive Aktionen während Training oder aktiver Inferenz.
            Bevor du eine Karte startest, lies dir die Regeln erneut durch.
          </p>
          <ul class="home-guardrails__list">
            ${renderSessionRules()}
          </ul>
        </div>
      </header>

      <div class="home-main">
        <div class="home-grid-panel">
          <p class="task-grid-instructions" id="taskGridHint">
            Nutze Tab, um Karten zu fokussieren, und bestätige mit Enter oder Leertaste. Verfügbarkeit und Aufwand werden vorgelesen.
          </p>
          <div class="task-grid" data-home-grid role="list" aria-describedby="taskGridHint"></div>
        </div>

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
      </div>
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

  const syncSessionState = (nextState = sessionStore.getState()) => {
    if (!nextState?.selectedTaskModel) {
      stateEl.textContent = 'Keine Session gestartet. Wähle eine Karte.';
      discardBtn.disabled = true;
      goHomeBtn.disabled = true;
      return;
    }
    const nextStepCopy = describeStep(nextState.step);
    stateEl.textContent = `Session aktiv für ${nextState.selectedTaskModel.name}. Nächster Schritt: ${nextStepCopy}.`;
    discardBtn.disabled = false;
    goHomeBtn.disabled = nextState.step === STEP.HOME;
  };

  syncSessionState(state);
  const unsubscribe = sessionStore.subscribe(syncSessionState);
  root.addEventListener(
    'DOMNodeRemoved',
    () => {
      unsubscribe?.();
    },
    { once: true }
  );
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

function renderJourneySteps() {
  return JOURNEY_STEPS.map(
    (item, index) => `
      <li class="home-journey__item">
        <div class="home-journey__index" aria-hidden="true">${index + 1}</div>
        <div>
          <p class="home-journey__step">${item.step}</p>
          <p class="home-journey__title">${item.title}</p>
          <p class="home-journey__description">${item.description}</p>
        </div>
      </li>
    `
  ).join('');
}

function renderSessionRules() {
  return SESSION_RULES.map(
    (item) => `
      <li>
        <span class="home-guardrails__bullet" aria-hidden="true"></span>
        <p>${item}</p>
      </li>
    `
  ).join('');
}
