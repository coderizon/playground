import { TFJS_SCRIPT_URL } from '../config/externalResources.js';
import { loadExternalScript } from './loadScript.js';

let tfPromise = null;

export async function ensureTfLoaded() {
  if (typeof window !== 'undefined' && window.tf) {
    return window.tf;
  }
  if (!tfPromise) {
    tfPromise = loadExternalScript(TFJS_SCRIPT_URL).then(() => window.tf);
  }
  return tfPromise;
}
