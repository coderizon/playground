import React, { useState } from 'react';
import { sessionStore, DATASET_STATUS } from '../../app/store/sessionStore.js';
import { createClassController } from '../../app/routes/classController.js';
import { DatasetRecorder } from '../dataset/DatasetRecorder.jsx';

const classController = createClassController();

export function ClassCard({ classItem, trainingStatus, modality }) {
  const [name, setName] = useState(classItem.name || '');
  const [error, setError] = useState('');

  const handleNameChange = (e) => {
    setName(e.target.value);
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed === classItem.name) return;
    
    // Simple validation (duplicates check should ideally happen in controller or store)
    // Here we just commit. The store/controller will handle logic.
    // Ideally we should use the controller, but classController.updateName isn't exposed directly as a simple function returning error.
    // Let's assume direct store update for now or implement validation.
    
    // Check for duplicates
    const classes = sessionStore.getState().classes;
    const isDuplicate = classes.some(c => c.id !== classItem.id && c.name.toLowerCase() === trimmed.toLowerCase());
    
    if (!trimmed) {
      setError('Name darf nicht leer sein.');
      setName(classItem.name || ''); // Revert
      return;
    }
    
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
      case DATASET_STATUS.READY: return 'chip chip--success';
      case DATASET_STATUS.RECORDING: return 'chip chip--warning';
      case DATASET_STATUS.EMPTY: return 'chip chip--neutral';
      case DATASET_STATUS.ERROR: return 'chip chip--danger';
      default: return 'chip';
    }
  };

  const datasetSummary = () => {
    const count = classItem.dataset?.recordedCount || 0;
    const expected = classItem.dataset?.expectedCount || 0;
    if (count >= expected) return 'Datensatz vollständig';
    if (count === 0) return 'Noch keine Daten';
    return `${count} von ${expected} Samples`;
  };

  return (
    <article className="class-card-v2">
      <header>
        <input
          type="text"
          className="class-name-input"
          value={name}
          maxLength={60}
          aria-label="Klassenname eingeben"
          onChange={handleNameChange}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        />
        <span className={datasetChipClass()}>
          <span>{datasetLabel()}</span>
        </span>
      </header>
      <p className="dataset-summary">{datasetSummary()}</p>
      {error && <p className="field-error">{error}</p>}
      
      <DatasetRecorder 
        classId={classItem.id} 
        classState={classItem} 
        trainingStatus={trainingStatus}
        modality={modality}
      />

      <div className="class-card-actions">
        <button type="button" className="ghost" onClick={handleDelete} disabled={trainingStatus === 'running'}>
          Klasse entfernen
        </button>
      </div>
    </article>
  );
}
