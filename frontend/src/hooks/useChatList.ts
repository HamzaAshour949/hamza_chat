import { useCallback, useEffect, useState } from 'react';
import { getBackend } from '../backend';
import type { Conversation, User } from '../types';

export function useChatList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const backend = getBackend();
      const data = await backend.getConversations();
      setConversations(data);
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const backend = getBackend();
    fetchConversations();
    const offMsg = backend.onMessage(() => {
      fetchConversations();
    });
    const offAck = backend.onMessageAck(() => {
      fetchConversations();
    });
    const offConn = backend.onConnectionChange((connected) => {
      if (connected) fetchConversations();
    });
    return () => {
      offMsg();
      offAck();
      offConn();
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const users = await getBackend().searchUsers(searchQuery);
        setSearchResults(users);
      } catch (e) {
        console.error('Search failed:', e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return {
    conversations,
    searchResults,
    searchQuery,
    setSearchQuery,
    loading,
    refreshConversations: fetchConversations,
  };
}
