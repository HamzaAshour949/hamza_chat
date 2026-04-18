interface QueuedMessage {
  event: string;
  data: any;
}

type SocketGetter = () => any;
let _getSocket: SocketGetter = () => null;

export function registerSocketGetter(fn: SocketGetter): void {
  _getSocket = fn;
}

let queue: QueuedMessage[] = [];

export function enqueueMessage(event: string, data: any): void {
  const socket = _getSocket();
  if (socket?.connected) {
    socket.emit(event, data);
  } else {
    queue.push({ event, data });
  }
}

export function flushQueue(): void {
  const socket = _getSocket();
  if (!socket?.connected || queue.length === 0) return;

  const batch = [...queue];
  queue = [];

  for (const msg of batch) {
    socket.emit(msg.event, msg.data);
  }
}

export function getQueueLength(): number {
  return queue.length;
}
