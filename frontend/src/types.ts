export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'file';
export type MessageStatus = 'pending' | 'uploading' | 'sent' | 'failed';

export interface User {
  id: string;
  email: string;
}

export interface Message {
  id: string;
  serverId: string | null;
  from: string;
  to: string;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  localUri: string | null;
  thumbnail: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
  status: MessageStatus;
}

export interface Conversation {
  userId: string;
  email: string;
  lastMessage: string;
  lastMessageType: MessageType;
  lastMessageAt: string;
}

export interface UploadResult {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface SendMessageInput {
  localId: string;
  to: string;
  type: MessageType;
  content?: string | null;
  mediaUrl?: string | null;
  thumbnail?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

export interface MessageAck {
  localId: string;
  id: string;
  createdAt: string;
}
