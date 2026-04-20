import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  setAudioModeAsync,
  AudioQuality,
  IOSOutputFormat,
} from 'expo-audio';
import { compressImage, getFileSize } from '../services/compress';
import { generateThumbnail, generateVideoThumbnail } from '../services/thumbnail';
import { uploadMedia } from '../services/upload';
import * as messageStore from '../services/messageStore';
import { useAuth } from '../context/AuthContext';
import { enqueueMessage } from '../services/offlineQueue';

const VOICE_RECORDING_OPTIONS = {
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
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

function generateLocalId(): string {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export function useMediaSend(partnerId: number, addOptimisticMessage: (msg: any) => void) {
  const { user } = useAuth();
  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 1000);
  const [isRecording, setIsRecording] = useState(false);
  const recordingDuration = Math.floor((recorderState.durationMillis || 0) / 1000);

  const sendMedia = useCallback(async (
    uri: string,
    type: 'image' | 'video' | 'voice' | 'file',
    mimeType: string,
    fileName: string,
    thumbnail: string | null = null
  ) => {
    if (!user) return;

    const localId = generateLocalId();
    const now = new Date().toISOString();
    const fileSize = await getFileSize(uri);

    const optimisticMsg = {
      id: localId,
      serverId: null,
      from: user.id,
      to: partnerId,
      type,
      content: null,
      mediaUrl: null,
      thumbnail,
      mimeType,
      fileName,
      fileSize,
      createdAt: now,
      status: 'pending',
    };
    messageStore.saveMessage(optimisticMsg);
    addOptimisticMessage(optimisticMsg);

    try {
      const result = await uploadMedia(uri, mimeType, fileName);

      enqueueMessage('send_message', {
        to: partnerId,
        type,
        content: null,
        localId,
        thumbnail,
        mediaUrl: result.url,
        mimeType: result.mimeType,
        fileName: result.filename,
        fileSize: result.size,
      });
    } catch (e) {
      addOptimisticMessage({ ...optimisticMsg, status: 'failed' });
      console.error('Media send failed:', e);
    }
  }, [partnerId, user, addOptimisticMessage]);

  const takePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera permission needed',
          'Please allow camera access to take photos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const compressed = await compressImage(asset.uri);
      const thumb = await generateThumbnail(compressed).catch(() => '');
      await sendMedia(compressed, 'image', 'image/jpeg', 'photo.jpg', thumb || null);
    } catch (e: any) {
      console.error('takePhoto failed:', e);
      Alert.alert('Camera error', e?.message ?? 'Could not capture photo.');
    }
  }, [sendMedia]);

  const captureVideo = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera permission needed',
          'Please allow camera access to record video.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        quality: 0.5,
        videoMaxDuration: 15,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const thumb = await generateVideoThumbnail(asset.uri).catch(() => '');
      await sendMedia(asset.uri, 'video', 'video/mp4', 'video.mp4', thumb || null);
    } catch (e: any) {
      console.error('captureVideo failed:', e);
      Alert.alert('Camera error', e?.message ?? 'Could not record video.');
    }
  }, [sendMedia]);

  const pickFile = useCallback(async () => {
    // Single unified picker for any file (photo, video, doc, audio, ...).
    // When the user picks an image or video we still generate an inline
    // thumbnail so the chat bubble previews it immediately.
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
        const thumb = await generateThumbnail(asset.uri).catch((e) => {
          console.warn('Image thumbnail generation failed:', e);
          return '';
        });
        await sendMedia(asset.uri, 'image', mimeType, fileName, thumb || null);
        return;
      }

      if (mimeType.startsWith('video/')) {
        const thumb = await generateVideoThumbnail(asset.uri).catch((e) => {
          console.warn('Video thumbnail generation failed:', e);
          return '';
        });
        await sendMedia(asset.uri, 'video', mimeType, fileName, thumb || null);
        return;
      }

      await sendMedia(asset.uri, 'file', mimeType, fileName, null);
    } catch (e: any) {
      console.error('pickFile failed:', e);
      Alert.alert('File error', e?.message ?? 'Could not attach file.');
    }
  }, [sendMedia]);

  const startRecording = useCallback(async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Microphone permission needed',
          'Please allow microphone access to record voice messages.'
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (e: any) {
      console.error('Failed to start recording:', e);
      setIsRecording(false);
      Alert.alert('Recording error', e?.message ?? 'Could not start recording.');
    }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      await recorder.stop();
      const uri = recorder.uri;

      setIsRecording(false);

      if (uri) {
        await sendMedia(uri, 'voice', 'audio/m4a', 'voice.m4a', null);
      }
    } catch (e: any) {
      console.error('Failed to stop recording:', e);
      setIsRecording(false);
      Alert.alert('Recording error', e?.message ?? 'Could not save recording.');
    }
  }, [isRecording, recorder, sendMedia]);

  const cancelRecording = useCallback(async () => {
    if (!isRecording) return;

    try {
      await recorder.stop();
    } catch {}

    setIsRecording(false);
  }, [isRecording, recorder]);

  return {
    takePhoto,
    captureVideo,
    pickFile,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
    recordingDuration,
  };
}
