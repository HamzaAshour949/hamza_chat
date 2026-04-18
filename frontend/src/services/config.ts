import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Production: set API_HOST env var at build time (e.g. API_HOST=myserver.com eas build).
// Development on a real device: Expo Go injects the laptop's LAN IP via debuggerHost.
// Development on emulator: falls back to the standard loopback alias.
function resolveHost(): string {
  // 1. Explicit host baked in at build time (production / staging)
  const buildHost = Constants.expoConfig?.extra?.API_HOST as string | null;
  if (buildHost) return buildHost;

  // 2. Expo Go on a real device — Metro provides the LAN IP of the dev machine
  const debuggerHost =
    Constants.expoGoConfig?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost ??
    '';
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost') return ip;
  }

  // 3. Emulator fallback
  return Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
}

const HOST = resolveHost();

export const API_BASE_URL = `http://${HOST}:3001`;
export const WS_URL = `http://${HOST}:3000`;
