import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Production: set API_BASE_URL and WS_URL at build time, e.g.
// API_BASE_URL=https://chat.example.com WS_URL=https://chat.example.com eas build.
// API_HOST remains a convenience for local direct-port builds.
// Development on a real device: Expo / dev-client inject the laptop's LAN IP via
// `hostUri` (dev client) or `debuggerHost` (Expo Go).
// Development on emulator: falls back to the standard loopback alias.
function extraString(name: string): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function withoutTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function resolveHost(): string {
  // 1. Explicit host baked in at build time (production / staging)
  const buildHost = extraString('API_HOST');
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
const EXPLICIT_API_BASE_URL = extraString('API_BASE_URL');
const EXPLICIT_WS_URL = extraString('WS_URL');

export const API_BASE_URL = EXPLICIT_API_BASE_URL
  ? withoutTrailingSlash(EXPLICIT_API_BASE_URL)
  : `http://${HOST}:5101`;
export const WS_URL = EXPLICIT_WS_URL ? withoutTrailingSlash(EXPLICIT_WS_URL) : `http://${HOST}:5100`;

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[config] API_BASE_URL =', API_BASE_URL, 'WS_URL =', WS_URL);
}
