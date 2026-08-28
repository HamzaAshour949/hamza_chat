import { Platform } from 'react-native';
import Constants from 'expo-constants';

function extraString(name: string): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function withoutTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolveHost(): string {
  const buildHost = extraString('API_HOST');
  if (buildHost) return buildHost;

  const candidates: unknown[] = [
    (Constants.expoConfig as { hostUri?: unknown } | undefined)?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    (Constants as { manifest?: { debuggerHost?: unknown } }).manifest?.debuggerHost,
  ];

  for (const raw of candidates) {
    let hostPort: string | null = null;
    if (typeof raw === 'string' && raw.length > 0) hostPort = raw;
    else if (raw && typeof raw === 'object') {
      const host = (raw as { host?: string; hostname?: string }).host
        ?? (raw as { hostname?: string }).hostname;
      if (typeof host === 'string' && host.length > 0) hostPort = host;
    }
    if (!hostPort) continue;
    const ip = hostPort.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') return ip;
  }

  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

const HOST = resolveHost();
const EXPLICIT_API_BASE_URL = extraString('API_BASE_URL');

export const BACKEND = extraString('BACKEND') === 'firebase' ? 'firebase' : 'local';
export const API_BASE_URL = EXPLICIT_API_BASE_URL
  ? withoutTrailingSlash(EXPLICIT_API_BASE_URL)
  : `http://${HOST}:5101`;

export const firebaseConfig = {
  apiKey: extraString('firebaseApiKey'),
  authDomain: extraString('firebaseAuthDomain'),
  projectId: extraString('firebaseProjectId'),
  storageBucket: extraString('firebaseStorageBucket'),
  messagingSenderId: extraString('firebaseMessagingSenderId'),
  appId: extraString('firebaseAppId'),
};

export function firebaseReady(): boolean {
  return Boolean(
    firebaseConfig.apiKey
      && firebaseConfig.authDomain
      && firebaseConfig.projectId
      && firebaseConfig.storageBucket
      && firebaseConfig.appId,
  );
}

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[config] backend=', BACKEND, 'API_BASE_URL=', API_BASE_URL);
}
