import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useChatList } from '../hooks/useChatList';
import { useMessages } from '../hooks/useMessages';
import { useMediaSend } from '../hooks/useMediaSend';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import AttachmentMenu from '../components/AttachmentMenu';
import VoiceRecorder from '../components/VoiceRecorder';
import NetworkBanner from '../components/NetworkBanner';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainStackParamList = {
  ChatList: undefined;
  Chat: { userId: string; email: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  const { login, register, loading, error } = useAuth();
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {({ navigation }) => (
          <LoginScreen
            onLogin={async (email, password) => {
              try {
                await login(email, password);
              } catch {
                /* surfaced via error */
              }
            }}
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
                await register(email, password);
              } catch {
                /* surfaced via error */
              }
            }}
            onSwitchToLogin={() => navigation.navigate('Login')}
            loading={loading}
            error={error}
          />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function ChatListWrapper({ navigation }: NativeStackScreenProps<MainStackParamList, 'ChatList'>) {
  const { logout } = useAuth();
  const { conversations, searchResults, searchQuery, setSearchQuery, loading } = useChatList();
  return (
    <ChatListScreen
      conversations={conversations}
      searchResults={searchResults}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onOpenChat={(userId, email) => navigation.navigate('Chat', { userId, email })}
      onLogout={logout}
      loading={loading}
    />
  );
}

function ChatWrapper({ route }: NativeStackScreenProps<MainStackParamList, 'Chat'>) {
  const { userId } = route.params;
  const { user } = useAuth();
  const { messages, loading, loadingMore, sendText, loadMore, addOptimisticMessage } = useMessages(userId);
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
        onMessagePatched={addOptimisticMessage}
        loading={loading}
        loadingMore={loadingMore}
      />
      <AttachmentMenu
        visible={showAttachment}
        onClose={() => setShowAttachment(false)}
        onTakePhoto={() => { setShowAttachment(false); mediaSend.takePhoto(); }}
        onCaptureVideo={() => { setShowAttachment(false); mediaSend.captureVideo(); }}
        onPickGallery={() => { setShowAttachment(false); mediaSend.pickGallery(); }}
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
  const connected = useNetworkStatus();
  return (
    <View style={{ flex: 1 }}>
      <NetworkBanner connected={connected} />
      <MainStack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1F2C33' },
          headerTintColor: '#E9EDEF',
        }}
      >
        <MainStack.Screen name="ChatList" component={ChatListWrapper} options={{ headerShown: false }} />
        <MainStack.Screen
          name="Chat"
          component={ChatWrapper}
          options={({ route }) => ({ title: route.params.email })}
        />
      </MainStack.Navigator>
    </View>
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
