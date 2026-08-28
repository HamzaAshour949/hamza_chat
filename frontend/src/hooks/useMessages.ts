import { useCallback, useEffect, useRef, useState } from 'react';
import { getBackend } from '../backend';
import { useAuth } from '../context/AuthContext';
import * as messageStore from '../services/messageStore';
import { enqueueMessage } from '../services/offlineQueue';
import type { Message } from '../types';

function localId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useMessages(partnerId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMore = useRef(true);

  useEffect(() => {
    if (!user) return;
    hasMore.current = true;
    let cancelled = false;
    const backend = getBackend();

    (async () => {
      const cached = await messageStore.getMessages(user.id, partnerId);
      if (!cancelled && cached.length > 0) {
        setMessages(cached);
        setLoading(false);
      }
      try {
        const serverMsgs = await backend.getMessages(partnerId, { limit: 30 });
        if (cancelled) return;
        for (const msg of serverMsgs) await messageStore.saveMessage(msg);
        setMessages((prev) => mergeMessages(serverMsgs, prev.filter((m) => m.status !== 'sent')));
      } catch (e) {
        console.error('Failed to sync messages:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const offMsg = backend.onMessage((msg) => {
      if (msg.from !== partnerId && msg.to !== partnerId) return;
      messageStore.saveMessage(msg);
      setMessages((prev) => mergeMessages([msg], prev));
    });
    const offAck = backend.onMessageAck(async (ack) => {
      if (!ack.localId) return;
      await messageStore.updateMessageAck(ack.localId, ack.id, ack.createdAt);
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === ack.localId
            ? { ...m, id: ack.id, serverId: ack.id, createdAt: ack.createdAt, status: 'sent' as const }
            : m,
        );
        return mergeMessages([], updated);
      });
    });

    return () => {
      cancelled = true;
      offMsg();
      offAck();
    };
  }, [partnerId, user]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore.current || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const before = oldest.serverId || oldest.id;
      const older = await getBackend().getMessages(partnerId, { before, limit: 30 });
      if (older.length < 30) hasMore.current = false;
      for (const msg of older) await messageStore.saveMessage(msg);
      setMessages((prev) => mergeMessages(prev, older));
    } catch (e) {
      console.error('Failed to load more:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [partnerId, user, loadingMore, messages]);

  const sendText = useCallback(
    (text: string) => {
      if (!user) return;
      const id = localId();
      const now = new Date().toISOString();
      const localMsg: Message = {
        id,
        serverId: null,
        from: user.id,
        to: partnerId,
        type: 'text',
        content: text,
        mediaUrl: null,
        localUri: null,
        thumbnail: null,
        mimeType: null,
        fileName: null,
        fileSize: null,
        createdAt: now,
        status: 'pending',
      };
      messageStore.saveMessage(localMsg);
      setMessages((prev) => [localMsg, ...prev]);
      enqueueMessage({
        localId: id,
        to: partnerId,
        type: 'text',
        content: text,
      });
    },
    [partnerId, user],
  );

  const addOptimisticMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      const exists = prev.find((m) => m.id === msg.id);
      if (exists) return prev.map((m) => (m.id === msg.id ? msg : m));
      return [msg, ...prev];
    });
  }, []);

  return { messages, loading, loadingMore, sendText, loadMore, addOptimisticMessage };
}

function mergeMessages(primary: Message[], secondary: Message[]): Message[] {
  const seen = new Set<string>();
  const out: Message[] = [];
  for (const msg of [...primary, ...secondary]) {
    const key = msg.serverId ? `s:${msg.serverId}` : msg.id;
    if (seen.has(key) || seen.has(msg.id)) continue;
    seen.add(key);
    seen.add(msg.id);
    out.push(msg);
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}
