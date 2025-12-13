const useNewAppFlag = (import.meta.env?.VITE_PLAYGROUND_APP || '').toLowerCase();
const useNewApp = useNewAppFlag === 'next' || useNewAppFlag === 'new';

if (useNewApp) {
  const { bootstrapNewApp } = await import('./app/bootstrap.js');
  bootstrapNewApp();
} else {
  await import('./main.js');
  await import('./landing.js');
}
