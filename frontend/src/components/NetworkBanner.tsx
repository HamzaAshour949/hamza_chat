/**
 * NetworkBanner
 *
 * Layout:
 *  - Full-width bar at top, 28dp height, danger background
 *  - "Connecting..." text centered in white (14sp)
 *  - Hidden (returns null) when connected
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface NetworkBannerProps {
  connected: boolean;
}

export default function NetworkBanner({ connected }: NetworkBannerProps) {
  if (connected) return null;

  return (
    <View style={styles.banner} accessibilityLabel="No network connection">
      <Text style={styles.text}>Connecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 28,
    backgroundColor: '#F15C6D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    color: '#FFFFFF',
  },
});
