import React, { useSyncExternalStore } from 'react';
import { sessionStore } from './app/store/sessionStore.js';
import { STEP } from './app/store/sessionStore.js';
import { Home } from './pages/Home.jsx';
import { Collect } from './pages/Collect.jsx';
import { Train } from './pages/Train.jsx';
import { Infer } from './pages/Infer.jsx';
import { ConfirmDialog } from './components/common/ConfirmDialog.jsx';

function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}

export default function App() {
  const state = useSession();

  return (
    <>
      <main className="app-shell">
        {state.step === STEP.HOME && <Home state={state} />}
        {state.step === STEP.COLLECT && <Collect state={state} />}
        {state.step === STEP.TRAIN && <Train state={state} />}
        {state.step === STEP.INFER && <Infer state={state} />}
      </main>
      <ConfirmDialog />
    </>
  );
}
