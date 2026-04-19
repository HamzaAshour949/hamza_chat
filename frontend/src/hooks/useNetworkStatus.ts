import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../services/socket';

type Socket = NonNullable<ReturnType<typeof getSocket>>;

/**
 * Tracks whether the Socket.io connection is live.
 *
 * `connectSocket()` is invoked asynchronously from `AppNavigator`, so the
 * socket may not exist on the first render. We poll briefly until the socket
 * appears, then attach listeners for `connect` / `disconnect` / `authenticated`.
 */
export function useNetworkStatus() {
  const [connected, setConnected] = useState(false);
  const attachedRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleConnect = () => !cancelled && setConnected(true);
    const handleDisconnect = () => !cancelled && setConnected(false);

    const attach = (socket: Socket) => {
      if (attachedRef.current === socket) return;
      attachedRef.current = socket;
      setConnected(socket.connected);
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('authenticated', handleConnect);
    };

    const existing = getSocket();
    if (existing) {
      attach(existing);
      return () => {
        cancelled = true;
        existing.off('connect', handleConnect);
        existing.off('disconnect', handleDisconnect);
        existing.off('authenticated', handleConnect);
      };
    }

    const interval = setInterval(() => {
      if (cancelled) return;
      const s = getSocket();
      if (s) {
        clearInterval(interval);
        attach(s);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(interval);
      const s = attachedRef.current;
      if (s) {
        s.off('connect', handleConnect);
        s.off('disconnect', handleDisconnect);
        s.off('authenticated', handleConnect);
      }
    };
  }, []);

  return connected;
}
