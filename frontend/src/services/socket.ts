import { io, Socket } from 'socket.io-client';
import { WS_URL } from './config';
import { flushQueue, registerSocketGetter } from './offlineQueue';

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

  socket.on('connect', () => {
    console.log('Socket connected');
    socket?.emit('authenticate', { token });
  });

  socket.on('authenticated', (data: { userId: number }) => {
    console.log('Socket authenticated:', data.userId);
    flushQueue();
  });

  socket.on('reconnect', () => {
    socket?.emit('authenticate', { token });
  });

  socket.on('auth_error', (data: { message: string }) => {
    console.error('Socket auth error:', data.message);
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
