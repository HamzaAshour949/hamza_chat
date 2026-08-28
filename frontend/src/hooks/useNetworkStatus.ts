import { useEffect, useState } from 'react';
import { getBackend } from '../backend';

export function useNetworkStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const backend = getBackend();
    return backend.onConnectionChange(setConnected);
  }, []);

  return connected;
}
