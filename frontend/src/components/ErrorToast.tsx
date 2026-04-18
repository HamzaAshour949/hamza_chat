/**
 * ErrorToast
 *
 * Layout:
 *  - Positioned at top of screen below safe area, full width
 *  - Danger background (#F15C6D), border-radius 8
 *  - White error text (14sp) on left, close icon on right
 *  - Slides in from top, auto-dismisses after 4 seconds
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ErrorToastProps {
  message: string | null;
  onDismiss: () => void;
}

export default function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (message) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        onDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [message, onDismiss, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <Pressable
          onPress={onDismiss}
          style={styles.closeButton}
          accessibilityLabel="Dismiss error"
          accessibilityRole="button"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#F15C6D',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
