import React, { useState, useEffect, useRef } from 'react';
import { useSession } from '../../hooks/useSession.js';
import { sessionStore, DATASET_STATUS, TRAINING_STATUS, PERMISSION_STATUS } from '../../app/store/sessionStore.js';
import { createClassController } from '../../app/routes/classController.js';
import { removeSamplesWithConfirm } from '../../app/routes/sampleController.js';
import { requestCameraStream, stopCameraStream, getVideoDevices } from '../../services/media/cameraService.js';
import { requestMicrophoneStream, stopMicrophoneStream, recordAudioSample, getAudioDevices } from '../../services/media/microphoneService.js';
import { recordSampleFrame, clearSamplesForClass } from '../../services/ml/modelBridge.js';
import { showToast } from '../common/toast.js';
import { SamplePreview } from './SamplePreview.jsx';
import { GesturePreview } from './GesturePreview.jsx';
import { translateMediaErrorMessage } from '../../utils/mediaError.js';

const AUDIO_PRESETS = {
  clip: { label: 'Kurzclip', duration: 2000, hint: 'Nimm 2s Clips mit klaren Geräuschen oder Wörtern auf.' },
  background: { label: 'Hintergrund', duration: 20000, hint: 'Halte 20s Umgebungsgeräusche fest, damit das Modell Stille erkennt.' },
};
const BACKGROUND_MIN_DURATION = 15000;
const SAMPLE_CAPTURE_INTERVAL_MS = 100;

// Shared active recorder ID to prevent multiple open streams
let activeRecorderId = null;

export function DatasetRecorder ({ classId, classState, trainingStatus, modality, taskModelId }) {
  const session = useSession();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [lastPermissionError, setLastPermissionError] = useState('');
  const [audioProgress, setAudioProgress] = useState(0);
  const [activePreset, setActivePreset] = useState('clip');
  const [albumOpen, setAlbumOpen] = useState(false);
  const [selectedSampleIds, setSelectedSampleIds] = useState([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [devices, setDevices] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const videoRef = useRef(null);
  const sampleIntervalRef = useRef(null);
  const audioProgressHandleRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const albumModalRef = useRef(null);
  const previewHandleRef = useRef(false);
  const recordingHandleRef = useRef(false);
  const countdownIntervalRef = useRef(null);
  const holdTimeoutRef = useRef(null);

  const dataset = classState?.dataset || { recordedCount: 0, expectedCount: 0, status: DATASET_STATUS.EMPTY };
  const samples = dataset.samples || [];
  const recordedCount = dataset.recordedCount || samples.length || 0;
  const expectedCount = dataset.expectedCount || 0;
  const isReady = dataset.status === DATASET_STATUS.READY;
  const trainingLocked = trainingStatus === TRAINING_STATUS.RUNNING;
  const isAudioTask = modality === 'microphone';
  const isGestureTask = taskModelId === 'gesture-recognition';
  const currentDeviceId = isAudioTask ? session.media.microphoneDeviceId : session.media.cameraDeviceId;

  const canStart = !trainingLocked && !recording && classState;
  const canStop = recording;
  const canDiscard = !recording && dataset.recordedCount > 0;

  const datasetController = createClassController({ clearDataset: clearSamplesForClass });

  useEffect(() => {
    if (previewReady) {
      (async () => {
        try {
          const list = isAudioTask ? await getAudioDevices() : await getVideoDevices();
          setDevices(list);
        } catch (e) {
          console.error('Failed to enumerate devices', e);
        }
      })();
    }
  }, [previewReady, isAudioTask]);

  const describeMediaError = (message, fallback) => {
    const translated = translateMediaErrorMessage(message);
    if (translated) return translated;
    if (message) return message;
    return fallback || '';
  };

  const cycleDevice = () => {
    if (devices.length < 2) return;
    const current = devices.find((d) => d.deviceId === currentDeviceId);
    const currentIndex = current ? devices.indexOf(current) : 0;
    const nextIndex = (currentIndex + 1) % devices.length;
    const nextId = devices[nextIndex].deviceId;

    sessionStore.setMediaDevice(isAudioTask ? 'microphone' : 'camera', nextId);

    // Force stop streams to ensure the new constraint is applied globally
    if (isAudioTask) stopMicrophoneStream();
    else stopCameraStream(true);
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopRecordingCleanup();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (activeRecorderId === classId) {
        if (isAudioTask) stopMicrophoneStream();
        else if (recordingHandleRef.current) {
          stopCameraStream();
          recordingHandleRef.current = false;
        }
        activeRecorderId = null;
      }
    };
  }, [classId, isAudioTask]);

  // Sync with store state to force stop if needed
  useEffect(() => {
    if (trainingLocked && recording) {
      stopRecording();
    }
    if (activeRecorderId && activeRecorderId !== classId && recording) {
      setRecording(false);
      stopRecordingCleanup();
    }
  }, [trainingLocked, recording, activeRecorderId]);

  const needsStream = !isAudioTask;

  useEffect(() => {
    if (isAudioTask || !needsStream) return undefined;
    let cancelled = false;
    const attachPreview = async () => {
      try {
        const stream = await requestCameraStream(undefined, currentDeviceId);
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings() || {};
        setFacingMode(settings.facingMode || 'user');

        previewHandleRef.current = true;
        if (cancelled) {
          stopCameraStream();
          previewHandleRef.current = false;
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setPreviewReady(true);
        sessionStore.setPermissionState('camera', { status: PERMISSION_STATUS.GRANTED, message: null });
        setLastPermissionError('');
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Kamera konnte nicht gestartet werden.');
        const cameraMessage = describeMediaError(err?.message, 'Bitte erlaube den Zugriff.');
        setLastPermissionError(cameraMessage);
        sessionStore.setPermissionState('camera', { status: PERMISSION_STATUS.BLOCKED, message: cameraMessage });
        setPreviewReady(false);
      }
    };
    attachPreview();
    return () => {
      cancelled = true;
      if (previewHandleRef.current) {
        stopCameraStream();
        previewHandleRef.current = false;
      }
    };
  }, [isAudioTask, needsStream, currentDeviceId]);

  const stopRecordingCleanup = () => {
    if (sampleIntervalRef.current) {
      clearTimeout(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (audioProgressHandleRef.current) {
      cancelAnimationFrame(audioProgressHandleRef.current);
      audioProgressHandleRef.current = null;
    }
    setAudioProgress(0);
  };

  const startRecording = async ({ preset = 'clip' } = {}) => {
    if (!canStart && !countdown) return; // Allow start if coming from countdown

    if (isAudioTask) {
      await startAudioRecording({ preset });
      return;
    }

    try {
      let stream = videoRef.current?.srcObject;
      if (!stream) {
        stream = await requestCameraStream(undefined, currentDeviceId);
      }
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings() || {};
      setFacingMode(settings.facingMode || 'user');

      setError(null);
      setLastPermissionError('');
      sessionStore.setPermissionState('camera', { status: PERMISSION_STATUS.GRANTED, message: null });

      activeRecorderId = classId;
      setRecording(true);
      recordingHandleRef.current = true;
      if (!previewHandleRef.current) {
        previewHandleRef.current = true;
      }
      setPreviewReady(true);

      if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }

      sessionStore.updateDatasetStatus(classId, DATASET_STATUS.RECORDING, { error: null });
      beginSampleLoop();
    } catch (err) {
      console.error(err);
      setError('Kamera konnte nicht gestartet werden.');
      const cameraMessage = describeMediaError(err?.message, 'Bitte erlaube den Zugriff.');
      setLastPermissionError(cameraMessage);
      sessionStore.setPermissionState('camera', { status: PERMISSION_STATUS.BLOCKED, message: cameraMessage });
      showToast({ title: 'Kamera blockiert', message: cameraMessage, tone: 'warning' });
      if (recordingHandleRef.current) {
        stopCameraStream();
        recordingHandleRef.current = false;
      }
    }
  };

  const startAudioRecording = async ({ preset }) => {
    try {
      const config = AUDIO_PRESETS[preset] || AUDIO_PRESETS.clip;
      const durationMs = config.duration;

      await requestMicrophoneStream(undefined, currentDeviceId);
      setError(null);
      setLastPermissionError('');
      sessionStore.setPermissionState('microphone', { status: PERMISSION_STATUS.GRANTED, message: null });

      activeRecorderId = classId;
      setRecording(true);
      setActivePreset(preset);
      stopRequestedRef.current = false;
      setAudioProgress(0);

      sessionStore.updateDatasetStatus(classId, DATASET_STATUS.RECORDING, { error: null });
      animateAudioProgress(durationMs);
      captureAudioSample(durationMs);
      } catch (err) {
        console.error(err);
        const micMessage = describeMediaError(err?.message, 'Mikrofon Fehler');
        setError(micMessage);
        setLastPermissionError(micMessage);
        sessionStore.setPermissionState('microphone', { status: PERMISSION_STATUS.BLOCKED, message: micMessage });
        showToast({ title: 'Mikrofon blockiert', message: micMessage, tone: 'warning' });
      }
  };

  const captureAudioSample = async (durationMs) => {
    if (!activeRecorderId || stopRequestedRef.current) {
      updateStatusAfterStop();
      return;
    }
    try {
      const result = await recordAudioSample(durationMs);
      sessionStore.addDatasetSample(classId, { source: 'microphone', durationMs: result?.durationMs || durationMs });

      if (!stopRequestedRef.current && activeRecorderId === classId) {
        animateAudioProgress(durationMs);
        captureAudioSample(durationMs);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message);
      stopRecording();
      sessionStore.updateDatasetStatus(classId, DATASET_STATUS.ERROR, { error: err.message });
    }
  };

  const stopRecording = () => {
    stopRequestedRef.current = true;
    if (isAudioTask) {
      stopMicrophoneStream();
    } else if (recordingHandleRef.current) {
      recordingHandleRef.current = false;
    }
    setRecording(false);
    stopRecordingCleanup();
    activeRecorderId = null;
    updateStatusAfterStop();
  };

  const updateStatusAfterStop = () => {
    const current = sessionStore.getState().classes.find(c => c.id === classId);
    const count = current?.dataset?.recordedCount || 0;
    const expected = current?.dataset?.expectedCount || 0;
    const status = count >= expected ? DATASET_STATUS.READY : (count > 0 ? DATASET_STATUS.RECORDING : DATASET_STATUS.EMPTY);
    sessionStore.updateDatasetStatus(classId, status);
  };

  const beginSampleLoop = () => {
    stopRecordingCleanup();

    const captureOnce = () => {
      try {
        const state = sessionStore.getState();
        if (!videoRef.current) return;

        const clsIndex = state.classes.findIndex((c) => c.id === classId);
        if (clsIndex === -1) {
          stopRecording();
          return;
        }

        const capture = captureFrameSnapshot(videoRef.current, facingMode !== 'environment');
        if (capture) {
          recordSampleFrame(videoRef.current, classId, clsIndex, state.classes.length || 1).catch((fnErr) => {
            console.error('recordSampleFrame error', fnErr);
          });
          sessionStore.addDatasetSample(classId, {
            source: 'camera',
            thumbnail: capture.thumbnail,
            previewFrames: capture.frames || [],
          });

          if (navigator.vibrate) navigator.vibrate(5);
        }
      } catch (err) {
        console.error(err);
        showToast({ title: 'Fehler', message: 'Aufnahme fehlgeschlagen', tone: 'error' });
        stopRecording();
      }
    };

    const scheduleNext = () => {
      if (activeRecorderId !== classId) return;
      sampleIntervalRef.current = window.setTimeout(() => {
        captureOnce();
        scheduleNext();
      }, SAMPLE_CAPTURE_INTERVAL_MS);
    };

    captureOnce();
    scheduleNext();
  };

  const captureFrameSnapshot = (video, mirror = false) => {
    try {
      if (!video || video.readyState < 2) {
        return null;
      }
      const MAX_HEIGHT = 360;
      const safeVideoHeight = video.videoHeight || MAX_HEIGHT;
      const safeVideoWidth = video.videoWidth || Math.round(safeVideoHeight * (4 / 3));
      const aspect = safeVideoHeight ? safeVideoWidth / safeVideoHeight : 4 / 3;
      const targetHeight = Math.min(MAX_HEIGHT, safeVideoHeight);
      const targetWidth = Math.max(1, Math.floor(targetHeight * aspect));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      const capture = (offset = 0) => {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (offset) {
          ctx.translate(offset, 0);
        }
        if (mirror) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const snapshot = canvas.toDataURL('image/jpeg', 0.9);
        ctx.restore();
        return snapshot;
      };

      const frames = [capture(), capture(2)];
      return { thumbnail: frames[0], frames, mirrored: mirror };
    } catch {
      return null;
    }
  };

  const animateAudioProgress = (durationMs) => {
    const start = performance.now();
    const tick = (now) => {
      if (!activeRecorderId || stopRequestedRef.current) {
        setAudioProgress(0);
        return;
      }
      const elapsed = now - start;
      const progress = Math.min(100, (elapsed / durationMs) * 100);
      setAudioProgress(progress);
      if (elapsed < durationMs) {
        audioProgressHandleRef.current = requestAnimationFrame(tick);
      }
    };
    audioProgressHandleRef.current = requestAnimationFrame(tick);
  };

  const beginCountdown = () => {
    if (!(canStart && !recording && countdown === null)) return;
    if (activeRecorderId && activeRecorderId !== classId) {
      showToast({ title: 'Aufnahme läuft bereits', message: 'Bitte beende erst die andere Aufnahme.', tone: 'warning' });
      return;
    }

    let count = 3;
    setCountdown(count);
    if (navigator.vibrate) navigator.vibrate(20);
    sessionStore.updateDatasetStatus(classId, DATASET_STATUS.COUNTDOWN);

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        startRecording();
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 1000);
  };

  const handleRecordStart = (e) => {
    if (e.type === 'touchstart') {
      if (holdTimeoutRef.current) return;
      holdTimeoutRef.current = window.setTimeout(() => {
        holdTimeoutRef.current = null;
        beginCountdown();
      }, 250);
      return;
    }

    beginCountdown();
  };

  const handleRecordStop = (e) => {
    if (e.type === 'touchend' && e.cancelable) {
      e.preventDefault(); // prevent click
    }

    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (countdown !== null) {
      // Cancel countdown
      clearInterval(countdownIntervalRef.current);
      setCountdown(null);
      updateStatusAfterStop(); // Update status after cancelling countdown
    }

    if (recording) {
      stopRecording();
      if (navigator.vibrate) navigator.vibrate(20);
    }
  };

  const discardDataset = () => {
    if (canDiscard) datasetController.discardDatasetWithConfirm(classId);
  };

  const closeAlbum = () => {
    setAlbumOpen(false);
    setSelectedSampleIds([]);
  };

  const toggleAlbum = () => {
    if (!samples.length) return;
    setAlbumOpen(true);
  };

  useEffect(() => {
    if (!albumOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAlbum();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    requestAnimationFrame(() => {
      albumModalRef.current?.focus();
    });
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [albumOpen]);

  useEffect(() => {
    setSelectedSampleIds((prev) => prev.filter((id) => samples.some((sample) => sample.id === id)));
    if (!samples.length) {
      closeAlbum();
    }
  }, [samples]);

  const toggleSampleSelection = (sampleId) => {
    setSelectedSampleIds((prev) =>
      prev.includes(sampleId) ? prev.filter((id) => id !== sampleId) : [...prev, sampleId]
    );
  };

  const selectAllSamples = () => {
    setSelectedSampleIds(dataset.samples?.map((sample) => sample.id) || []);
  };

  const clearSelection = () => {
    setSelectedSampleIds([]);
  };

  const handleBulkRemove = () => {
    if (!selectedSampleIds.length) return;
    removeSamplesWithConfirm(classId, selectedSampleIds);
  };

  const selectedCount = selectedSampleIds.length;
  const allSelected = dataset.samples?.length && selectedCount === dataset.samples.length;

  // Render helpers
  const previewSample = samples.length ? samples[samples.length - 1] : null;
  const hasSamples = recordedCount > 0;
  const previewLabel = isReady
    ? 'Datensatz bereit'
    : (hasSamples && expectedCount > 0 ? `${recordedCount}/${expectedCount} Beispiele` : 'Recorder bereit');
  const showRecordedFraction = expectedCount > 0 && recordedCount < expectedCount;
  const sampleSummaryCount = showRecordedFraction ? `${recordedCount}/${expectedCount}` : (hasSamples ? recordedCount : '');
  const sampleSummaryLabel = 'Beispiele aufgenommen';
  const datasetManageLabel = hasSamples ? 'Beispiele verwalten' : 'Beispiele aufnehmen';
  const sampleCountDisplay = sampleSummaryCount || (hasSamples ? `${recordedCount}` : '');
  const showCameraSnapshot = !isAudioTask && !recording && countdown === null && !!previewSample?.thumbnail;
  const modalTitleId = `sampleModalTitle-${classId}`;

  const getDatasetSummary = () => {
    if (recordedCount > 0 && expectedCount > 0 && recordedCount < expectedCount) return 'Datensammlung läuft';
    return '';
  };

  return (
    <section className="dataset-recorder" aria-label={`Recorder für ${classState.name || 'Unbenannt'}`}>
      <div className="dataset-preview-shell">
        <div className={`dataset-preview ${isAudioTask ? 'is-audio' : ''} ${showCameraSnapshot ? 'has-snapshot' : ''}`}>
          {!isAudioTask && (
            <>
              <video
                autoPlay
                muted
                playsInline
                ref={videoRef}
                className={`preview-video ${previewReady ? 'is-visible' : ''} ${facingMode !== 'environment' ? 'is-mirrored' : ''}`}
              />
              {showCameraSnapshot ? (
                <div className="snapshot-container is-visible">
                  <img
                    src={previewSample.thumbnail}
                    alt={`Vorschau der letzten Aufnahme für ${classState.name || 'Klasse'}`}
                    className="preview-thumbnail"
                  />
                  <span className="snapshot-tag">Letzter Frame</span>
                </div>
              ) : (
                <>
                  {countdown !== null && (
                    <div className="countdown-overlay">
                      {countdown}
                    </div>
                  )}
                  {devices.length > 1 && (
                    <button
                      type="button"
                      className="device-switch-btn"
                      onClick={cycleDevice}
                      disabled={recording}
                      title="Kamera wechseln"
                    >
                      <span className="device-switch-icon" aria-hidden="true">
                        <svg
                          className={`device-switch-icon__arrow ${facingMode === 'environment' ? 'is-active' : ''}`}
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                        <svg
                          className={`device-switch-icon__arrow ${facingMode !== 'environment' ? 'is-active' : ''}`}
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="1.5"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                        </svg>
                      </span>
                      <span className="visually-hidden">Kamera wechseln</span>
                    </button>
                  )}
                  {isGestureTask && <GesturePreview videoRef={videoRef} isMirrored={facingMode !== 'environment'} />}
                  <div className="camera-guidance">
                    {!previewReady && <div className="preview-placeholder">{previewLabel}</div>}
                  </div>
                </>
              )}
            </>
          )}
          {isAudioTask && (
            <div className="audio-preview">
              <div className={`audio-meter ${recording ? 'is-active' : ''}`}></div>
              <div className="audio-guidance">
                <p>{recording ? 'Audioaufnahme läuft' : (dataset.recordedCount > 0 ? `${dataset.recordedCount}/${dataset.expectedCount} Clips` : 'Recorder bereit')}</p>
                {devices.length > 1 && (
                  <button
                    type="button"
                    className="ghost ghost--tiny"
                    onClick={cycleDevice}
                    disabled={recording}
                    style={{ marginTop: '0.5rem' }}
                  >
                    Mikrofon wechseln
                  </button>
                )}
                <small>{AUDIO_PRESETS[activePreset].hint}</small>
                <div className="audio-progress-bar">
                  <div className="audio-progress-fill" style={{ width: `${audioProgress}%` }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="dataset-preview-meta">
          <div className="dataset-preview-meta__count">
            <strong>{sampleCountDisplay}</strong>
            <span>{sampleSummaryLabel}</span>
          </div>
          <button
            type="button"
            className="ghost ghost--tiny dataset-manage-btn"
            onClick={toggleAlbum}
            disabled={!hasSamples}
          >
            {datasetManageLabel}
          </button>
          <p className="dataset-preview-meta__status">{getDatasetSummary()}</p>
        </div>
      </div>

      {error && <p className="field-error">{error}</p>}
      {lastPermissionError && (
        <div className="permission-retry">
          <p>{lastPermissionError}</p>
          <button type="button" className="ghost" onClick={() => startRecording()} disabled={!canStart}>Erneut versuchen</button>
        </div>
      )}

      <div className="recorder-actions">
        {isAudioTask && (
          <div className="audio-actions">
            <button type="button" className="ghost" onClick={() => startRecording({ preset: 'clip' })} disabled={!canStart}>Kurzclip (2s)</button>
            <button type="button" className="ghost" onClick={() => startRecording({ preset: 'background' })} disabled={!canStart}>Hintergrund (20s)</button>
            <button type="button" className="ghost" onClick={stopRecording} disabled={!canStop}>Stoppen</button>
          </div>
        )}
        {!isAudioTask && (
          <button
            type="button"
            className={`record-btn ${recording ? 'is-recording' : ''}`}
            onMouseDown={handleRecordStart}
            onMouseUp={handleRecordStop}
            onMouseLeave={handleRecordStop}
            onTouchStart={handleRecordStart}
            onTouchEnd={handleRecordStop}
            onTouchCancel={handleRecordStop}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!canStart && !recording}
          >
            <span>{recording ? 'Aufnahme...' : 'Halten für Aufnahme'}</span>
          </button>
        )}
      </div>

      {albumOpen && (
        <>
          <div className="sample-modal-backdrop" onClick={closeAlbum}></div>
          <section
            className="sample-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            ref={albumModalRef}
            tabIndex={-1}
          >
            <div className="sample-modal-shell">
              <div className="sample-modal-header">
                <div>
                  <p className="eyebrow">Beispiele</p>
                  <h3 id={modalTitleId}>{classState.name || 'Unbenannte Klasse'}</h3>
                  <p className="sample-modal-subline">Wähle Beispiele aus, um Details zu prüfen oder mehrere auf einmal zu löschen.</p>
                </div>
                <button type="button" className="icon-close" aria-label="Beispiele schließen" onClick={closeAlbum}>
                  ×
                </button>
              </div>
              <div className="sample-modal-actions">
                <button type="button" className="ghost" onClick={selectAllSamples} disabled={allSelected || samples.length === 0}>
                  Alle auswählen
                </button>
                <button type="button" className="ghost" onClick={clearSelection} disabled={!selectedCount}>
                  Auswahl aufheben
                </button>
                <button type="button" className="ghost danger" onClick={handleBulkRemove} disabled={!selectedCount}>
                  {selectedCount > 0 ? `${selectedCount} entfernen` : 'Entfernen'}
                </button>
              </div>
              {samples.length === 0 ? (
                <div className="sample-modal-empty">
                  <p className="sample-modal-empty-title">Noch keine Beispiele</p>
                  <p className="sample-modal-empty-copy">Klicke auf „Aufnahme starten“, um Beispiele für diese Klasse zu sammeln.</p>
                </div>
              ) : (
                <ul className="sample-modal-list">
                  {samples.map((sample, idx) => (
                    <SamplePreview
                      key={sample.id}
                      sample={{ ...sample, label: sample.label || `Beispiel ${idx + 1}` }}
                      classId={classId}
                      disabled={recording || trainingLocked}
                      selectable
                      selected={selectedSampleIds.includes(sample.id)}
                      onSelectToggle={() => toggleSampleSelection(sample.id)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
