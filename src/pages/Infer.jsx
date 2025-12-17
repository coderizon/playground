import React from 'react';
import { sessionStore } from '../app/store/sessionStore.js';
import { canAccessInference } from '../app/guards/navigation.js';
import { goTrain } from '../app/routes/navigationController.js';
import { discardSessionWithConfirm } from '../app/routes/sessionController.js';
import { createInferenceController } from '../app/routes/inferenceController.js';
import { openConfirmDialog } from '../components/common/confirmDialog.js';
import { showToast } from '../components/common/toast.js';
import { stopLiveInference } from '../services/ml/liveInference.js';
import { NoticeBanner } from '../components/common/NoticeBanner.jsx';
import { InferencePanel } from '../components/inference/InferencePanel.jsx';

const inferenceController = createInferenceController({
  confirm: openConfirmDialog,
  stopLiveInference,
  notify: showToast,
});

export function Infer({ state }) {
  if (!canAccessInference(state)) {
    return (
      <section className="infer-page">
        <p className="eyebrow">Noch nicht bereit</p>
        <h1>Inferenz benötigt ein abgeschlossenes Training</h1>
        <p>Trainiere zuerst dein Modell, um die Vorschau zu aktivieren.</p>
        <button type="button" className="primary" onClick={goTrain}>Zurück zu Training</button>
      </section>
    );
  }

  const getNoticeMessage = () => {
    if (state.edge.status === 'connected') {
      if (state.inference.streamToEdge) {
        return 'Vorhersagen werden an das verbundene Gerät gesendet.';
      }
      return 'Gerät verbunden – aktiviere „Vorhersagen streamen“, um Daten zu senden.';
    }
    if (state.edge.status === 'error') {
      return state.edge.error || 'Streaming angehalten aufgrund eines Verbindungsfehlers.';
    }
    return 'Verbinde ein Edge-Gerät, um Vorhersagen zu streamen.';
  };

  const handleBackToTrain = () => {
    inferenceController.ensureInferenceStopped(() => goTrain(), {
      toastMessage: 'Inference gestoppt, bevor du zur Trainingsseite zurückkehrst.',
    });
  };

  const handleDiscard = () => {
    discardSessionWithConfirm();
  };

  const requiresTraining = state.selectedTaskModel?.requiresTraining;

  return (
    <section className="infer-page">
      <header className="infer-header">
        <div>
          <p className="eyebrow">Schritt 4 · Inferenz</p>
          <h1>Teste dein Modell</h1>
          <p className="subline">Starte die Vorschau, beobachte Wahrscheinlichkeiten und verbinde ein Edge-Gerät.</p>
        </div>
      </header>
      
      <section className="infer-body">
        <NoticeBanner 
          tone={state.edge.status === 'error' ? 'warning' : 'info'}
          title="Streamingstatus"
          message={getNoticeMessage()}
          assertive={state.edge.status === 'error'}
        />
        
        {/* Permission alerts could be added here if needed, but handled by toast/store mostly */}
        
        <InferencePanel 
          state={state} 
          onBack={handleBackToTrain}
          onDiscard={handleDiscard}
          requiresTraining={requiresTraining}
        />
      </section>
    </section>
  );
}
