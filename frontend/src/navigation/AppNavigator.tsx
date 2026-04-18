import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { CallProvider, useCall } from '../context/CallContext';
import { connectSocket, disconnectSocket } from '../services/socket';
import { initDB } from '../services/messageStore';
import { getToken } from '../services/api';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import AttachmentMenu from '../components/AttachmentMenu';
import VoiceRecorder from '../components/VoiceRecorder';
import { useChatList } from '../hooks/useChatList';
import { useMessages } from '../hooks/useMessages';
import { useMediaSend } from '../hooks/useMediaSend';
import { ActivityIndicator, View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import NetworkBanner from '../components/NetworkBanner';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: undefined;
};

export type MainStackParamList = {
  ChatList: undefined;
  Chat: { userId: number; email: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  const {
    login,
    register,
    verifyEmail,
    resendVerification,
    cancelVerification,
    pendingVerificationEmail,
    loading,
    error,
  } = useAuth();

  // When the backend signals that email verification is required, the Register
  // screen navigates to VerifyEmail; `pendingVerificationEmail` from context
  // tells the verify screen which address to confirm.
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onLogin={login}
            onSwitchToRegister={() => navigation.navigate('Register')}
            loading={loading}
            error={error}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {({ navigation }) => (
          <RegisterScreen
            onRegister={async (email, password) => {
              try {
                const needsVerification = await register(email, password);
                // Only navigate to VerifyEmail if the backend asked for email
                // confirmation. If a token was issued (legacy path), `user`
                // becomes non-null and AppNavigator will unmount this stack.
                if (needsVerification) {
                  navigation.navigate('VerifyEmail');
                }
              } catch {
                // error is surfaced through the `error` prop
              }
            }}
            onSwitchToLogin={() => navigation.navigate('Login')}
            loading={loading}
            error={error}
          />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="VerifyEmail">
        {({ navigation }) => (
          <VerifyEmailScreen
            email={pendingVerificationEmail ?? ''}
            onVerify={verifyEmail}
            onResend={resendVerification}
            onBackToLogin={() => {
              cancelVerification();
              navigation.navigate('Login');
            }}
            loading={loading}
            error={error}
          />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function ChatHeaderRight({ userId, email }: { userId: number; email: string }) {
  const { startCall } = useCall();
  return (
    <View style={{ flexDirection: 'row', gap: 20, marginRight: 4 }}>
      <Pressable
        onPress={() => startCall(userId, email, 'video')}
        accessibilityLabel="Video call"
        hitSlop={8}
      >
        <Ionicons name="videocam-outline" size={23} color="#E9EDEF" />
      </Pressable>
      <Pressable
        onPress={() => startCall(userId, email, 'voice')}
        accessibilityLabel="Voice call"
        hitSlop={8}
      >
        <Ionicons name="call-outline" size={21} color="#E9EDEF" />
      </Pressable>
    </View>
  );
}

function ChatListWrapper({
  navigation,
}: NativeStackScreenProps<MainStackParamList, 'ChatList'>) {
  const { logout } = useAuth();
  const { conversations, searchResults, searchQuery, setSearchQuery, loading } =
    useChatList();

  return (
    <ChatListScreen
      conversations={conversations}
      searchResults={searchResults}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onOpenChat={(userId: number, email: string) =>
        navigation.navigate('Chat', { userId, email })
      }
      onLogout={logout}
      loading={loading}
    />
  );
}

function ChatWrapper({
  route,
}: NativeStackScreenProps<MainStackParamList, 'Chat'>) {
  const { userId } = route.params;
  const { user } = useAuth();
  const { messages, loading, loadingMore, sendText, loadMore, addOptimisticMessage } =
    useMessages(userId);
  const mediaSend = useMediaSend(userId, addOptimisticMessage);
  const [showAttachment, setShowAttachment] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: '#111B21' }}>
      <ChatScreen
        messages={messages}
        currentUserId={user!.id}
        onSendText={sendText}
        onAttachPress={() => setShowAttachment(true)}
        onMicPress={mediaSend.startRecording}
        onLoadMore={loadMore}
        loading={loading}
        loadingMore={loadingMore}
      />
      <AttachmentMenu
        visible={showAttachment}
        onClose={() => setShowAttachment(false)}
        onPickGallery={() => { setShowAttachment(false); mediaSend.pickImage(); }}
        onOpenCamera={() => { setShowAttachment(false); mediaSend.takePhoto(); }}
        onPickVideo={() => { setShowAttachment(false); mediaSend.pickVideo(); }}
        onRecordVideo={() => { setShowAttachment(false); mediaSend.recordVideo(); }}
        onPickFile={() => { setShowAttachment(false); mediaSend.pickFile(); }}
      />
      <VoiceRecorder
        visible={mediaSend.isRecording}
        duration={mediaSend.recordingDuration}
        onCancel={mediaSend.cancelRecording}
        onSend={mediaSend.stopRecording}
      />
    </View>
  );
}

function MainNavigator() {
  const { user } = useAuth();
  const connected = useNetworkStatus();

  useEffect(() => {
    let mounted = true;
    async function connect() {
      await initDB();
      const token = await getToken();
      if (token && mounted) {
        connectSocket(token);
      }
    }
    connect();
    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [user]);

  return (
    <CallProvider>
      <View style={{ flex: 1 }}>
        <NetworkBanner connected={connected} />
        <MainStack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#1F2C33' },
            headerTintColor: '#E9EDEF',
          }}
        >
          <MainStack.Screen
            name="ChatList"
            component={ChatListWrapper}
            options={{ headerShown: false }}
          />
          <MainStack.Screen
            name="Chat"
            component={ChatWrapper}
            options={({ route }) => ({
              title: route.params.email,
              headerRight: () => (
                <ChatHeaderRight
                  userId={route.params.userId}
                  email={route.params.email}
                />
              ),
            })}
          />
        </MainStack.Navigator>
      </View>
    </CallProvider>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#00A884" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#111B21',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
