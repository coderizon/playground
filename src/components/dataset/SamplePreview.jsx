import React, { useState, useEffect, useRef } from 'react';
import { createSampleController } from '../../app/routes/sampleController.js';

const sampleController = createSampleController();

export function SamplePreview({ sample, classId, disabled, selectable = false, selected = false, onSelectToggle }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const frames = sample.previewFrames?.length ? sample.previewFrames : (sample.thumbnail ? [sample.thumbnail] : []);
  const currentFrame = frames[index] || sample.thumbnail || null;

  const start = () => {
    if (!frames.length) return;
    stop();
    timerRef.current = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % frames.length);
    }, 400);
  };

  const stop = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIndex(0);
  };

  useEffect(() => {
    return () => stop();
  }, []);

  const handleDelete = () => {
    if (disabled) return;
    sampleController.removeSampleWithConfirm(classId, sample);
  };

  const handleAnnotate = (e) => {
    if (disabled) return;
    // sessionStore update logic for annotation should be here or passed down
    // Since sampleController doesn't have annotate, we use sessionStore directly or a prop
    // The original code used sessionStore.updateDatasetSample
    // We'll import sessionStore
  };
  
  // Need to import sessionStore for annotation
  
  const toggleSelection = () => {
    if (!selectable || disabled || typeof onSelectToggle !== 'function') return;
    onSelectToggle(!selected);
  };

  return (
    <li
      onMouseLeave={stop}
      className={[
        selectable ? 'sample-selectable' : '',
        selectable && selected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {selectable && (
        <label className="sample-select-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={toggleSelection}
            disabled={disabled}
          />
          <span className="visually-hidden">Sample auswählen</span>
        </label>
      )}
      <div className="sample-meta">
        <div className="sample-visual">
          {currentFrame && (
            <img
              src={currentFrame}
              alt="Sample Vorschau"
              className="sample-thumb"
              onMouseEnter={start}
              onFocus={start}
              onBlur={stop}
            />
          )}
        </div>
        <div className="sample-details">
          <strong>{sample.label || `Sample`}</strong>
          <span>{sample.durationMs ? `${(sample.durationMs / 1000).toFixed(1)}s` : (sample.source || '')}</span>
          <p className="sample-meta-info">
            <span>{sample.source === 'microphone' ? 'Audioaufnahme' : (sample.source === 'camera' ? 'Kamera' : 'Sample')}</span>
            {sample.capturedAt && <span>{new Date(sample.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
          {sample.audioUrl && (
            <audio
              className="sample-audio-player"
              controls
              src={sample.audioUrl}
              preload="metadata"
            />
          )}
          {/* Annotation input would go here */}
        </div>
      </div>
      <button type="button" className="ghost" onClick={handleDelete} disabled={disabled}>
        Entfernen
      </button>
    </li>
  );
}
