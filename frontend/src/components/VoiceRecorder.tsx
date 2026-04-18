/**
 * VoiceRecorder — Recording Overlay Bar
 *
 * Layout:
 *  - Full-width bar pinned to the bottom, background #1F2C33
 *  - Left: pulsing red dot + recording duration (M:SS)
 *  - Center: left-arrow icon + "Slide to cancel" in secondary text
 *  - Right: large teal mic icon (send action)
 *
 * The red dot pulses opacity 0.3→1.0 via Animated.loop.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceRecorderProps {
  visible: boolean;
  duration: number; // seconds
  onCancel: () => void;
  onSend: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceRecorder({
  visible,
  duration,
  onCancel,
  onSend,
}: VoiceRecorderProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [visible, pulseAnim]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Left: pulsing red dot + timer */}
      <View style={styles.left}>
        <Animated.View style={[styles.redDot, { opacity: pulseAnim }]} />
        <Text style={styles.timer}>{formatDuration(duration)}</Text>
      </View>

      {/* Center: slide to cancel */}
      <Pressable
        onPress={onCancel}
        style={styles.center}
        accessibilityLabel="Cancel recording"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-back" size={18} color="#8696A0" />
        <Text style={styles.cancelText}>Slide to cancel</Text>
      </Pressable>

      {/* Right: send mic button */}
      <Pressable
        onPress={onSend}
        style={styles.micButton}
        accessibilityLabel="Send voice message"
        accessibilityRole="button"
      >
        <Ionicons name="mic" size={28} color="#00A884" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2C33',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F15C6D',
  },
  timer: {
    color: '#E9EDEF',
    fontSize: 15,
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  cancelText: {
    color: '#8696A0',
    fontSize: 15,
    marginLeft: 4,
  },
  micButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
