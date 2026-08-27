import 'dotenv/config';

function envString(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export default {
  expo: {
    name: 'ChatApp',
    slug: 'chatapp',
    version: '1.0.0',
    orientation: 'portrait' as const,
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark' as const,
    newArchEnabled: true,
    splash: {
      backgroundColor: '#111B21',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.chatapp.app',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#111B21',
      },
      package: 'com.chatapp.app',
    },
    extra: {
      TEST_ACCOUNT: envString('TEST_ACCOUNT'),
      // Local/dev host fallback. For production, prefer API_BASE_URL and WS_URL.
      API_HOST: envString('API_HOST'),
      API_BASE_URL: envString('API_BASE_URL'),
      WS_URL: envString('WS_URL'),
    },
    plugins: [
      'expo-secure-store',
      'expo-audio',
      'expo-font',
      [
        '@config-plugins/react-native-webrtc',
        {
          cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera for video calls',
          microphonePermission: 'Allow $(PRODUCT_NAME) to access your microphone for calls',
        },
      ],
    ],
  },
};
