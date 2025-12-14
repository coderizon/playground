import { sessionStore } from '../../app/store/sessionStore.js';
import {
  getTrainingRetryContext,
  getPermissionIssues,
  getEdgeStreamingContext,
} from '../../app/store/selectors.js';
import {
  connectDevice,
  disconnectDevice,
  getEdgeState,
  setStreaming,
} from '../../services/edge/edgeService.js';
import { showToast } from '../common/toast.js';
import { openConfirmDialog } from '../common/confirmDialog.js';
import { stopLiveInference } from '../../services/ml/liveInference.js';
import { createEdgeController } from '../../app/routes/edgeController.js';

const arduinoThumb = '/src/assets/images/arduino.png';
const microbitThumb = '/src/assets/images/microbit.png';
const calliopeThumb = '/src/assets/images/calliope.png';

const DEVICE_OPTIONS = [
  {
    id: 'arduino',
    name: 'Arduino Uno R4',
    thumb: arduinoThumb,
    tips: [
      'Bluetooth einschalten und Gerät einmal mit Strom versorgen.',
      'Im Browser Web-Bluetooth-Zugriff erlauben.',
      'LED sollte blau blinken, bevor du verbindest.',
    ],
  },
  {
    id: 'microbit',
    name: 'Micro:bit',
    thumb: microbitThumb,
    tips: [
      'Firmware mit Web-Bluetooth-Support flashen.',
      'Gerät per USB starten, dann Batterie anschließen.',
      'Taste A gedrückt halten, bis Bluetooth-Symbol aufleuchtet.',
    ],
  },
  {
    id: 'calliope',
    name: 'Calliope Mini',
    thumb: calliopeThumb,
    tips: [
      'Neueste Calliope-BLE-Firmware installieren.',
      'Gerät mit USB verbinden, danach Batterien aktivieren.',
      'Taste links oben drücken, um BLE-Pairing zu aktivieren.',
    ],
  },
];

const edgeController = createEdgeController({
  store: sessionStore,
  confirm: openConfirmDialog,
  disconnect: disconnectDevice,
  notify: showToast,
  stopLiveInference,
});

export function registerEdgeComponents(Alpine) {
  Alpine.data('edgePanel', () => ({
    devices: DEVICE_OPTIONS,
    edgeStatus: sessionStore.getState().edge,
    connecting: getEdgeState().connecting,
    streaming: getEdgeState().streaming,
    modalOpen: false,
    lastFocusedTrigger: null,
    retryContext: getTrainingRetryContext(sessionStore.getState()),
    permissionIssues: getPermissionIssues(sessionStore.getState()),
    streamingContext: getEdgeStreamingContext(sessionStore.getState()),
    unsubscribe: null,

    init() {
      if (this.edgeStatus.status === 'error') {
        this.modalOpen = true;
      }
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.edgeStatus = state.edge;
        this.connecting = getEdgeState().connecting;
        this.streaming = getEdgeState().streaming;
        this.retryContext = getTrainingRetryContext(state);
        this.permissionIssues = getPermissionIssues(state);
        this.streamingContext = getEdgeStreamingContext(state);
        if (state.edge.status === 'error') {
          this.openModal();
        }
      });
      this.$watch('modalOpen', (value) => {
        if (value) {
          this.$nextTick(() => this.focusFirstModalControl());
        } else {
          this.restoreFocus();
        }
      });
    },

    destroy() {
      this.unsubscribe?.();
    },

    async connect(id) {
      try {
        this.connecting = true;
        await connectDevice(id);
      } catch (error) {
        console.error(error);
        this.showErrorToast(error);
      } finally {
        this.connecting = false;
      }
    },

    disconnect() {
      edgeController.disconnectWithConfirm();
    },

    statusLabel() {
      switch (this.edgeStatus.status) {
        case 'connected':
          return `Verbunden mit ${this.edgeStatus.deviceInfo?.name || ''}`;
        case 'connecting':
          return 'Verbindet...';
        case 'error':
          return this.edgeStatus.error || 'Verbindung fehlgeschlagen';
        default:
          return 'Nicht verbunden';
      }
    },

    edgeStatusCopy() {
      return this.statusLabel();
    },

    streamingEnabled() {
      return getEdgeState().streaming;
    },

    toggleStreaming() {
      if (!this.canStream()) {
        this.warnStreamingBlocked();
        return;
      }
      const next = !getEdgeState().streaming;
      setStreaming(next);
    },

    canStream() {
      return this.streamingContext?.canStream !== false;
    },

    streamBlockedByPermissions() {
      return this.streamingContext?.reasonType === 'permission';
    },

    streamBlockedByFreshTraining() {
      return this.streamingContext?.reasonType === 'training';
    },

    streamingBlockedReason() {
      return this.streamingContext?.reason || '';
    },

    warnStreamingBlocked() {
      const reason = this.streamingBlockedReason();
      if (reason) {
        showToast({
          title: 'Streaming deaktiviert',
          message: reason,
          tone: 'warning',
        });
      }
    },

    hasError() {
      return this.edgeStatus.status === 'error' && Boolean(this.edgeStatus.error);
    },

    async retryLastDevice() {
      const lastId = this.edgeStatus.selectedDevice || this.edgeStatus.deviceInfo?.id;
      if (!lastId) return;
      await this.connect(lastId);
    },

    showErrorToast(error) {
      console.error('[edgePanel] connection error', error);
    },

    openModal(event) {
      if (event?.target) {
        this.lastFocusedTrigger = event.target;
      }
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
    },

    deviceClasses(id) {
      return {
        'is-connected': this.edgeStatus.selectedDevice === id,
      };
    },

    thumbClass(id) {
      return `ble-device-thumb thumb-${id}`;
    },

    focusableModalElements() {
      const modal = this.$refs.edgeModal;
      if (!modal) return [];
      return Array.from(modal.querySelectorAll('[data-modal-focusable]')).filter(
        (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-disabled')
      );
    },

    focusFirstModalControl() {
      const [first] = this.focusableModalElements();
      first?.focus({ preventScroll: true });
    },

    restoreFocus() {
      if (this.lastFocusedTrigger && typeof this.lastFocusedTrigger.focus === 'function') {
        this.lastFocusedTrigger.focus();
      }
    },

    handleModalKeydown(event) {
      if (event.key !== 'Tab') return;
      const focusables = this.focusableModalElements();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },

    deviceStatusCopy(id) {
      if (this.edgeStatus.deviceInfo?.id === id) {
        return 'Verbunden';
      }
      if (this.edgeStatus.selectedDevice === id) {
        return this.edgeStatus.status === 'error' ? 'Erneut versuchen' : 'Ausgewählt';
      }
      return 'Bereit';
    },

    modalErrorCopy() {
      if (this.edgeStatus.status !== 'error') return '';
      return this.edgeStatus.error || 'Verbindung fehlgeschlagen. Bitte versuche es erneut.';
    },
  }));
}
