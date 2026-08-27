import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import { api } from '../services/api';
import * as messageStore from '../services/messageStore';
import { useAuth } from '../context/AuthContext';
import { enqueueMessage } from '../services/offlineQueue';

function generateLocalId(): string {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function mapDbMessage(row: any) {
  return {
    id: row.id,
    serverId: row.server_id,
    from: row.from_user,
    to: row.to_user,
    type: row.type,
    content: row.content,
    mediaUrl: row.media_url,
    thumbnail: row.thumbnail,
    mimeType: row.mime_type,
    fileName: row.file_name,
    fileSize: row.file_size,
    createdAt: row.created_at,
    status: row.status,
  };
}

export function useMessages(partnerId: number) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = useRef(true);

  useEffect(() => {
    if (!user) return;
    hasMore.current = true;
    let cancelled = false;
    let attachedSocket: ReturnType<typeof getSocket> | null = null;

    loadCachedMessages();
    syncFromServer();

    const handleNewMessage = (msg: any) => {
      if (msg.from === partnerId || msg.to === partnerId) {
        const localMsg = {
          id: String(msg.id),
          serverId: msg.id,
          from: msg.from,
          to: msg.to,
          type: msg.type,
          content: msg.content,
          mediaUrl: msg.mediaUrl,
          thumbnail: msg.thumbnail,
          mimeType: msg.mimeType,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          createdAt: msg.createdAt,
          status: 'sent',
        };
        messageStore.saveMessage(localMsg);
        setMessages((prev) => {
          if (prev.some((m) => m.id === localMsg.id || m.serverId === localMsg.serverId)) {
            return prev;
          }
          return [localMsg, ...prev];
        });
      }
    };

    const handleMessageSent = (ack: any) => {
      messageStore.updateMessageServerId(ack.localId, ack.id, ack.createdAt);
      setMessages((prev) => {
        const updated = prev.map((m) =>
            m.id === ack.localId
              ? { ...m, id: String(ack.id), serverId: ack.id, createdAt: ack.createdAt, status: 'sent' }
              : m
        );
        const seen = new Set<string>();
        return updated.filter((m) => {
          const key = m.serverId ? `server:${m.serverId}` : m.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    };

    const attach = (socket: NonNullable<ReturnType<typeof getSocket>>) => {
      if (cancelled || attachedSocket === socket) return;
      attachedSocket = socket;

      socket.on('new_message', handleNewMessage);
      socket.on('message_sent', handleMessageSent);
    };

    const socket = getSocket();
    if (socket) {
      attach(socket);
    }

    const interval = socket
      ? null
      : setInterval(() => {
          const nextSocket = getSocket();
          if (nextSocket) {
            clearInterval(interval!);
            attach(nextSocket);
          }
        }, 200);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (attachedSocket) {
        attachedSocket.off('new_message', handleNewMessage);
        attachedSocket.off('message_sent', handleMessageSent);
      }
    };
  }, [partnerId, user]);

  async function loadCachedMessages() {
    if (!user) return;
    const cached = await messageStore.getMessages(user.id, partnerId);
    if (cached.length > 0) {
      setMessages(cached.map(mapDbMessage));
      setLoading(false);
    }
  }

  async function syncFromServer() {
    if (!user) return;
    try {
      const data = await api<{ messages: any[] }>(
        `/messages?userId=${partnerId}&limit=30`
      );
      const serverMsgs = data.messages.map((m: any) => ({
        id: String(m.id),
        serverId: m.id,
        from: m.from,
        to: m.to,
        type: m.type,
        content: m.content,
        mediaUrl: m.mediaUrl,
        thumbnail: m.thumbnail,
        mimeType: m.mimeType,
        fileName: m.fileName,
        fileSize: m.fileSize,
        createdAt: m.createdAt,
        status: 'sent',
      }));

      for (const msg of serverMsgs) {
        await messageStore.saveMessage(msg);
      }

      setMessages((prev) => {
        const pending = prev.filter((m) => m.status === 'pending' || m.status === 'failed');
        const merged = [...pending, ...serverMsgs];
        const seen = new Set<string>();
        return merged.filter((m) => {
          const key = m.serverId ? `server:${m.serverId}` : m.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    } catch (e) {
      console.error('Failed to sync messages:', e);
    } finally {
      setLoading(false);
    }
  }

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore.current || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldestMsg = messages[messages.length - 1];
      const oldestServerId = oldestMsg.serverId || oldestMsg.id;
      const data = await api<{ messages: any[] }>(
        `/messages?userId=${partnerId}&before=${oldestServerId}&limit=30`
      );
      if (data.messages.length < 30) {
        hasMore.current = false;
      }
      const olderMsgs = data.messages.map((m: any) => ({
        id: String(m.id),
        serverId: m.id,
        from: m.from,
        to: m.to,
        type: m.type,
        content: m.content,
        mediaUrl: m.mediaUrl,
        thumbnail: m.thumbnail,
        mimeType: m.mimeType,
        fileName: m.fileName,
        fileSize: m.fileSize,
        createdAt: m.createdAt,
        status: 'sent',
      }));
      for (const msg of olderMsgs) {
        await messageStore.saveMessage(msg);
      }
      setMessages((prev) => {
        const merged = [...prev, ...olderMsgs];
        const seen = new Set<string>();
        return merged.filter((m) => {
          const key = m.serverId ? `server:${m.serverId}` : m.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
    } catch (e) {
      console.error('Failed to load more:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [partnerId, user, loadingMore, messages]);

  const sendText = useCallback(
    (text: string) => {
      if (!user) return;

      const localId = generateLocalId();
      const now = new Date().toISOString();

      const localMsg = {
        id: localId,
        serverId: null,
        from: user.id,
        to: partnerId,
        type: 'text' as const,
        content: text,
        mediaUrl: null,
        thumbnail: null,
        mimeType: null,
        fileName: null,
        fileSize: null,
        createdAt: now,
        status: 'pending' as const,
      };

      messageStore.saveMessage(localMsg);
      setMessages((prev) => [localMsg, ...prev]);

      enqueueMessage('send_message', {
        to: partnerId,
        type: 'text',
        content: text,
        localId,
      });
    },
    [partnerId, user]
  );

  const addOptimisticMessage = useCallback((msg: any) => {
    setMessages(prev => {
      const exists = prev.find(m => m.id === msg.id);
      if (exists) {
        return prev.map(m => m.id === msg.id ? msg : m);
      }
      return [msg, ...prev];
    });
  }, []);

  return { messages, loading, loadingMore, sendText, loadMore, addOptimisticMessage };
}
