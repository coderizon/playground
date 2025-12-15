import React, { useEffect, useState } from 'react';
import { sessionStore, STEP } from '../app/store/sessionStore.js';
import { getAvailableTaskModels } from '../app/data/taskModels.js';
import { goHome } from '../app/routes/navigationController.js';
import { discardSessionWithConfirm } from '../app/routes/sessionController.js';

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

export function Home({ state }) {
  const [taskModels] = useState(getAvailableTaskModels());

  const handleTaskSelect = (task) => {
    if (task.status === 'available') {
      sessionStore.startSession(task);
    }
  };

  const getStepDescription = (step) => {
    switch (step) {
      case STEP.COLLECT: return 'Classes & Data Collection';
      case STEP.TRAIN: return 'Training';
      case STEP.INFER: return 'Inference';
      default: return 'Home';
    }
  };

  const sessionActive = !!state.selectedTaskModel;
  const sessionStatusCopy = sessionActive
    ? `Session aktiv für ${state.selectedTaskModel.name}. Nächster Schritt: ${getStepDescription(state.step)}.`
    : 'Keine Session gestartet. Wähle eine Karte.';

  return (
    <section className="new-app-home">
      <div className="home-main">
        <div className="home-grid-panel">
          <p className="task-grid-instructions" id="taskGridHint">
            Nutze Tab, um Karten zu fokussieren, und bestätige mit Enter oder Leertaste. Verfügbarkeit und Aufwand werden vorgelesen.
          </p>
          <div className="task-grid" role="list" aria-describedby="taskGridHint">
            {taskModels.map((task) => {
              const disabled = task.status !== 'available';
              const titleId = `task-${task.id}-title`;
              const descId = `task-${task.id}-desc`;
              const metaId = `task-${task.id}-meta`;
              
              return (
                <button
                  key={task.id}
                  className={`task-card task-card--${task.status}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTaskSelect(task)}
                  role="listitem"
                  aria-disabled={disabled}
                  aria-labelledby={titleId}
                  aria-describedby={`${descId} ${metaId}`}
                >
                  <div className="task-card__hero">
                    <img src={task.image} alt="" aria-hidden="true" style={task.imageStyle} />
                  </div>
                  <div className="task-card__content">
                    <div className="task-card__meta" id={metaId}>
                      <span className="task-modality" aria-label={`Modality ${task.inputModality}`}>{task.inputModality}</span>
                      <span className="task-effort" aria-label={`Aufwand ${task.effortLevel}`}>{task.effortLevel} effort</span>
                    </div>
                    <div className="task-card__body">
                      <h3 id={titleId}>{task.name}</h3>
                      <p id={descId}>{task.description}</p>
                    </div>
                    <dl className="task-summary">
                      <div>
                        <dt>Training</dt>
                        <dd>{task.requiresTraining ? 'Erforderlich' : 'Nicht nötig'}</dd>
                      </div>
                      <div>
                        <dt>Interaktion</dt>
                        <dd>{task.interactionType}</dd>
                      </div>
                      <div>
                        <dt>BLE</dt>
                        <dd>{task.bleCapable ? 'Ja' : 'Optional'}</dd>
                      </div>
                    </dl>
                    <div className="task-card__tags">
                      {task.badges.map((tag) => <span key={tag} className="task-tag">{tag}</span>)}
                    </div>
                  </div>
                  {disabled && (
                    <div className="task-card__status" role="status" aria-live="polite">
                      {task.status === 'coming-soon' ? 'Demnächst verfügbar' : 'Geplant'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>


      </div>
    </section>
  );
}
