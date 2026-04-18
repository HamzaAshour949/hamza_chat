/**
 * EmptyState
 *
 * Layout:
 *  - Centered vertically and horizontally in parent (flex: 1)
 *  - Large Ionicon (64dp, secondary tint)
 *  - Title below icon (17sp semi-bold, primary text)
 *  - Optional subtitle below title (14sp, secondary text)
 *  - Spacing: 16dp icon→title, 8dp title→subtitle
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={64} color="#8696A0" />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#E9EDEF',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8696A0',
    marginTop: 8,
    textAlign: 'center',
  },
});
