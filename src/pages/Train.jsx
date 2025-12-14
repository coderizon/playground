import React, { useEffect, useState } from 'react';
import { sessionStore, TRAINING_STATUS } from '../app/store/sessionStore.js';
import { canAccessTraining, canAccessInference } from '../app/guards/navigation.js';
import { goCollect, goInfer } from '../app/routes/navigationController.js';
import { 
  getTrainingSummary, 
  getDatasetReadinessIssues, 
  getTrainingRetryContext, 
  getAudioBackgroundIssues 
} from '../app/store/selectors.js';
import { startTrainingWithController, abortTrainingWithController } from '../app/routes/trainingController.js';

function TrainingPanel({ state, retryContext }) {
  const training = state.training;
  const isRunning = training?.status === TRAINING_STATUS.RUNNING;
  const ready = getDatasetReadinessIssues(state).length === 0; // Using issues check for simplicity, or isTrainingReady selector
  // Actually reusing issues logic from CollectSummary for consistency
  const issues = getDatasetReadinessIssues(state);
  const backgroundIssues = getAudioBackgroundIssues(state);
  
  const canStart = ready && !isRunning;
  const canAbort = isRunning;

  // Compute derived labels
  const getStatusLabel = () => {
    switch (training?.status) {
      case TRAINING_STATUS.DONE: return 'Abgeschlossen';
      case TRAINING_STATUS.RUNNING: return 'Läuft';
      case TRAINING_STATUS.ABORTED: return 'Abgebrochen';
      case TRAINING_STATUS.ERROR: return `Fehler: ${training?.error || ''}`;
      default: return 'Bereit';
    }
  };

  const getLockHint = () => {
    if (isRunning) return 'Während des Trainings sind Klassen gesperrt. Brich ab, um neue Daten zu sammeln.';
    if (!ready) return 'Sammle je Klasse genügend Beispiele, bevor du startest.';
    return 'Alles bereit – starte das Training.';
  };

  const getLastRunLabel = () => {
    const info = retryContext?.lastRun;
    if (!info) return 'Noch kein Training durchgeführt.';
    const time = info.completedAt ? new Date(info.completedAt).toLocaleTimeString() : '';
    switch (info.status) {
      case TRAINING_STATUS.DONE: return `Zuletzt erfolgreich trainiert (${time}).`;
      case TRAINING_STATUS.ABORTED: return `Letzter Durchlauf abgebrochen (${time}). Passe deine Daten an und starte erneut.`;
      case TRAINING_STATUS.ERROR: return `Letzter Durchlauf fehlgeschlagen (${time}): ${info.error || ''}`;
      default: return '';
    }
  };

  const getDatasetChangeLabel = () => {
    if (!retryContext?.lastRun) return '';
    if (!retryContext?.datasetChangedSinceLastRun) return 'Seit dem letzten Training wurden keine neuen Samples aufgenommen.';
    const staleCount = retryContext.staleClasses?.length || 0;
    if (staleCount === 1) return '1 Klasse hat neue Samples seit dem letzten Training.';
    return `${staleCount} Klassen haben neue Samples seit dem letzten Training.`;
  };

  const getStartCtaLabel = () => {
    if (isRunning) return 'Training läuft …';
    if (!retryContext?.lastRun) return 'Training starten';
    if (retryContext.datasetChangedSinceLastRun) return 'Erneut trainieren (neue Daten)';
    return 'Erneut trainieren';
  };

  const getStartCtaSubline = () => {
    if (backgroundIssues.length) {
      return backgroundIssues.length === 1
        ? `Audio-Check: ${backgroundIssues[0].name} benötigt eine Hintergrundaufnahme.`
        : 'Audio-Check: Mehrere Klassen benötigen eine Hintergrundaufnahme.';
    }
    if (!retryContext?.lastRun) return '';
    if (retryContext.datasetChangedSinceLastRun) {
       const staleCount = retryContext.staleClasses?.length || 0;
       if (staleCount === 1) return `${retryContext.staleClasses[0].name} enthält neue Samples.`;
       if (staleCount > 1) return `${staleCount} Klassen enthalten neue Samples.`;
       return 'Neue Samples erkannt.';
    }
    return 'Es wurden keine neuen Samples seit dem letzten Training aufgenommen.';
  };

  const handleStart = () => {
    if (canStart) startTrainingWithController();
  };

  const handleAbort = () => {
    if (canAbort) abortTrainingWithController();
  };

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      
      if (e.key.toLowerCase() === 't' && canStart) {
        e.preventDefault();
        handleStart();
      }
      if ((e.key === 'Escape' || e.key.toLowerCase() === 'a') && canAbort) {
        e.preventDefault();
        handleAbort();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canStart, canAbort]);

  return (
    <article className="training-panel">
      <h2>Trainingsstatus</h2>
      <p role="status" aria-live="polite">Status: <strong>{getStatusLabel()}</strong></p>
      <p className="training-hint" role="status" aria-live="polite">{getLockHint()}</p>
      
      <div className="training-progress">
        <div className="training-progress-bar">
          <div className="training-progress-fill" style={{ width: `${training.progress || 0}%` }}></div>
        </div>
        <span>{training.progress || 0}%</span>
      </div>

      <div className="training-actions">
        <button type="button" className="primary" onClick={handleStart} disabled={!canStart}>
          {getStartCtaLabel()}
        </button>
        <button type="button" className="ghost" onClick={handleAbort} disabled={!canAbort}>
          Training abbrechen
        </button>
      </div>

      <div className="training-hotkeys" aria-hidden="true">
        <span><kbd>T</kbd> Start</span>
        <span><kbd>A</kbd>/<kbd>Esc</kbd> Abbrechen</span>
      </div>
      
      {getStartCtaSubline() && <p className="training-hint">{getStartCtaSubline()}</p>}

      <div className="training-meta">
        <p className="eyebrow">Trainingshistorie</p>
        <p role="status" aria-live="polite">{getLastRunLabel()}</p>
        <p className="training-hint" role="status" aria-live="polite">{getDatasetChangeLabel()}</p>
      </div>

      {retryContext?.staleClasses?.length > 0 && (
        <div className="training-meta">
          <p className="eyebrow">Seit letztem Training aktualisiert</p>
          <ul>
            {retryContext.staleClasses.map(cls => (
              <li key={cls.id}>
                <strong>{cls.name}</strong>
                <span className="hint">{cls.updatedAt ? new Date(cls.updatedAt).toLocaleString() : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function TrainingSummaryPanel({ state }) {
  const summary = getTrainingSummary(state);
  const issues = getDatasetReadinessIssues(state);
  const backgroundIssues = getAudioBackgroundIssues(state);

  return (
    <aside className="training-summary">
      <h3>Datensatz-Übersicht</h3>
      <p>
        <strong>{summary.readyClasses}/{summary.totalClasses}</strong> Klassen bereit
      </p>
      <p>
        <strong>{summary.totalSamples}</strong> Samples insgesamt
      </p>
      
      {issues.length > 0 && (
        <div className="training-issues">
          <p className="eyebrow">Offene Aufgaben</p>
          <ul>
            {issues.map(issue => (
              <li key={issue.id}>
                <strong>{issue.name || 'Unbenannt'}</strong>
                <span>{issue.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {backgroundIssues.length > 0 && (
        <div className="training-issues training-issues--background">
          <p className="eyebrow">Audio-Check</p>
          <ul>
            {backgroundIssues.map(issue => (
              <li key={issue.id}>
                <strong>{issue.name}</strong>
                <span>{issue.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

export function Train({ state }) {
  if (!canAccessTraining(state)) {
    return (
      <section className="train-page">
        <p className="eyebrow">Noch nicht bereit</p>
        <h1>Training erst nach vollständiger Datensammlung</h1>
        <p>Stelle sicher, dass mindestens zwei Klassen vorhanden sind und Datensätze bereit sind.</p>
        <button type="button" className="primary" onClick={goCollect}>Zurück zu Collect</button>
      </section>
    );
  }

  const retryContext = getTrainingRetryContext(state);
  const canInfer = canAccessInference(state);

  return (
    <section className="train-page">
      <header className="train-header">
        <div>
          <p className="eyebrow">Schritt 3 · Training</p>
          <h1>Trainiere dein Modell</h1>
          <p className="subline">
            Überprüfe deine Klassen und starte das Training. Währenddessen bleiben Datensätze gesperrt.
          </p>
        </div>
        <div className="train-header__actions">
          <button type="button" className="ghost" onClick={goCollect}>Zurück zu Klassen</button>
          <button type="button" className="secondary" onClick={goInfer} disabled={!canInfer}>Weiter zur Inferenz</button>
        </div>
      </header>

      <section className="train-body">
        <TrainingPanel state={state} retryContext={retryContext} />
        <TrainingSummaryPanel state={state} />
      </section>
    </section>
  );
}
