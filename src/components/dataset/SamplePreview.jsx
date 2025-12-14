import React, { useState, useEffect, useRef } from 'react';
import { createSampleController } from '../../app/routes/sampleController.js';

const sampleController = createSampleController();

export function SamplePreview({ sample, classId, disabled }) {
  const [index, setIndex] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const timerRef = useRef(null);

  const frames = sample.previewFrames?.length ? sample.previewFrames : (sample.thumbnail ? [sample.thumbnail] : []);
  const currentFrame = frames[index] || sample.thumbnail || null;

  const start = () => {
    if (!frames.length || scrubbing) return;
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
    if (!scrubbing) {
      setIndex(0);
    }
  };

  useEffect(() => {
    return () => stop();
  }, []);

  const handleScrub = (e) => {
    if (!frames.length) return;
    setScrubbing(true);
    stop();
    const val = parseInt(e.target.value, 10);
    const next = Math.min(Math.max(val || 0, 0), frames.length - 1);
    setIndex(next);
  };

  const releaseScrub = () => {
    setScrubbing(false);
  };

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
  
  return (
    <li onMouseLeave={stop}>
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
          {frames.length > 1 && (
            <div className="sample-scrub">
              <input
                type="range"
                min="0"
                max={frames.length - 1}
                value={index}
                className="sample-scrub-slider"
                onInput={handleScrub}
                onChange={releaseScrub}
                onMouseUp={releaseScrub}
                onTouchEnd={releaseScrub}
                aria-label={`Frame ${index + 1} von ${frames.length}`}
              />
              <p className="sample-scrub-label">
                Frame <span>{index + 1}</span> / <span>{frames.length}</span>
              </p>
            </div>
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
