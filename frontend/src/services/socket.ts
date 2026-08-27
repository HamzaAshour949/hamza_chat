import io from 'socket.io-client';
import { WS_URL } from './config';
import { flushQueue, registerSocketGetter } from './offlineQueue';

// socket.io-client v2 (to match phpsocket.io server, which speaks EIO=3).
// The v2 package has no exported `Socket` type, so we infer it.
type Socket = ReturnType<typeof io>;

let socket: Socket | null = null;

registerSocketGetter(() => socket);

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(WS_URL, {
    transports: ['websocket'],
    autoConnect: true,
  });
  (socket as any).authenticated = false;

  socket.on('connect', () => {
    console.log('[socket] connected');
    (socket as any).authenticated = false;
    socket?.emit('authenticate', { token });
  });

  socket.on('connect_error', (err: Error) => {
    console.warn('[socket] connect_error:', err?.message ?? err);
  });

  socket.on('disconnect', (reason: string) => {
    console.log('[socket] disconnected:', reason);
    if (socket) (socket as any).authenticated = false;
  });

  socket.on('authenticated', (data: { userId: number }) => {
    console.log('[socket] authenticated:', data.userId);
    if (socket) (socket as any).authenticated = true;
    flushQueue();
  });

  socket.on('reconnect', () => {
    socket?.emit('authenticate', { token });
  });

  socket.on('auth_error', (data: { message: string }) => {
    console.error('Socket auth error:', data.message);
    if (socket) (socket as any).authenticated = false;
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
