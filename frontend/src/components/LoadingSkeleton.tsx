/**
 * LoadingSkeleton
 *
 * Layout:
 *  - chatList: 6 rows, each with a circle (48dp) + two rectangles (name + preview)
 *  - messages: 5 alternating bubble placeholders (left/right, varied widths)
 *  - All shapes use #2A3942 with a pulsing opacity animation (0.3→0.6→0.3)
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface LoadingSkeletonProps {
  type: 'chatList' | 'messages';
}

function usePulse(): Animated.Value {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return opacity;
}

function ChatListSkeleton({ opacity }: { opacity: Animated.Value }) {
  return (
    <View style={styles.container}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Animated.View key={i} style={[styles.chatRow, { opacity }]}>
          <View style={styles.avatarPlaceholder} />
          <View style={styles.chatLines}>
            <View style={styles.nameLine} />
            <View style={styles.messageLine} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const BUBBLE_WIDTHS = ['60%', '45%', '70%', '50%', '55%'];

function MessagesSkeleton({ opacity }: { opacity: Animated.Value }) {
  return (
    <View style={styles.container}>
      {BUBBLE_WIDTHS.map((width, i) => {
        const isSent = i % 2 === 0;
        return (
          <Animated.View
            key={i}
            style={[
              styles.bubblePlaceholder,
              isSent ? styles.bubbleSent : styles.bubbleReceived,
              { width: width as any, opacity },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function LoadingSkeleton({ type }: LoadingSkeletonProps) {
  const opacity = usePulse();

  if (type === 'chatList') {
    return <ChatListSkeleton opacity={opacity} />;
  }
  return <MessagesSkeleton opacity={opacity} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 8,
  },

  /* Chat list skeleton */
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A3942',
  },
  chatLines: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  nameLine: {
    width: '55%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#2A3942',
    marginBottom: 8,
  },
  messageLine: {
    width: '80%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#2A3942',
  },

  /* Messages skeleton */
  bubblePlaceholder: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#2A3942',
    marginVertical: 4,
    marginHorizontal: 8,
  },
  bubbleSent: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 2,
  },
  bubbleReceived: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 2,
  },
});
