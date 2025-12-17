import React, { useState, useEffect } from 'react';
import { sessionStore, DATASET_STATUS } from '../../app/store/sessionStore.js';
import { createClassController } from '../../app/routes/classController.js';
import { DatasetRecorder } from '../dataset/DatasetRecorder.jsx';

const classController = createClassController();

export function ClassCard({ classItem, trainingStatus, modality, taskModelId }) {
  const [name, setName] = useState(classItem.name || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(classItem.name || '');
    setError('');
  }, [classItem.name]);

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const handleFocus = () => {
    setName('');
  };

  const commitName = () => {
    const trimmed = name.trim();
    
    if (!trimmed) {
      setError('');
      setName(classItem.name || ''); // Revert silently
      return;
    }

    if (trimmed === classItem.name) {
      setError('');
      setName(trimmed);
      return;
    }
    
    // Simple validation (duplicates check should ideally happen in controller or store)
    // Here we just commit. The store/controller will handle logic.
    // Ideally we should use the controller, but classController.updateName isn't exposed directly as a simple function returning error.
    // Let's assume direct store update for now or implement validation.
    
    // Check for duplicates
    const classes = sessionStore.getState().classes;
    const isDuplicate = classes.some(c => c.id !== classItem.id && c.name.toLowerCase() === trimmed.toLowerCase());
    
    if (isDuplicate) {
      setError('Name existiert bereits.');
      setName(classItem.name || ''); // Revert
      return;
    }
    
    setError('');
    sessionStore.updateClass(classItem.id, { name: trimmed });
  };

  const handleDelete = () => {
    classController.removeClassWithConfirm(classItem);
  };

  const datasetLabel = () => {
    switch (classItem.dataset?.status) {
      case DATASET_STATUS.READY: return 'Bereit';
      case DATASET_STATUS.RECORDING: return 'Aufnahme';
      case DATASET_STATUS.EMPTY: return 'Leer';
      case DATASET_STATUS.ERROR: return 'Fehler';
      default: return 'Unbekannt';
    }
  };

  const datasetChipClass = () => {
    switch (classItem.dataset?.status) {
      case DATASET_STATUS.READY: return 'dataset-chip dataset-chip--ready';
      case DATASET_STATUS.RECORDING: return 'dataset-chip dataset-chip--recording';
      case DATASET_STATUS.EMPTY: return 'dataset-chip dataset-chip--error';
      case DATASET_STATUS.ERROR: return 'dataset-chip dataset-chip--error';
      default: return 'dataset-chip dataset-chip--neutral';
    }
  };

  const datasetSummary = () => {
    const count = classItem.dataset?.recordedCount || 0;
    const expected = classItem.dataset?.expectedCount || 0;
    if (count >= expected && expected > 0) return 'Datensatz vollständig';
    if (count === 0) return 'Noch keine Daten';
    return 'Datensammlung läuft';
  };

  const cardToneClass = () => {
    switch (classItem.dataset?.status) {
      case DATASET_STATUS.READY:
        return 'class-card-v2 class-card-v2--ready';
      case DATASET_STATUS.RECORDING:
        return 'class-card-v2 class-card-v2--recording';
      case DATASET_STATUS.ERROR:
      case DATASET_STATUS.EMPTY:
        return 'class-card-v2 class-card-v2--error';
      default:
        return 'class-card-v2 class-card-v2--neutral';
    }
  };

  return (
    <article className={cardToneClass()}>
      <header className="class-card-header">
        <div className="class-card-header-actions">
          <span className={datasetChipClass()}>
            <span>{datasetLabel()}</span>
          </span>
          <button
            type="button"
            className="ghost danger class-delete-button"
            onClick={handleDelete}
            disabled={trainingStatus === 'running'}
          >
            Klasse entfernen
          </button>
        </div>
        <div className="class-card-header-main">
          <input
            type="text"
            className="class-name-input"
            value={name}
            maxLength={60}
            aria-label="Klassenname eingeben"
            onChange={handleNameChange}
            onFocus={handleFocus}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          />
        </div>
      </header>
      <p className="dataset-summary">
        {datasetSummary()}
        {error && <span className="dataset-summary-error"> ({error})</span>}
      </p>
      
      <DatasetRecorder 
        classId={classItem.id} 
        classState={classItem} 
        trainingStatus={trainingStatus}
        modality={modality}
        taskModelId={taskModelId}
      />

    </article>
  );
}
