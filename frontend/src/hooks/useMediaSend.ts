import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { compressImage, getFileSize } from '../services/compress';
import { generateThumbnail, generateVideoThumbnail } from '../services/thumbnail';
import * as messageStore from '../services/messageStore';
import { enqueueMessage } from '../services/offlineQueue';
import { useAuth } from '../context/AuthContext';
import { getBackend } from '../backend';
import type { Message, MessageType } from '../types';

const VIDEO_WARN_BYTES = 800 * 1024;

const VOICE_RECORDING_OPTIONS = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 24000,
  android: {
    outputFormat: 'mpeg4' as const,
    audioEncoder: 'aac' as const,
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.LOW,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

function localId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useMediaSend(partnerId: string, addOptimisticMessage: (msg: Message) => void) {
  const { user } = useAuth();
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 1000);
  const [isRecording, setIsRecording] = useState(false);
  const recordingDuration = Math.floor((recorderState.durationMillis || 0) / 1000);

  const sendMedia = useCallback(
    async (
      uri: string,
      type: Exclude<MessageType, 'text'>,
      mimeType: string,
      fileName: string,
      thumbnail: string | null = null,
    ) => {
      if (!user) return;
      const id = localId();
      const now = new Date().toISOString();
      const fileSize = await getFileSize(uri);
      const optimistic: Message = {
        id,
        serverId: null,
        from: user.id,
        to: partnerId,
        type,
        content: null,
        mediaUrl: null,
        localUri: uri,
        thumbnail,
        mimeType,
        fileName,
        fileSize,
        createdAt: now,
        status: 'uploading',
      };
      await messageStore.saveMessage(optimistic);
      addOptimisticMessage(optimistic);

      try {
        const result = await getBackend().uploadMedia(uri, mimeType, fileName);
        const uploaded: Message = {
          ...optimistic,
          mediaUrl: result.url,
          mimeType: result.mimeType,
          fileName: result.filename,
          fileSize: result.size,
          status: 'pending',
        };
        await messageStore.saveMessage(uploaded);
        addOptimisticMessage(uploaded);
        await enqueueMessage({
          localId: id,
          to: partnerId,
          type,
          content: null,
          thumbnail,
          mediaUrl: result.url,
          mimeType: result.mimeType,
          fileName: result.filename,
          fileSize: result.size,
        });
      } catch (e) {
        const failed: Message = { ...optimistic, status: 'failed' };
        await messageStore.saveMessage(failed);
        addOptimisticMessage(failed);
        console.error('Media send failed:', e);
      }
    },
    [partnerId, user, addOptimisticMessage],
  );

  const takePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Please allow camera access to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.5,
      });
      if (result.canceled || !result.assets[0]) return;
      const compressed = await compressImage(result.assets[0].uri);
      const thumb = await generateThumbnail(compressed).catch(() => '');
      await sendMedia(compressed, 'image', 'image/jpeg', 'photo.jpg', thumb || null);
    } catch (e: unknown) {
      Alert.alert('Camera error', e instanceof Error ? e.message : 'Could not capture photo.');
    }
  }, [sendMedia]);

  const captureVideo = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Please allow camera access to record video.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        quality: 0.2,
        videoMaxDuration: 12,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType?.Low,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const size = await getFileSize(asset.uri);
      if (size > VIDEO_WARN_BYTES) {
        Alert.alert('Large video', 'This video is large for a slow connection. Sending anyway.');
      }
      const thumb = await generateVideoThumbnail(asset.uri).catch(() => '');
      await sendMedia(asset.uri, 'video', asset.mimeType || 'video/mp4', 'video.mp4', thumb || null);
    } catch (e: unknown) {
      Alert.alert('Camera error', e instanceof Error ? e.message : 'Could not record video.');
    }
  }, [sendMedia]);

  const pickGallery = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos permission needed', 'Please allow photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.5,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType?.Low,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.type === 'video') {
        const thumb = await generateVideoThumbnail(asset.uri).catch(() => '');
        await sendMedia(asset.uri, 'video', asset.mimeType || 'video/mp4', asset.fileName || 'video.mp4', thumb || null);
        return;
      }
      const compressed = await compressImage(asset.uri);
      const thumb = await generateThumbnail(compressed).catch(() => '');
      await sendMedia(compressed, 'image', 'image/jpeg', 'photo.jpg', thumb || null);
    } catch (e: unknown) {
      Alert.alert('Gallery error', e instanceof Error ? e.message : 'Could not open gallery.');
    }
  }, [sendMedia]);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'application/octet-stream';
      const fileName = asset.name || 'file';
      if (mimeType.startsWith('image/')) {
        const compressed = await compressImage(asset.uri);
        const thumb = await generateThumbnail(compressed).catch(() => '');
        await sendMedia(compressed, 'image', 'image/jpeg', fileName, thumb || null);
        return;
      }
      if (mimeType.startsWith('video/')) {
        const thumb = await generateVideoThumbnail(asset.uri).catch(() => '');
        await sendMedia(asset.uri, 'video', mimeType, fileName, thumb || null);
        return;
      }
      await sendMedia(asset.uri, 'file', mimeType, fileName, null);
    } catch (e: unknown) {
      Alert.alert('File error', e instanceof Error ? e.message : 'Could not attach file.');
    }
  }, [sendMedia]);

  const startRecording = useCallback(async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone permission needed', 'Please allow microphone access to record voice messages.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (e: unknown) {
      setIsRecording(false);
      Alert.alert('Recording error', e instanceof Error ? e.message : 'Could not start recording.');
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      setIsRecording(false);
      if (uri) await sendMedia(uri, 'voice', 'audio/m4a', 'voice.m4a', null);
    } catch (e: unknown) {
      setIsRecording(false);
      Alert.alert('Recording error', e instanceof Error ? e.message : 'Could not save recording.');
    }
  }, [isRecording, recorder, sendMedia]);

  const cancelRecording = useCallback(async () => {
    if (!isRecording) return;
    try {
      await recorder.stop();
    } catch {
      /* ignore */
    }
    setIsRecording(false);
  }, [isRecording, recorder]);

  return {
    takePhoto,
    captureVideo,
    pickGallery,
    pickFile,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
    recordingDuration,
  };
}
