import { sessionStore } from '../../store/sessionStore.js';
import { connectDevice, disconnectDevice, getEdgeState } from '../../services/edge/edgeService.js';

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

    init() {
      this.unsubscribe = sessionStore.subscribe((state) => {
        this.edgeStatus = state.edge;
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
  }));
}
