import React from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[fonts] loaded=', fontsLoaded, 'error=', fontError?.message, 'Ionicons.font=', JSON.stringify(Ionicons.font));
  }

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111B21', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00A884" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#111B21" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
