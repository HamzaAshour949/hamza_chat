/**
 * AttachmentMenu — Bottom Sheet Overlay
 *
 * Layout:
 *  - Semi-transparent overlay (rgba(0,0,0,0.5)), tap to dismiss
 *  - Bottom sheet: #1F2C33 surface, top-radius 16, padding 24
 *  - 2×3 grid of circular icon options (48dp circle on #2A3942)
 *    Row 1: Gallery, Camera, Video
 *    Row 2: Record Video, File, Cancel (danger red)
 *  - Each option ≥ 80×80 dp touch target
 */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onOpenCamera: () => void;
  onPickVideo: () => void;
  onRecordVideo: () => void;
  onPickFile: () => void;
}

interface MenuOption {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  iconColor: string;
}

function OptionButton({ icon, label, onPress, iconColor }: MenuOption) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.optionButton}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function AttachmentMenu({
  visible,
  onClose,
  onPickGallery,
  onOpenCamera,
  onPickVideo,
  onRecordVideo,
  onPickFile,
}: AttachmentMenuProps) {
  const row1: MenuOption[] = [
    { icon: 'images', label: 'Gallery', onPress: onPickGallery, iconColor: '#00A884' },
    { icon: 'camera', label: 'Camera', onPress: onOpenCamera, iconColor: '#00A884' },
    { icon: 'videocam', label: 'Video', onPress: onPickVideo, iconColor: '#00A884' },
  ];

  const row2: MenuOption[] = [
    { icon: 'film', label: 'Record Video', onPress: onRecordVideo, iconColor: '#00A884' },
    { icon: 'document', label: 'File', onPress: onPickFile, iconColor: '#00A884' },
    { icon: 'close-circle', label: 'Cancel', onPress: onClose, iconColor: '#F15C6D' },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityLabel="Close attachment menu"
        accessibilityRole="button"
      >
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grid}>
            <View style={styles.row}>
              {row1.map((opt) => (
                <OptionButton key={opt.label} {...opt} />
              ))}
            </View>
            <View style={styles.row}>
              {row2.map((opt) => (
                <OptionButton key={opt.label} {...opt} />
              ))}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1F2C33',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  grid: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  optionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 80,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A3942',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: '#8696A0',
    fontSize: 12,
    marginTop: 8,
  },
});
