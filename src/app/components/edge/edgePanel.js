import { sessionStore } from '../../store/sessionStore.js';
import {
  connectDevice,
  disconnectDevice,
  getEdgeState,
  setStreaming,
} from '../../services/edge/edgeService.js';

const DEVICE_OPTIONS = [
  { id: 'arduino', name: 'Arduino Uno R4' },
  { id: 'microbit', name: 'Micro:bit' },
  { id: 'calliope', name: 'Calliope Mini' },
];

export function registerEdgeComponents(Alpine) {
  Alpine.data('edgePanel', () => ({
    devices: DEVICE_OPTIONS,
    edgeStatus: sessionStore.getState().edge,
    connecting: getEdgeState().connecting,
    streaming: getEdgeState().streaming,
    modalOpen: false,

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.edgeStatus = state.edge;
        this.connecting = getEdgeState().connecting;
        this.streaming = getEdgeState().streaming;
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
      disconnectDevice();
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

    streamingEnabled() {
      return getEdgeState().streaming;
    },

    toggleStreaming() {
      const next = !getEdgeState().streaming;
      setStreaming(next);
    },

    hasError() {
      return this.edgeStatus.status === 'error' && Boolean(this.edgeStatus.error);
    },

    async retryLastDevice() {
      const lastId = getEdgeState().selectedDevice || this.edgeStatus.deviceInfo?.id;
      if (!lastId) return;
      await this.connect(lastId);
    },

    showErrorToast(error) {
      console.error('[edgePanel] connection error', error);
    },

    openModal() {
      this.modalOpen = true;
      document.body.classList.add('modal-open');
    },

    closeModal() {
      this.modalOpen = false;
      document.body.classList.remove('modal-open');
    },
  }));
}
