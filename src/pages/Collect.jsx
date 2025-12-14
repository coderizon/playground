import React, { useState } from 'react';
import { sessionStore, DATASET_STATUS, TRAINING_STATUS } from '../app/store/sessionStore.js';
import { createClassController } from '../app/routes/classController.js';
import { goHome, goTrain } from '../app/routes/navigationController.js';
import { canGoToCollect, canGoToTraining } from '../app/guards/navigation.js';
import { ClassCard } from '../components/class/ClassCard.jsx';
import { NoticeBanner } from '../components/common/NoticeBanner.jsx';

const classController = createClassController();

function CollectToolbar({ classCount, onAddClass, trainingLocked, classes, totalSamples }) {
  const readyClasses = classes.filter(c => c.dataset?.status === DATASET_STATUS.READY).length;
  
  // Background audio check
  const isAudio = sessionStore.getState().selectedTaskModel?.inputModality === 'microphone';
  const backgroundIssues = isAudio 
    ? classes.filter(c => {
        const hasBg = c.dataset?.samples?.some(s => s.preset === 'background' || (s.durationMs || 0) >= 15000);
        return !hasBg;
      })
    : [];

  return (
    <section className="collect-toolbar">
      <div className="collect-toolbar-grid">
        <div className="collect-metric-grid">
          <div className="collect-metric">
            <p className="eyebrow">Klassen</p>
            <strong>{classCount}</strong>
          </div>
          <div className="collect-metric">
            <p className="eyebrow">Klassen bereit</p>
            <strong>{readyClasses}/{classes.length}</strong>
          </div>
          <div className="collect-metric">
            <p className="eyebrow">Samples</p>
            <strong>{totalSamples}</strong>
          </div>
        </div>
        <button type="button" className="primary" onClick={onAddClass} disabled={trainingLocked}>
          Klasse hinzufügen
        </button>
      </div>
      {backgroundIssues.length > 0 && (
        <div className="summary-background" role="status" aria-live="polite">
          <p className="eyebrow">Audio-Check</p>
          <ul>
            {backgroundIssues.map(c => (
              <li key={c.id}>
                <strong>{c.name || 'Unbenannt'}</strong>
                <span>Hintergrund fehlt</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CollectEmpty({ onAddFirst, trainingLocked }) {
  return (
    <div className="collect-empty">
      <div>
        <p className="eyebrow">Schritt 1</p>
        <h3>Lege mindestens zwei Klassen an</h3>
        <p>Benötigst du Inspiration? Überlege dir Gegensätze (z. B. „Katze vs. Hund“ oder „Applaus vs. Stille“), benenne die Klassen und sammle pro Klasse mehrere Beispiele.</p>
      </div>
      <ul>
        <li>⚡️ Mindestens 10 Beispiele pro Klasse erfassen.</li>
        <li>🎙️ Audio-Sessions: Vergiss die 20s Hintergrundaufnahme nicht.</li>
        <li>🎯 Kamerasessions: Variiere Perspektive und Licht.</li>
      </ul>
      <button
        type="button"
        className="primary"
        onClick={onAddFirst}
        disabled={trainingLocked}
      >
        Erste Klasse hinzufügen
      </button>
    </div>
  );
}

export function Collect({ state }) {
  // Navigation guard check
  if (!canGoToCollect(state)) {
    return (
      <section className="collect-page">
        <p className="eyebrow">Session erforderlich</p>
        <h1>Starte zuerst eine Session</h1>
        <p>Wähle ein Modell auf der Home-Seite, um Klassen zu definieren.</p>
        <button type="button" className="primary" onClick={goHome}>Zurück zur Auswahl</button>
      </section>
    );
  }

  const classes = state.classes || [];
  const trainingLocked = state.training?.status === TRAINING_STATUS.RUNNING;
  const totalSamples = classes.reduce((acc, c) => acc + (c.dataset?.recordedCount || 0), 0);
  const trainingReady = canGoToTraining(state);
  
  // Disable adding new classes if any existing class has 0 samples or is actively recording
  const hasEmptyClass = classes.some(c => (c.dataset?.recordedCount || 0) === 0);
  const isAnyClassRecording = classes.some(c => c.dataset?.status === DATASET_STATUS.RECORDING);
  const addClassDisabled = trainingLocked || hasEmptyClass || isAnyClassRecording;
  
  // Training Gate Hint
  const trainingHint = (() => {
    if (classes.length < 2) return 'Mindestens zwei Klassen sind erforderlich, bevor du weiter trainieren kannst.';
    const incomplete = classes.some(cls => cls.dataset?.status !== DATASET_STATUS.READY);
    if (incomplete) return 'Jede Klasse benötigt einen vollständigen Datensatz (Status „Bereit“).';
    return '';
  })();

  const handleAddClass = () => {
    if (!addClassDisabled) {
      classController.addClass();
    }
  };

  const handleGoTrain = () => {
    if (canGoToTraining(state)) {
      goTrain();
    }
  };

  const [showHints, setShowHints] = useState(false);
  const floatingHints = [];
  if (trainingHint) {
    floatingHints.push(trainingHint);
  }

  if (trainingLocked) {
    floatingHints.push('Training läuft – Daten- und Klassenänderungen sind vorübergehend gesperrt.');
  } else {
    if (hasEmptyClass) {
      floatingHints.push('Fülle zuerst die vorhandenen Klassen mit Daten, bevor du neue hinzufügst.');
    }
    if (isAnyClassRecording) {
      floatingHints.push('Beende zuerst alle laufenden Aufnahmen, bevor du neue Klassen hinzufügst.');
    }
  }

  return (
    <section className="collect-page">
      <div className="collect-context">
        <header className="collect-header">
          <div>
            <p className="eyebrow">Schritt 2 · Classes & Data Collection</p>
            <h1>Definiere deine Klassen</h1>
            <p className="subline">
              Erstelle Klassen, sammle Beispiele und mache den Trainingsschritt bereit.
            </p>
          </div>
          <div className="collect-header__actions">
            <button type="button" className="ghost" onClick={goHome}>Zurück zur Auswahl</button>
            <button type="button" className="secondary" onClick={handleGoTrain} disabled={!trainingReady}>Weiter zu Training</button>
          </div>
        </header>

        <CollectToolbar 
          classCount={classes.length} 
          onAddClass={handleAddClass} 
          trainingLocked={addClassDisabled} 
          classes={classes}
          totalSamples={totalSamples}
        />
      </div>

      <section className="collect-body">
        <div className="collect-class-list">
          {classes.length === 0 ? (
            <CollectEmpty onAddFirst={handleAddClass} trainingLocked={addClassDisabled} />
          ) : (
            classes.map(classItem => (
              <ClassCard 
                key={classItem.id} 
                classItem={classItem} 
                trainingStatus={state.training?.status}
                modality={state.selectedTaskModel?.inputModality}
                taskModelId={state.selectedTaskModel?.id}
              />
            ))
          )}
        </div>

        <div className="collect-mobile-toolbar" aria-live="polite">
          <div className="collect-mobile-stats">
            <div>
              <p className="eyebrow">Klassen</p>
              <strong>{classes.length}</strong>
            </div>
            <div>
              <p className="eyebrow">Bereit</p>
              <strong>{classes.filter(c => c.dataset?.status === DATASET_STATUS.READY).length}/{classes.length}</strong>
            </div>
            <div>
              <p className="eyebrow">Samples</p>
              <strong>{totalSamples}</strong>
            </div>
          </div>
          <div className="collect-mobile-actions">
            <button
              type="button"
              className="primary"
              onClick={handleAddClass}
              disabled={addClassDisabled}
            >
              Klasse hinzufügen
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleGoTrain}
              disabled={!trainingReady}
            >
              Zu Training
            </button>
          </div>
        </div>
      </section>

      <div className="collect-floating-toolbar">
        {showHints && floatingHints.length > 0 && (
          <div className="collect-floating-hints" aria-live="polite">
            {floatingHints.map((message) => (
              <p key={message} className="collect-lock-hint" role="status">
                {message}
              </p>
            ))}
          </div>
        )}
        <button
          type="button"
          className={`collect-floating-toggle ${showHints ? 'is-active' : ''} ${!showHints && floatingHints.length > 0 ? 'animate-pulse' : ''}`}
          onClick={() => setShowHints((prev) => !prev)}
          disabled={floatingHints.length === 0}
          aria-label="Hinweise anzeigen oder ausblenden"
          aria-pressed={showHints}
        >
          {showHints ? '×' : 'i'}
        </button>
      </div>
    </section>
  );
}
