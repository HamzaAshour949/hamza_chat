import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Conversation, User } from '../types';

interface ChatListScreenProps {
  conversations: Conversation[];
  searchResults: User[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenChat: (userId: string, email: string) => void;
  onLogout: () => void;
  loading: boolean;
}

const AVATAR_COLORS = [
  '#00A884', '#F15C6D', '#6B8AFF', '#FFB347',
  '#A78BFA', '#34D399', '#F472B6', '#FBBF24',
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getAvatarColor(id: string): string {
  return AVATAR_COLORS[hashId(id) % AVATAR_COLORS.length];
}

function getInitial(email: string): string {
  return email.charAt(0).toUpperCase();
}

function formatLastMessagePreview(message: string, type: Conversation['lastMessageType']): string {
  switch (type) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'voice':
      return 'Voice message';
    case 'file':
      return 'File';
    default:
      return message;
  }
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate()
    && date.getMonth() === now.getMonth()
    && date.getFullYear() === now.getFullYear();
  if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate()
    && date.getMonth() === yesterday.getMonth()
    && date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function ConversationItem({ item, onPress }: { item: Conversation; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.conversationRow, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityLabel={`Open chat with ${item.email}`}
      accessibilityRole="button"
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.userId) }]}>
        <Text style={styles.avatarText}>{getInitial(item.email)}</Text>
      </View>
      <View style={styles.conversationContent}>
        <View style={styles.conversationTopRow}>
          <Text style={styles.conversationName} numberOfLines={1}>{item.email}</Text>
          <Text style={styles.conversationTime}>{formatTimestamp(item.lastMessageAt)}</Text>
        </View>
        <Text style={styles.conversationPreview} numberOfLines={1}>
          {formatLastMessagePreview(item.lastMessage, item.lastMessageType)}
        </Text>
      </View>
    </Pressable>
  );
}

function SearchResultItem({ item, onPress }: { item: User; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.conversationRow, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityLabel={`Start chat with ${item.email}`}
      accessibilityRole="button"
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.id) }]}>
        <Text style={styles.avatarText}>{getInitial(item.email)}</Text>
      </View>
      <View style={styles.conversationContent}>
        <Text style={styles.conversationName} numberOfLines={1}>{item.email}</Text>
      </View>
    </Pressable>
  );
}

function ItemSeparator() {
  return <View style={styles.divider} />;
}

export default function ChatListScreen({
  conversations,
  searchResults,
  searchQuery,
  onSearchChange,
  onOpenChat,
  onLogout,
  loading,
}: ChatListScreenProps) {
  const isSearching = searchQuery.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <Pressable onPress={onLogout} style={styles.logoutButton} accessibilityLabel="Logout" accessibilityRole="button">
          <Ionicons name="log-out-outline" size={24} color="#AEBAC1" />
        </Pressable>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#8696A0" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by email..."
            placeholderTextColor="#8696A0"
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search users by email"
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00A884" />
        </View>
      ) : isSearching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SearchResultItem item={item} onPress={() => onOpenChat(item.id, item.email)} />
          )}
          ItemSeparatorComponent={ItemSeparator}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyTitle}>No users found</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />
      ) : conversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#8696A0" />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>Search for a user by email to start chatting</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <ConversationItem item={item} onPress={() => onOpenChat(item.userId, item.email)} />
          )}
          ItemSeparatorComponent={ItemSeparator}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111B21' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#E9EDEF' },
  logoutButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C33',
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40, color: '#E9EDEF', fontSize: 15 },
  conversationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  rowPressed: { backgroundColor: '#1A2A31' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  conversationContent: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  conversationTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversationName: { fontSize: 16, fontWeight: '600', color: '#E9EDEF', flex: 1, marginRight: 8 },
  conversationTime: { fontSize: 12, color: '#8696A0' },
  conversationPreview: { fontSize: 14, color: '#8696A0', marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#222D34', marginLeft: 76 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#8696A0', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#8696A0', marginTop: 8, textAlign: 'center' },
});
