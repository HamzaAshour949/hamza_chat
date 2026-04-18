import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';

export function useChatList() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api<{ conversations: any[] }>('/conversations');
      setConversations(data.conversations);
    } catch (e) {
      console.error('Failed to fetch conversations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();

    const socket = getSocket();
    if (socket) {
      const refresh = () => {
        fetchConversations();
      };
      socket.on('new_message', refresh);
      socket.on('message_sent', refresh);
      return () => {
        socket.off('new_message', refresh);
        socket.off('message_sent', refresh);
      };
    }
  }, [fetchConversations]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api<{ users: any[] }>(
          `/users/search?email=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(data.users);
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
