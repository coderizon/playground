import { sessionStore, STEP, INFERENCE_STATUS } from '../../store/sessionStore.js';
import { canAccessInference } from '../../guards/navigation.js';
import { stopLiveInference } from '../../services/ml/liveInference.js';
import { renderNoticeBanner } from '../../components/common/noticeBanner.js';
import { openConfirmDialog } from '../../components/common/confirmDialog.js';

export function renderInferencePage(root, state = sessionStore.getState()) {
  if (!root) return;
  if (!canAccessInference(state)) {
    renderBlocked(root);
    return;
  }

  root.innerHTML = `
    <section class="infer-page">
      <header class="infer-header">
        <div>
          <p class="eyebrow">Schritt 4 · Inference</p>
          <h1>Teste dein Modell</h1>
          <p class="subline">Starte die Vorschau, beobachte Wahrscheinlichkeiten und verbinde ein Edge-Gerät.</p>
        </div>
        <div class="infer-header__actions">
          <button type="button" class="ghost" data-back-train>Zurück zu Training</button>
          <button type="button" class="secondary" data-discard-session>Session verwerfen</button>
        </div>
      </header>
      <section class="infer-body">
        <div id="inferNotice"></div>
        <article class="inference-panel" x-data="inferenceControls()" x-init="init()">
          <h2>Inference</h2>
          <p class="inference-status" x-text="statusCopy()"></p>
          <div class="inference-video">
            <video autoplay muted playsinline :class="{'is-active': running}" x-ref="preview"></video>
          </div>
          <div class="inference-actions">
            <button type="button" class="primary" @click="startInference" :disabled="!previewReady || running">Inference starten</button>
            <button type="button" class="ghost" @click="stopInference" :disabled="!running">Stoppen</button>
          </div>
          <div class="prediction-output" x-data="predictionPanel()" x-init="init()">
            <h3>Vorhersage</h3>
            <p class="prediction-status" x-text="statusCopy()"></p>
            <ul>
              <template x-for="(row, index) in predictions" :key="row.name + index">
                <li :class="{'is-active': row.isBest && isRunning}">
                  <span x-text="row.name"></span>
                  <strong x-text="formatPercent(row.value)"></strong>
                </li>
              </template>
            </ul>
            <p class="prediction-updated" x-show="lastUpdatedAt">
              Aktualisiert um <span x-text="readableTimestamp()"></span>
            </p>
          </div>
          <div class="edge-panel" x-data="edgePanel()" x-init="init()" @open-edge-modal.window="modalOpen = true">
            <p>Edge-Verbindung</p>
            <p class="edge-status" x-text="edgeStatusCopy()"></p>
            <p class="edge-error" x-show="edgeStatus.status === 'error'" x-text="edgeStatus.error"></p>
            <div class="edge-inline-controls">
              <button type="button" class="ghost" @click="$dispatch('open-edge-modal')">Gerät wählen</button>
              <label class="stream-toggle">
                <input type="checkbox" @change="toggleStreaming()" :checked="streamingEnabled()" :disabled="edgeStatus.status !== 'connected'"/>
                <span>Vorhersagen streamen</span>
              </label>
              <button
                type="button"
                class="ghost"
                :disabled="edgeStatus.status !== 'connected'"
                @click="disconnect()"
              >
                Trennen
              </button>
            </div>
            <div class="ble-modal-backdrop" x-show="modalOpen" @click="modalOpen = false" x-transition.opacity></div>
            <section class="ble-modal" x-show="modalOpen" x-transition>
              <div class="ble-modal-shell">
                <div class="ble-modal-header">
                  <h3>Verbinde ein Gerät</h3>
                  <button type="button" class="icon-close" @click="modalOpen = false">×</button>
                </div>
                <p class="ble-modal-error" x-show="edgeStatus.status === 'error'" x-text="modalErrorCopy()"></p>
                <div class="ble-device-list">
                  <template x-for="device in devices" :key="device.id">
                    <button
                      type="button"
                      class="ble-device"
                      :class="deviceClasses(device.id)"
                      @click="connect(device.id)"
                      :disabled="connecting"
                    >
                      <div class="ble-device-info">
                        <span class="ble-device-name" x-text="device.name"></span>
                        <span class="ble-device-status" x-text="deviceStatusCopy(device.id)"></span>
                      </div>
                      <div class="ble-device-instructions">
                        <p>Vor dem Verbinden</p>
                        <ul>
                          <template x-for="tip in device.tips" :key="tip">
                            <li x-text="tip"></li>
                          </template>
                        </ul>
                      </div>
                      <div :class="thumbClass(device.id)">
                        <img :src="device.thumb" :alt="device.name" loading="lazy"/>
                      </div>
                    </button>
                  </template>
                </div>
              </div>
            </section>
          </div>
        </article>
      </section>
    </section>
  `;

  renderNoticeBanner(document.getElementById('inferNotice'), {
    tone: state.edge.status === 'error' ? 'warning' : 'info',
    title: 'Streamingstatus',
    message: inferNoticeMessage(state),
  });

  root.querySelector('[data-back-train]')?.addEventListener('click', () => {
    ensureInferenceStopped(() => sessionStore.setStep(STEP.TRAIN));
  });
  root.querySelector('[data-discard-session]')?.addEventListener('click', () => {
    ensureInferenceStopped(() =>
      openConfirmDialog({
        title: 'Session verwerfen?',
        message: 'Alle gesammelten Daten gehen verloren. Willst du fortfahren?',
        destructive: true,
        confirmLabel: 'Session verwerfen',
        onConfirm: () => {
          sessionStore.discardSession();
        },
      })
    );
  });
}

function renderBlocked(root) {
  root.innerHTML = `
    <section class="infer-page">
      <p class="eyebrow">Noch nicht bereit</p>
      <h1>Inference benötigt ein abgeschlossenes Training</h1>
      <p>Trainiere zuerst dein Modell, um die Vorschau zu aktivieren.</p>
      <button type="button" class="primary" data-go-train>Zurück zu Training</button>
    </section>
  `;
  root.querySelector('[data-go-train]')?.addEventListener('click', () => {
    sessionStore.setStep(STEP.TRAIN);
  });
}

function inferNoticeMessage(state) {
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
}

function ensureInferenceStopped(next) {
  const running = sessionStore.getState().inference.status === INFERENCE_STATUS.RUNNING;
  if (!running) {
    next?.();
    return;
  }
  openConfirmDialog({
    title: 'Inference stoppen?',
    message: 'Bitte stoppe die laufende Inference, bevor du die Seite verlässt.',
    confirmLabel: 'Inference stoppen',
    destructive: true,
    onConfirm: () => {
      stopLiveInference();
      next?.();
    },
  });
}
