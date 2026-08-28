import { BACKEND, firebaseReady } from '../config';
import type { BackendClient } from './types';
import { LocalBackend } from './local';

let client: BackendClient | null = null;

export function getBackend(): BackendClient {
  if (client) return client;
  if (BACKEND === 'firebase') {
    if (!firebaseReady()) {
      throw new Error('Firebase env vars are missing. See README.');
    }
    throw new Error('Firebase backend is not enabled in this build yet.');
  } else {
    client = new LocalBackend();
  }
  return client;
}

export function resetBackend(): void {
  client?.disconnect();
  client = null;
}
