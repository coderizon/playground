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
      if (this.edgeStatus.status === 'error') {
        this.modalOpen = true;
      }
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.edgeStatus = state.edge;
        this.connecting = getEdgeState().connecting;
        this.streaming = getEdgeState().streaming;
        if (state.edge.status === 'error') {
          this.modalOpen = true;
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

    edgeStatusCopy() {
      return this.statusLabel();
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
      const lastId = this.edgeStatus.selectedDevice || this.edgeStatus.deviceInfo?.id;
      if (!lastId) return;
      await this.connect(lastId);
    },

    showErrorToast(error) {
      console.error('[edgePanel] connection error', error);
    },

    openModal() {
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
