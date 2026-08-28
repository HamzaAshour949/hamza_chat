import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getBackend } from '../backend';
import { downloadMedia, filenameFromUrl } from '../services/mediaCache';
import { updateLocalUri } from '../services/messageStore';
import type { Message } from '../types';

interface ChatScreenProps {
  messages: Message[];
  currentUserId: string;
  onSendText: (text: string) => void;
  onAttachPress: () => void;
  onMicPress: () => void;
  onLoadMore: () => void;
  onMessagePatched: (msg: Message) => void;
  loading: boolean;
  loadingMore: boolean;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function ensureLocal(message: Message): Promise<string | null> {
  if (message.localUri) return message.localUri;
  const remote = getBackend().resolveMediaUrl(message.mediaUrl);
  if (!remote) return null;
  const name = filenameFromUrl(remote, `${message.id}.bin`);
  return downloadMedia(remote, name);
}

function VoiceContent({
  message,
  onPatched,
}: {
  message: Message;
  onPatched: (msg: Message) => void;
}) {
  const [loading, setLoading] = useState(false);
  const player = useAudioPlayer(message.localUri ? { uri: message.localUri } : null);
  const status = useAudioPlayerStatus(player);

  const toggle = async () => {
    if (!message.localUri) {
      setLoading(true);
      try {
        const uri = await ensureLocal(message);
        if (uri) {
          const next = { ...message, localUri: uri };
          await updateLocalUri(message.id, uri);
          onPatched(next);
        }
      } finally {
        setLoading(false);
      }
      return;
    }
    if (status.playing) player.pause();
    else player.play();
  };

  return (
    <Pressable style={styles.voiceContainer} onPress={toggle} accessibilityLabel="Voice message">
      {loading ? (
        <ActivityIndicator color="#E9EDEF" />
      ) : (
        <Ionicons name={status.playing ? 'pause' : 'play'} size={24} color="#E9EDEF" />
      )}
      <View style={styles.voiceBar}>
        <View style={[styles.voiceTrack, { width: message.localUri ? '60%' : '20%' }]} />
      </View>
      <Text style={styles.voiceDuration}>
        {message.localUri ? formatFileSize(message.fileSize) : 'Tap'}
      </Text>
    </Pressable>
  );
}

function MediaPreview({
  message,
  onOpen,
  loading,
}: {
  message: Message;
  onOpen: () => void;
  loading: boolean;
}) {
  const preview = message.thumbnail || (message.type === 'image' ? message.localUri : null);
  return (
    <Pressable style={styles.mediaPlaceholder} onPress={onOpen} accessibilityLabel={message.type}>
      {preview ? (
        <Image source={{ uri: preview }} style={styles.mediaImage} resizeMode="cover" />
      ) : (
        <Ionicons name={message.type === 'video' ? 'videocam-outline' : 'image-outline'} size={32} color="#8696A0" />
      )}
      {message.type === 'video' && (
        <View style={styles.videoPlayOverlay} pointerEvents="none">
          <Ionicons name="play-circle" size={44} color="rgba(255,255,255,0.9)" />
        </View>
      )}
      {loading && (
        <View style={styles.videoPlayOverlay}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      )}
      {!message.localUri && !loading && (
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap to load · {formatFileSize(message.fileSize)}</Text>
        </View>
      )}
    </Pressable>
  );
}

function FileContent({ message }: { message: Message }) {
  return (
    <View style={styles.fileContainer} accessibilityLabel={`File: ${message.fileName ?? 'Unknown'}`}>
      <Ionicons name="document-outline" size={28} color="#8696A0" />
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{message.fileName ?? 'File'}</Text>
        {message.fileSize ? <Text style={styles.fileSize}>{formatFileSize(message.fileSize)}</Text> : null}
      </View>
    </View>
  );
}

function ImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewer} onPress={onClose}>
        <Image source={{ uri }} style={styles.viewerImage} resizeMode="contain" />
      </Pressable>
    </Modal>
  );
}

function VideoViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        <VideoView player={player} style={styles.viewerImage} nativeControls contentFit="contain" />
        <Pressable style={styles.viewerClose} onPress={onClose} accessibilityLabel="Close video">
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

function MessageBubble({
  message,
  isSent,
  onPatched,
}: {
  message: Message;
  isSent: boolean;
  onPatched: (msg: Message) => void;
}) {
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [viewUri, setViewUri] = useState<string | null>(null);
  const isFailed = message.status === 'failed';
  const isPending = message.status === 'pending' || message.status === 'uploading';

  const openMedia = async () => {
    setLoadingMedia(true);
    try {
      const uri = await ensureLocal(message);
      if (uri) {
        if (!message.localUri) {
          const next = { ...message, localUri: uri };
          await updateLocalUri(message.id, uri);
          onPatched(next);
        }
        setViewUri(uri);
      }
    } finally {
      setLoadingMedia(false);
    }
  };

  return (
    <View style={[styles.bubbleRow, isSent ? styles.bubbleRowSent : styles.bubbleRowReceived]}>
      <View style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived, isFailed && styles.bubbleFailed]}>
        {message.type === 'text' && <Text style={styles.messageText}>{message.content}</Text>}
        {(message.type === 'image' || message.type === 'video') && (
          <MediaPreview message={message} onOpen={openMedia} loading={loadingMedia} />
        )}
        {message.type === 'voice' && <VoiceContent message={message} onPatched={onPatched} />}
        {message.type === 'file' && <FileContent message={message} />}
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
      {viewUri && message.type === 'image' && <ImageViewer uri={viewUri} onClose={() => setViewUri(null)} />}
      {viewUri && message.type === 'video' && <VideoViewer uri={viewUri} onClose={() => setViewUri(null)} />}
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
  onMessagePatched,
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
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isSent={item.from === currentUserId}
              onPatched={onMessagePatched}
            />
          )}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color="#00A884" />
              </View>
            ) : null
          }
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: 8 + insets.bottom }]}>
        <Pressable onPress={onAttachPress} style={styles.inputAction} accessibilityLabel="Add attachment">
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
          <Pressable onPress={handleSend} style={styles.inputAction} accessibilityLabel="Send message">
            <Ionicons name="send" size={22} color="#00A884" />
          </Pressable>
        ) : (
          <Pressable onPress={onMicPress} style={styles.inputAction} accessibilityLabel="Record voice message">
            <Ionicons name="mic" size={24} color="#8696A0" />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111B21' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingHorizontal: 8, paddingVertical: 8 },
  loadingMore: { paddingVertical: 16, alignItems: 'center' },
  bubbleRow: { flexDirection: 'row', marginVertical: 2, paddingHorizontal: 4 },
  bubbleRowSent: { justifyContent: 'flex-end' },
  bubbleRowReceived: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  bubbleSent: { backgroundColor: '#005C4B', borderRadius: 8, borderTopRightRadius: 2 },
  bubbleReceived: { backgroundColor: '#1F2C33', borderRadius: 8, borderTopLeftRadius: 2 },
  bubbleFailed: { opacity: 0.7 },
  messageText: { color: '#E9EDEF', fontSize: 15, lineHeight: 20 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, marginBottom: 2 },
  timestamp: { fontSize: 11, color: '#8696A0' },
  mediaPlaceholder: {
    width: 200,
    height: 150,
    backgroundColor: '#2A3942',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mediaImage: { width: '100%', height: '100%' },
  videoPlayOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tapHint: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  tapHintText: { color: '#E9EDEF', fontSize: 11, textAlign: 'center' },
  voiceContainer: { flexDirection: 'row', alignItems: 'center', minWidth: 180 },
  voiceBar: { flex: 1, height: 4, backgroundColor: '#2A3942', borderRadius: 2, marginHorizontal: 8 },
  voiceTrack: { height: 4, backgroundColor: '#00A884', borderRadius: 2 },
  voiceDuration: { fontSize: 12, color: '#8696A0' },
  fileContainer: { flexDirection: 'row', alignItems: 'center', minWidth: 160 },
  fileInfo: { flex: 1, marginLeft: 8 },
  fileName: { fontSize: 14, color: '#E9EDEF', fontWeight: '500' },
  fileSize: { fontSize: 12, color: '#8696A0', marginTop: 2 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1F2C33',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  inputAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
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
  viewer: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: 40, right: 16, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
