import { io, Socket } from 'socket.io-client';
import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config';
import type {
  Conversation,
  Message,
  MessageAck,
  SendMessageInput,
  UploadResult,
  User,
} from '../types';
import type { BackendClient } from './types';

type Listener<T> = (value: T) => void;

function asMessage(raw: Record<string, unknown>): Message {
  return {
    id: String(raw.id),
    serverId: String(raw.id),
    from: String(raw.from),
    to: String(raw.to),
    type: (raw.type as Message['type']) || 'text',
    content: (raw.content as string | null) ?? null,
    mediaUrl: (raw.mediaUrl as string | null) ?? null,
    localUri: null,
    thumbnail: (raw.thumbnail as string | null) ?? null,
    mimeType: (raw.mimeType as string | null) ?? null,
    fileName: (raw.fileName as string | null) ?? null,
    fileSize: typeof raw.fileSize === 'number' ? raw.fileSize : null,
    createdAt: String(raw.createdAt),
    status: 'sent',
  };
}

export class LocalBackend implements BackendClient {
  readonly kind = 'local' as const;
  private token: string | null = null;
  private socket: Socket | null = null;
  private connected = false;
  private connectionListeners = new Set<Listener<boolean>>();
  private messageListeners = new Set<Listener<Message>>();
  private ackListeners = new Set<Listener<MessageAck>>();

  connect(token: string): void {
    this.token = token;
    this.disconnect();
    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 12000,
    });
    this.socket = socket;

    socket.on('connect', () => this.setConnected(true));
    socket.on('authenticated', () => this.setConnected(true));
    socket.on('disconnect', () => this.setConnected(false));
    socket.on('connect_error', () => this.setConnected(false));
    socket.on('new_message', (raw: Record<string, unknown>) => {
      const msg = asMessage(raw);
      this.messageListeners.forEach((cb) => cb(msg));
    });
    socket.on('message_sent', (raw: Record<string, unknown>) => {
      const ack: MessageAck = {
        localId: String(raw.localId || ''),
        id: String(raw.id),
        createdAt: String(raw.createdAt),
      };
      this.ackListeners.forEach((cb) => cb(ack));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setConnected(false);
  }

  isConnected(): boolean {
    return this.connected && Boolean(this.socket?.connected);
  }

  onConnectionChange(cb: Listener<boolean>): () => void {
    this.connectionListeners.add(cb);
    cb(this.isConnected());
    return () => {
      this.connectionListeners.delete(cb);
    };
  }

  async register(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.request('/auth/register', { method: 'POST', body: { email, password }, auth: false });
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
  }

  async me(token: string): Promise<User> {
    this.token = token;
    const data = await this.request<{ user: User }>('/auth/me', { method: 'GET' });
    return data.user;
  }

  async searchUsers(query: string): Promise<User[]> {
    const data = await this.request<{ users: User[] }>(
      `/users/search?email=${encodeURIComponent(query)}`,
    );
    return data.users;
  }

  async getConversations(): Promise<Conversation[]> {
    const data = await this.request<{ conversations: Conversation[] }>('/conversations');
    return data.conversations;
  }

  async getMessages(peerId: string, opts?: { limit?: number; before?: string }): Promise<Message[]> {
    const limit = opts?.limit ?? 30;
    let path = `/messages?userId=${encodeURIComponent(peerId)}&limit=${limit}`;
    if (opts?.before) path += `&before=${encodeURIComponent(opts.before)}`;
    const data = await this.request<{ messages: Record<string, unknown>[] }>(path);
    return data.messages.map(asMessage);
  }

  sendMessage(input: SendMessageInput): void {
    this.socket?.emit('send_message', input);
  }

  onMessage(cb: Listener<Message>): () => void {
    this.messageListeners.add(cb);
    return () => {
      this.messageListeners.delete(cb);
    };
  }

  onMessageAck(cb: Listener<MessageAck>): () => void {
    this.ackListeners.add(cb);
    return () => {
      this.ackListeners.delete(cb);
    };
  }

  async uploadMedia(uri: string, mimeType: string, fileName: string): Promise<UploadResult> {
    if (!this.token) throw new Error('Not authenticated');
    const result = await uploadAsync(`${API_BASE_URL}/media/upload`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      headers: { Authorization: `Bearer ${this.token}` },
      parameters: { filename: fileName },
    });
    if (result.status !== 201) {
      let message = 'Upload failed';
      try {
        message = JSON.parse(result.body).error || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return JSON.parse(result.body) as UploadResult;
  }

  resolveMediaUrl(url: string | null): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file:')) return url;
    return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private setConnected(value: boolean): void {
    this.connected = value;
    this.connectionListeners.forEach((cb) => cb(this.isConnected()));
  }

  private async request<T>(
    path: string,
    options: { method?: 'GET' | 'POST'; body?: Record<string, unknown>; auth?: boolean } = {},
  ): Promise<T> {
    const { method = 'GET', body, auth = true } = options;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth && this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
    }
    return data as T;
  }
}
