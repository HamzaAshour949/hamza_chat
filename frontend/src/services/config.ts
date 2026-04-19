import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Production: set API_HOST env var at build time (e.g. API_HOST=myserver.com eas build).
// Development on a real device: Expo / dev-client inject the laptop's LAN IP via
// `hostUri` (dev client) or `debuggerHost` (Expo Go).
// Development on emulator: falls back to the standard loopback alias.
function resolveHost(): string {
  // 1. Explicit host baked in at build time (production / staging)
  const buildHost = Constants.expoConfig?.extra?.API_HOST;
  if (typeof buildHost === 'string' && buildHost.length > 0) return buildHost;

  // 2. Dev build / Expo Go — Metro provides the host of the dev machine.
  //    Try the various places Expo stashes it depending on client type.
  //    Expo-Go exposes `debuggerHost` (string "host:port"); expo-dev-client
  //    normally exposes `hostUri` (string "host:port"), but on some dev builds
  //    it surfaces as an object like `{ host, port }`.
  const candidates: unknown[] = [
    (Constants.expoConfig as any)?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
  ];

  for (const raw of candidates) {
    let hostPort: string | null = null;
    if (typeof raw === 'string' && raw.length > 0) {
      hostPort = raw;
    } else if (raw && typeof raw === 'object') {
      const host = (raw as any).host ?? (raw as any).hostname;
      if (typeof host === 'string' && host.length > 0) hostPort = host;
    }
    if (!hostPort) continue;
    const ip = hostPort.split(':')[0];
    // On Android, `localhost` / `127.0.0.1` refers to the emulator itself — must
    // use 10.0.2.2 to reach the host machine. Everything else (LAN IP) passes
    // through unchanged.
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  // 3. Emulator fallback
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

const HOST = resolveHost();

export const API_BASE_URL = `http://${HOST}:3001`;
export const WS_URL = `http://${HOST}:3000`;

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[config] API_BASE_URL =', API_BASE_URL, 'WS_URL =', WS_URL);
}
