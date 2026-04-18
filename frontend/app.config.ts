import 'dotenv/config';

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
      TEST_ACCOUNT: process.env.TEST_ACCOUNT ?? null,
      // Set this to your server's domain/IP for production builds.
      // e.g. API_HOST=myserver.com npx eas build
      API_HOST: process.env.API_HOST ?? null,
    },
    plugins: [
      'expo-secure-store',
      'expo-audio',
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
