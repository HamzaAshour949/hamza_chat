/**
 * ChatScreen
 *
 * Layout:
 *  - KeyboardAvoidingView wrapping everything
 *  - Inverted FlatList of messages (newest at bottom)
 *    • Sent bubbles: right-aligned, #005C4B, border-radius 8 / top-right 2
 *    • Received bubbles: left-aligned, #1F2C33, border-radius 8 / top-left 2
 *    • Media placeholders: gray box with type icon
 *    • Voice: play button + duration bar
 *    • File: file icon + name + size
 *    • Pending: clock icon | Failed: red tint + retry icon
 *  - Bottom input bar: attach button | text input | mic or send button
 *
 * Colors follow the WhatsApp dark design system exactly.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../services/config';

interface Message {
  id: string;
  from: number;
  to: number;
  type: 'text' | 'image' | 'video' | 'voice' | 'file';
  content: string | null;
  mediaUrl: string | null;
  thumbnail: string | null;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  createdAt: string;
  status?: 'sent' | 'pending' | 'failed';
}

interface ChatScreenProps {
  messages: Message[];
  currentUserId: number;
  onSendText: (text: string) => void;
  onAttachPress: () => void;
  onMicPress: () => void;
  onLoadMore: () => void;
  loading: boolean;
  loadingMore: boolean;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveMediaUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

function MediaPlaceholder({
  type,
  thumbnail,
  mediaUrl,
}: {
  type: 'image' | 'video';
  thumbnail: string | null;
  mediaUrl: string | null;
}) {
  const iconName = type === 'image' ? 'image-outline' : 'videocam-outline';
  const label = type === 'image' ? 'Image' : 'Video';

  // Prefer the inline base64 thumbnail (cheap, available immediately).
  // Fall back to the uploaded media URL for images so the user can still
  // see the picture once the upload completes.
  const previewUri =
    thumbnail && thumbnail.length > 0
      ? thumbnail
      : type === 'image' && mediaUrl
      ? resolveMediaUrl(mediaUrl)
      : null;

  if (previewUri) {
    return (
      <View style={styles.mediaPlaceholder} accessibilityLabel={label}>
        <Image
          source={{ uri: previewUri }}
          style={styles.mediaImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        {type === 'video' && (
          <View style={styles.videoPlayOverlay} pointerEvents="none">
            <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.9)" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.mediaPlaceholder} accessibilityLabel={label}>
      <Ionicons name={iconName} size={32} color="#8696A0" />
      <Text style={styles.mediaPlaceholderText}>{label}</Text>
    </View>
  );
}

function VoiceContent({ fileSize }: { fileSize: number | null }) {
  return (
    <View style={styles.voiceContainer} accessibilityLabel="Voice message">
      <Ionicons name="play" size={24} color="#E9EDEF" />
      <View style={styles.voiceBar}>
        <View style={styles.voiceTrack} />
      </View>
      {fileSize ? (
        <Text style={styles.voiceDuration}>{formatFileSize(fileSize)}</Text>
      ) : null}
    </View>
  );
}

function FileContent({
  fileName,
  fileSize,
}: {
  fileName: string | null;
  fileSize: number | null;
}) {
  return (
    <View style={styles.fileContainer} accessibilityLabel={`File: ${fileName ?? 'Unknown'}`}>
      <Ionicons name="document-outline" size={28} color="#8696A0" />
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {fileName ?? 'File'}
        </Text>
        {fileSize ? (
          <Text style={styles.fileSize}>{formatFileSize(fileSize)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function MessageBubble({
  message,
  isSent,
}: {
  message: Message;
  isSent: boolean;
}) {
  const isFailed = message.status === 'failed';
  const isPending = message.status === 'pending';

  return (
    <View
      style={[
        styles.bubbleRow,
        isSent ? styles.bubbleRowSent : styles.bubbleRowReceived,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isSent ? styles.bubbleSent : styles.bubbleReceived,
          isFailed && styles.bubbleFailed,
        ]}
      >
        {/* Message content by type */}
        {message.type === 'text' && (
          <Text style={styles.messageText}>{message.content}</Text>
        )}
        {(message.type === 'image' || message.type === 'video') && (
          <MediaPlaceholder
            type={message.type}
            thumbnail={message.thumbnail}
            mediaUrl={message.mediaUrl}
          />
        )}
        {message.type === 'voice' && (
          <VoiceContent fileSize={message.fileSize} />
        )}
        {message.type === 'file' && (
          <FileContent fileName={message.fileName} fileSize={message.fileSize} />
        )}

        {/* Timestamp / status row */}
        <View style={styles.metaRow}>
          {isFailed ? (
            <Ionicons name="alert-circle" size={14} color="#F15C6D" />
          ) : isPending ? (
            <Ionicons name="time-outline" size={14} color="#8696A0" />
          ) : (
            <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen({
  messages,
  currentUserId,
  onSendText,
  onAttachPress,
  onMicPress,
  onLoadMore,
  loading,
  loadingMore,
}: ChatScreenProps) {
  const [text, setText] = useState('');
  const hasText = text.trim().length > 0;
  const insets = useSafeAreaInsets();

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed.length > 0) {
      onSendText(trimmed);
      setText('');
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <MessageBubble message={item} isSent={item.from === currentUserId} />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#00A884" />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#00A884" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}>
        <Pressable
          onPress={onAttachPress}
          style={styles.inputAction}
          accessibilityLabel="Add attachment"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={26} color="#8696A0" />
        </Pressable>

        <TextInput
          style={styles.textInput}
          placeholder="Type a message"
          placeholderTextColor="#8696A0"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4096}
          accessibilityLabel="Message input"
        />

        {hasText ? (
          <Pressable
            onPress={handleSend}
            style={styles.inputAction}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Ionicons name="send" size={22} color="#00A884" />
          </Pressable>
        ) : (
          <Pressable
            onPress={onMicPress}
            style={styles.inputAction}
            accessibilityLabel="Record voice message"
            accessibilityRole="button"
          >
            <Ionicons name="mic" size={24} color="#8696A0" />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  /* Bubble layout */
  bubbleRow: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  bubbleRowSent: {
    justifyContent: 'flex-end',
  },
  bubbleRowReceived: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bubbleSent: {
    backgroundColor: '#005C4B',
    borderRadius: 8,
    borderTopRightRadius: 2,
  },
  bubbleReceived: {
    backgroundColor: '#1F2C33',
    borderRadius: 8,
    borderTopLeftRadius: 2,
  },
  bubbleFailed: {
    opacity: 0.7,
  },

  /* Text message */
  messageText: {
    color: '#E9EDEF',
    fontSize: 15,
    lineHeight: 20,
  },

  /* Timestamp / meta */
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#8696A0',
  },

  /* Media placeholder */
  mediaPlaceholder: {
    width: 200,
    height: 150,
    backgroundColor: '#2A3942',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    color: '#8696A0',
    fontSize: 12,
    marginTop: 4,
  },

  /* Voice */
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
  },
  voiceBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#2A3942',
    borderRadius: 2,
    marginHorizontal: 8,
  },
  voiceTrack: {
    width: '30%',
    height: 4,
    backgroundColor: '#00A884',
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 12,
    color: '#8696A0',
  },

  /* File */
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 160,
  },
  fileInfo: {
    flex: 1,
    marginLeft: 8,
  },
  fileName: {
    fontSize: 14,
    color: '#E9EDEF',
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    color: '#8696A0',
    marginTop: 2,
  },

  /* Input bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1F2C33',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inputAction: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#2A3942',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#E9EDEF',
    fontSize: 15,
    maxHeight: 120,
    minHeight: 40,
  },
});
