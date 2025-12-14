import { ensureTfLoaded } from './utils/loadTf.js';

await ensureTfLoaded();

const { bootstrapNewApp } = await import('./app/bootstrap.js');
bootstrapNewApp();
