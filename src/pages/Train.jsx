import React, { useEffect, useState } from 'react';
import { TRAINING_STATUS } from '../app/store/sessionStore.js';
import { canAccessTraining, canAccessInference } from '../app/guards/navigation.js';
import { goCollect, goInfer } from '../app/routes/navigationController.js';
import { 
  getTrainingSummary, 
  getDatasetReadinessIssues, 
  getTrainingRetryContext, 
  getAudioBackgroundIssues 
} from '../app/store/selectors.js';
import { startTrainingWithController, abortTrainingWithController, updateTrainingParams } from '../app/routes/trainingController.js';

function TrainingSettings({ state }) {
  const { params } = state.training;
  const isRunning = state.training.status === TRAINING_STATUS.RUNNING;

  const handleChange = (key, value) => {
    updateTrainingParams({ [key]: value });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mt-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Einstellungen</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Epochen</label>
          <input 
            type="number" 
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-medium text-slate-900 shadow-inner focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
            value={params.epochs} 
            min="1" 
            step="1"
            disabled={isRunning}
            onChange={(e) => handleChange('epochs', e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Anzahl der Durchläufe</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Batchgröße</label>
          <input 
            type="number" 
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-medium text-slate-900 shadow-inner focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
            value={params.batchSize} 
            min="1" 
            step="1"
            disabled={isRunning}
            onChange={(e) => handleChange('batchSize', e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Samples pro Schritt</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lernrate</label>
          <input 
            type="number" 
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-medium text-slate-900 shadow-inner focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
            value={params.learningRate} 
            min="0.0001" 
            step="0.0001"
            disabled={isRunning}
            onChange={(e) => handleChange('learningRate', e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">Schrittweite beim Lernen</p>
        </div>
      </div>
    </div>
  );
}

function TrainFooter({ state, retryContext, onStart, onAbort, onBack, onNext, canStart, canAbort, canInfer }) {
  const summary = getTrainingSummary(state);
  const training = state.training;
  const isRunning = training?.status === TRAINING_STATUS.RUNNING;
  const backgroundIssues = getAudioBackgroundIssues(state);
  const issues = getDatasetReadinessIssues(state);

  const getStartCtaLabel = () => {
    if (isRunning) return 'Training läuft …';
    if (!retryContext?.lastRun) return 'Training starten';
    if (retryContext.datasetChangedSinceLastRun) return 'Erneut trainieren (neue Daten)';
    return 'Erneut trainieren';
  };

  return (
    <section className="train-footer mt-8 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
        <div>
          <p className="eyebrow">Klassen bereit</p>
          <strong className="text-xl font-semibold text-slate-900">{summary.readyClasses}/{summary.totalClasses}</strong>
        </div>
        <div>
          <p className="eyebrow">Beispiele</p>
          <strong className="text-xl font-semibold text-slate-900">{summary.totalSamples}</strong>
        </div>
      </div>

      {/* Issues / Hints */}
      {(backgroundIssues.length > 0 || issues.length > 0) && (
        <div className="summary-background" role="status" aria-live="polite">
          <p className="eyebrow">Checks</p>
          <ul className="space-y-1">
            {backgroundIssues.map(c => (
              <li key={`bg-${c.id}`}><strong>{c.name}</strong>: Hintergrund fehlt</li>
            ))}
            {issues.map(c => (
              <li key={`issue-${c.id}`}><strong>{c.name || 'Unbenannt'}</strong>: {c.reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Progress */}
      {isRunning && (
        <div className="training-progress">
            <div className="training-progress-bar">
            <div className="training-progress-fill" style={{ width: `${training.progress || 0}%` }}></div>
            </div>
            <span>{training.progress || 0}%</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        <button type="button" className="ghost order-last md:order-first w-full md:w-auto" onClick={onBack}>
          Zurück zu Klassen
        </button>
        
        <div className="flex flex-col gap-3 md:flex-row w-full md:w-auto">
            {isRunning ? (
                <button type="button" className="ghost danger w-full md:w-auto" onClick={onAbort}>
                    Training abbrechen
                </button>
            ) : (
                <button type="button" className="primary w-full md:w-auto" onClick={onStart} disabled={!canStart}>
                    {getStartCtaLabel()}
                </button>
            )}
            
            <button type="button" className="secondary w-full md:w-auto" onClick={onNext} disabled={!canInfer}>
                Weiter zur Inferenz
            </button>
        </div>
      </div>
    </section>
  );
}

function TrainingInfo({ state, retryContext }) {
  const training = state.training;
  const info = retryContext?.lastRun;
  const [now, setNow] = useState(Date.now());

  const getStatusLabel = () => {
    switch (training?.status) {
      case TRAINING_STATUS.DONE: return 'Abgeschlossen';
      case TRAINING_STATUS.RUNNING: return 'Läuft';
      case TRAINING_STATUS.ABORTED: return 'Abgebrochen';
      case TRAINING_STATUS.ERROR: return `Fehler: ${training?.error || ''}`;
      default: return 'Bereit';
    }
  };

  const getLastRunLabel = () => {
    if (!info) return 'Noch kein Training durchgeführt.';
    const time = info.completedAt ? new Date(info.completedAt).toLocaleTimeString() : '';
    switch (info.status) {
      case TRAINING_STATUS.DONE: return `Zuletzt erfolgreich trainiert (${time}).`;
      case TRAINING_STATUS.ABORTED: return `Letzter Durchlauf abgebrochen (${time}).`;
      case TRAINING_STATUS.ERROR: return `Letzter Durchlauf fehlgeschlagen (${time}).`;
      default: return '';
    }
  };

  useEffect(() => {
    if (training?.status !== TRAINING_STATUS.RUNNING) return undefined;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [training?.status]);

  const formatDuration = (milliseconds = 0) => {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const runningDurationMs = training?.status === TRAINING_STATUS.RUNNING && training.startedAt
    ? now - training.startedAt
    : null;
  const lastDurationMs = info?.durationMs ?? null;
  const durationLabel = runningDurationMs
    ? `Laufzeit: ${formatDuration(runningDurationMs)}`
    : lastDurationMs
      ? `Letzte Dauer: ${formatDuration(lastDurationMs)}`
      : 'Noch keine Trainingszeit';

  return (
    <article className="training-info space-y-6">
      <div className="training-meta">
        <p className="eyebrow">Status</p>
        <p className="text-xl font-semibold text-slate-900">{getStatusLabel()}</p>
        <p className="text-sm text-slate-600 mt-1">{getLastRunLabel()}</p>
      </div>

      <div className="training-meta">
        <p className="eyebrow">Dauer</p>
        <p className="text-sm text-slate-600 mt-1">{durationLabel}</p>
      </div>

      {retryContext?.staleClasses?.length > 0 && (
        <div className="training-meta">
          <p className="eyebrow">Neue Daten verfügbar</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {retryContext.staleClasses.map(cls => (
              <li key={cls.id}>
                <strong>{cls.name}</strong>
                <span className="opacity-60 ml-2">aktualisiert</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export function Train({ state }) {
  if (!canAccessTraining(state)) {
    return (
      <section className="train-page">
        <p className="eyebrow">Noch nicht bereit</p>
        <h1>Training erst nach vollständiger Datensammlung</h1>
        <p>Stelle sicher, dass mindestens zwei Klassen vorhanden sind und Datensätze bereit sind.</p>
        <button type="button" className="primary" onClick={goCollect}>Zurück zur Sammlung</button>
      </section>
    );
  }

  const retryContext = getTrainingRetryContext(state);
  const canInfer = canAccessInference(state);
  const issues = getDatasetReadinessIssues(state);
  const isRunning = state.training?.status === TRAINING_STATUS.RUNNING;
  const ready = issues.length === 0;
  const canStart = ready && !isRunning;
  const canAbort = isRunning;

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
    <section className="train-page">
      <header className="train-header">
        <div>
          <p className="eyebrow">Schritt 3 · Training</p>
          <h1>Trainiere dein Modell</h1>
          <p className="subline">
            Überprüfe deine Klassen und starte das Training. Währenddessen bleiben Datensätze gesperrt.
          </p>
        </div>
      </header>

      <section className="train-body block">
        <TrainingInfo state={state} retryContext={retryContext} />
        
        <TrainingSettings state={state} />

        <TrainFooter 
          state={state}
          retryContext={retryContext}
          onStart={handleStart}
          onAbort={handleAbort}
          onBack={goCollect}
          onNext={goInfer}
          canStart={canStart}
          canAbort={canAbort}
          canInfer={canInfer}
        />
      </section>
    </section>
  );
}
