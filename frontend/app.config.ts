import 'dotenv/config';

function envString(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export default {
  expo: {
    name: 'Hamza Chat',
    slug: 'hamza-chat',
    version: '2.0.0',
    orientation: 'portrait' as const,
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark' as const,
    newArchEnabled: false,
    splash: {
      backgroundColor: '#111B21',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.chatapp.app',
      infoPlist: {
        NSCameraUsageDescription: 'Used to take photos and videos to send in chat.',
        NSMicrophoneUsageDescription: 'Used to record voice messages.',
        NSPhotoLibraryUsageDescription: 'Used to pick photos and videos to send in chat.',
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
      package: 'com.chatapp.app',
      minSdkVersion: 24,
      versionCode: 2,
      softwareKeyboardLayoutMode: 'resize' as const,
      usesCleartextTraffic: true,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#111B21',
      },
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
      ],
    },
    extra: {
      TEST_ACCOUNT: envString('EXPO_PUBLIC_TEST_ACCOUNT') ?? envString('TEST_ACCOUNT'),
      BACKEND: envString('EXPO_PUBLIC_BACKEND') ?? 'local',
      API_HOST: envString('EXPO_PUBLIC_API_HOST') ?? envString('API_HOST'),
      API_BASE_URL: envString('EXPO_PUBLIC_API_BASE_URL') ?? envString('API_BASE_URL'),
      firebaseApiKey: envString('EXPO_PUBLIC_FIREBASE_API_KEY'),
      firebaseAuthDomain: envString('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
      firebaseProjectId: envString('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
      firebaseStorageBucket: envString('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
      firebaseMessagingSenderId: envString('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
      firebaseAppId: envString('EXPO_PUBLIC_FIREBASE_APP_ID'),
    },
    plugins: [
      './plugins/withCleartext',
      'expo-secure-store',
      'expo-audio',
      'expo-font',
      'expo-sqlite',
      'expo-video',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow $(PRODUCT_NAME) to access photos to send in chat.',
          cameraPermission: 'Allow $(PRODUCT_NAME) to take photos and videos for chat.',
          microphonePermission: 'Allow $(PRODUCT_NAME) to record voice messages.',
        },
      ],
    ],
  },
};
