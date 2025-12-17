import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../../hooks/useSession.js';
import { sessionStore, INFERENCE_STATUS } from '../../app/store/sessionStore.js';
import { getInferencePredictions } from '../../app/store/selectors.js';
import { startLiveInference, stopLiveInference } from '../../services/ml/liveInference.js';
import { requestCameraStream, stopCameraStream, getVideoDevices } from '../../services/media/cameraService.js';
import { EdgePanel } from '../edge/EdgePanel.jsx';
import { FacePreview } from './FacePreview.jsx';
import { BLENDSHAPE_LABELS_DE, BLENDSHAPE_WHITELIST } from '../../services/ml/faceLandmarkService.js';

const FACE_PREVIEW_TASK_ID = 'face-preview';
const BLENDSHAPE_WHITELIST_SET = new Set(BLENDSHAPE_WHITELIST);

export function InferencePanel({ state, onBack, onDiscard, requiresTraining }) {
  const isFacePreview = state?.selectedTaskModel?.id === FACE_PREVIEW_TASK_ID;
  const commonProps = { state, onBack, onDiscard, requiresTraining };
  if (isFacePreview) {
    return <FacePreviewInferencePanel {...commonProps} />;
  }
  return <TrainableInferencePanel {...commonProps} />;
}

function InferFooter({ running, onStart, onStop, onBack, onDiscard, requiresTraining }) {
  return (
    <section className="infer-footer mt-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
        {requiresTraining ? (
            <button type="button" className="ghost order-last md:order-first w-full md:w-auto" onClick={onBack}>
            Zurück zu Training
            </button>
        ) : (
            <div className="hidden md:block"></div> 
        )}
        
        <div className="flex flex-col gap-3 md:flex-row w-full md:w-auto">
            {running ? (
                <button type="button" className="ghost w-full md:w-auto" onClick={onStop}>
                    Stoppen
                </button>
            ) : (
                <button type="button" className="primary w-full md:w-auto" onClick={onStart}>
                    Inference starten
                </button>
            )}
            
            <button type="button" className="ghost danger w-full md:w-auto" onClick={onDiscard}>
                Session verwerfen
            </button>
        </div>
      </div>
    </section>
  );
}

function TrainableInferencePanel ({ state, onBack, onDiscard, requiresTraining }) {
  const session = useSession();
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);

  const inference = state.inference;
  const running = inference.status === INFERENCE_STATUS.RUNNING;
  const predictions = getInferencePredictions(state);
  const lastUpdatedAt = inference.lastPrediction?.updatedAt;
  const currentDeviceId = session.media.cameraDeviceId;

  useEffect(() => {
    (async () => {
      try {
        setDevices(await getVideoDevices());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const cycleDevice = () => {
    if (devices.length < 2) return;
    const current = devices.find((d) => d.deviceId === currentDeviceId);
    const currentIndex = current ? devices.indexOf(current) : 0;
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextId = devices[nextIndex].deviceId;
    sessionStore.setMediaDevice('camera', nextId);
    stopCameraStream(true);
  };

  useEffect(() => {
    let activeStream = null;
    const initCamera = async () => {
      try {
        activeStream = await requestCameraStream(undefined, currentDeviceId);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        console.error(err);
        setError('Kamera konnte nicht gestartet werden: ' + err.message);
      }
    };
    
    initCamera();

    return () => {
      if (running) {
        stopLiveInference();
      }
      stopCameraStream();
    };
  }, [currentDeviceId]); 

  const handleStart = async () => {
    if (running) return;
    try {
      setError(null);
      await startLiveInference(videoRef.current);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Inference konnte nicht gestartet werden.');
    }
  };

  const handleStop = () => {
    if (!running) return;
    stopLiveInference();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (['input', 'textarea'].includes(tag)) return;
      if (e.key.toLowerCase() === 'p' && !running) handleStart();
      if (e.key.toLowerCase() === 'o' && running) handleStop();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running]);

  const statusCopy = () => {
    if (running) return 'Live Vorhersage aktiv';
    if (error) return `Fehler: ${error}`;
    return 'Bereit zum Testen';
  };

  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;
  const readableTimestamp = () => lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '';

  const bestPrediction = predictions.reduce(
    (best, current) => (current.value > best.value ? current : best),
    { value: -1 }
  );

  return (
    <article className="inference-panel">
      <h2>Inference</h2>
      <p className="inference-status" role="status" aria-live="polite">{statusCopy()}</p>
      
      <div className="inference-video">
        <video
          autoPlay
          muted
          playsInline
          className={running ? 'is-active' : ''}
          ref={videoRef}
        />
        {devices.length > 1 && (
          <button
            type="button"
            className="device-switch-btn"
            onClick={cycleDevice}
            title="Kamera wechseln"
          >
            ↻
          </button>
        )}
      </div>

      <div className="inference-hotkeys" aria-hidden="true">
        <span><kbd>P</kbd> Start</span>
        <span><kbd>O</kbd> Stop</span>
      </div>

      <div className="prediction-output">
        <h3>Vorhersage</h3>
        <ul>
          {predictions.map((row, index) => (
            <li key={row.name + index} className={row.name === bestPrediction.name && running ? 'is-active' : ''}>
              <span>{row.name}</span>
              <strong>{formatPercent(row.value)}</strong>
            </li>
          ))}
        </ul>
        {lastUpdatedAt && (
          <p className="prediction-updated" role="status" aria-live="polite">
            Aktualisiert um <span>{readableTimestamp()}</span>
          </p>
        )}
      </div>

      <EdgePanel state={state} />

      <InferFooter 
        running={running}
        onStart={handleStart}
        onStop={handleStop}
        onBack={onBack}
        onDiscard={onDiscard}
        requiresTraining={requiresTraining}
      />
    </article>
  );
}

function FacePreviewInferencePanel({ state, onBack, onDiscard, requiresTraining }) {
  const session = useSession();
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [blendshapes, setBlendshapes] = useState([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [devices, setDevices] = useState([]);
  const running = state.inference.status === INFERENCE_STATUS.RUNNING;
  const currentDeviceId = session.media.cameraDeviceId;

  useEffect(() => {
    (async () => {
      try {
        setDevices(await getVideoDevices());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const cycleDevice = () => {
    if (devices.length < 2) return;
    const current = devices.find((d) => d.deviceId === currentDeviceId);
    const currentIndex = current ? devices.indexOf(current) : 0;
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextId = devices[nextIndex].deviceId;
    sessionStore.setMediaDevice('camera', nextId);
    stopCameraStream(true);
  };

  useEffect(() => {
    let activeStream = null;
    const initCamera = async () => {
      try {
        activeStream = await requestCameraStream(undefined, currentDeviceId);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        console.error(err);
        setError('Kamera konnte nicht gestartet werden: ' + err.message);
      }
    };
    
    initCamera();

    return () => {
      sessionStore.setInferenceStatus(INFERENCE_STATUS.STOPPED, { lastPrediction: null });
      stopCameraStream();
    };
  }, [currentDeviceId]);

  const handleStart = () => {
    if (running) return;
    setError(null);
    sessionStore.setInferenceStatus(INFERENCE_STATUS.RUNNING, { error: null });
  };

  const handleStop = () => {
    if (!running) return;
    stopLiveInference();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (['input', 'textarea'].includes(tag)) return;
      if (e.key.toLowerCase() === 'p' && !running) handleStart();
      if (e.key.toLowerCase() === 'o' && running) handleStop();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running]);

  const handleBlendshapeUpdate = useCallback((categories = []) => {
    if (!running) return;
    const filtered = categories
      .filter((entry) => BLENDSHAPE_WHITELIST_SET.has(entry.categoryName))
      .map((entry) => ({
        id: entry.categoryName,
        name: BLENDSHAPE_LABELS_DE[entry.categoryName] || entry.categoryName,
        value: entry.score || 0,
      }))
      .sort((a, b) => b.value - a.value);
    setBlendshapes(filtered);
    if (filtered.length) {
      setLastUpdatedAt(Date.now());
    }
  }, [running]);

  const statusCopy = () => {
    if (running) return 'Gesichtsvorschau aktiv';
    if (error) return `Fehler: ${error}`;
    return 'Bereit für Blendshape-Vorschau';
  };

  const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;
  const readableTimestamp = () => lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '';
  const bestShape = blendshapes[0];

  return (
    <article className="inference-panel">
      <h2>Gesichtsvorschau</h2>
      <p className="inference-status" role="status" aria-live="polite">{statusCopy()}</p>
      
      <div className="inference-video">
        <video
          autoPlay
          muted
          playsInline
          className={running ? 'is-active' : ''}
          ref={videoRef}
        />
        {devices.length > 1 && (
          <button
            type="button"
            className="device-switch-btn"
            onClick={cycleDevice}
            title="Kamera wechseln"
          >
            ↻
          </button>
        )}
        <FacePreview videoRef={videoRef} isActive={running} onBlendshapes={handleBlendshapeUpdate} />
      </div>

      <div className="inference-hotkeys" aria-hidden="true">
        <span><kbd>P</kbd> Start</span>
        <span><kbd>O</kbd> Stop</span>
      </div>

      <div className="prediction-output">
        <h3>Blendshape-Pegel</h3>
        <ul>
          {blendshapes.length > 0 ? blendshapes.map((shape) => (
            <li key={shape.id} className={bestShape?.id === shape.id && running ? 'is-active' : ''}>
              <span>{shape.name}</span>
              <strong>{formatPercent(shape.value)}</strong>
            </li>
          )) : (
            <li>
              <span>Keine Blendshapes erkannt</span>
              <strong>0%</strong>
            </li>
          )}
        </ul>
        {lastUpdatedAt && (
          <p className="prediction-updated" role="status" aria-live="polite">
            Aktualisiert um <span>{readableTimestamp()}</span>
          </p>
        )}
      </div>

      <InferFooter 
        running={running}
        onStart={handleStart}
        onStop={handleStop}
        onBack={onBack}
        onDiscard={onDiscard}
        requiresTraining={requiresTraining}
      />
    </article>
  );
}