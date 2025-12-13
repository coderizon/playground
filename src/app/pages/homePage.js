import { sessionStore, STEP } from '../store/sessionStore.js';

const TASK_MODELS = [
  {
    id: 'image-classification',
    name: 'Bildklassifikation',
    description: 'Sammle Bilder, trainiere ein Modell und teste live.',
    requiresTraining: true,
    modality: 'camera',
    tags: ['Camera', 'Trainierbar'],
  },
  {
    id: 'gesture-recognition',
    name: 'Gestenerkennung',
    description: 'Nutze Handlandmarks für benutzerdefinierte Gesten.',
    requiresTraining: true,
    modality: 'camera',
    tags: ['Camera', 'Gesten'],
  },
  {
    id: 'face-preview',
    name: 'Gesichtsvorschau',
    description: 'Blendshape-Streaming ohne Training.',
    requiresTraining: false,
    modality: 'camera',
    tags: ['Camera', 'Inference'],
    defaultInferenceSource: 'camera',
  },
];

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
      </aside>
    </section>
  `;

  const grid = root.querySelector('[data-home-grid]');
  const stateEl = root.querySelector('[data-session-state]');
  if (!grid || !stateEl) return;

  TASK_MODELS.forEach((task) => {
    const card = document.createElement('button');
    card.className = 'task-card';
    card.type = 'button';
    card.setAttribute('data-task-id', task.id);
    card.innerHTML = `
      <div class="task-card__body">
        <h3>${task.name}</h3>
        <p>${task.description}</p>
      </div>
      <div class="task-card__tags">
        ${task.tags.map((tag) => `<span class="task-tag">${tag}</span>`).join('')}
      </div>
    `;
    card.addEventListener('click', () => {
      sessionStore.startSession(task);
    });
    grid.appendChild(card);
  });

  const renderState = () => {
    const state = sessionStore.getState();
    if (!state.selectedTaskModel) {
      stateEl.textContent = 'Keine Session gestartet. Wähle eine Karte.';
      return;
    }
    const nextStepCopy = describeStep(state.step);
    stateEl.textContent = `Session aktiv für ${state.selectedTaskModel.name}. Nächster Schritt: ${nextStepCopy}.`;
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
