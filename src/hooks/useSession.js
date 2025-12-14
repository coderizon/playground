import { useSyncExternalStore } from 'react';
import { sessionStore } from '../app/store/sessionStore.js';

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}
