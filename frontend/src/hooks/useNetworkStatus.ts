import { useState, useEffect } from 'react';
import { getSocket } from '../services/socket';

export function useNetworkStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleAuthenticated = () => setConnected(true);

    // Check initial state
    setConnected(socket.connected);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('authenticated', handleAuthenticated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('authenticated', handleAuthenticated);
    };
  }, []);

  return connected;
}
