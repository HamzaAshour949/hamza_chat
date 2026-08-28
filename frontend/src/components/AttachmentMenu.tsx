import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onCaptureVideo: () => void;
  onPickGallery: () => void;
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
    <Pressable onPress={onPress} style={styles.optionButton} accessibilityLabel={label} accessibilityRole="button">
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
  onTakePhoto,
  onCaptureVideo,
  onPickGallery,
  onPickFile,
}: AttachmentMenuProps) {
  const options: MenuOption[] = [
    { icon: 'camera', label: 'Photo', onPress: onTakePhoto, iconColor: '#00A884' },
    { icon: 'videocam', label: 'Video', onPress: onCaptureVideo, iconColor: '#00A884' },
    { icon: 'images', label: 'Gallery', onPress: onPickGallery, iconColor: '#00A884' },
    { icon: 'document', label: 'File', onPress: onPickFile, iconColor: '#00A884' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close attachment menu">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.row}>
            {options.map((opt) => (
              <OptionButton key={opt.label} {...opt} />
            ))}
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
