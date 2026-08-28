import type {
  Conversation,
  Message,
  MessageAck,
  SendMessageInput,
  UploadResult,
  User,
} from '../types';

export interface BackendClient {
  readonly kind: 'local' | 'firebase';
  connect(token: string): void;
  disconnect(): void;
  isConnected(): boolean;
  onConnectionChange(cb: (connected: boolean) => void): () => void;

  register(email: string, password: string): Promise<{ token: string; user: User }>;
  login(email: string, password: string): Promise<{ token: string; user: User }>;
  me(token: string): Promise<User>;

  searchUsers(query: string): Promise<User[]>;
  getConversations(): Promise<Conversation[]>;
  getMessages(peerId: string, opts?: { limit?: number; before?: string }): Promise<Message[]>;

  sendMessage(input: SendMessageInput): void;
  onMessage(cb: (msg: Message) => void): () => void;
  onMessageAck(cb: (ack: MessageAck) => void): () => void;

  uploadMedia(uri: string, mimeType: string, fileName: string): Promise<UploadResult>;
  resolveMediaUrl(url: string | null): string | null;
}
