/**
 * RegisterScreen
 *
 * Layout (mirrors LoginScreen):
 *  - Centered logo area (chat bubble icon + "Create Account" title)
 *  - Email input with envelope icon
 *  - Password input with lock icon
 *  - Full-width teal Register button (shows spinner when loading)
 *  - Error message area below button
 *  - "Already have an account? Login" link at bottom
 *
 * Wrapped in KeyboardAvoidingView + ScrollView so inputs
 * stay visible when the keyboard is open.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RegisterScreenProps {
  onRegister: (email: string, password: string) => void | Promise<void | boolean>;
  onSwitchToLogin: () => void;
  loading: boolean;
  error: string | null;
}

export default function RegisterScreen({
  onRegister,
  onSwitchToLogin,
  loading,
  error,
}: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleRegister = () => {
    if (!loading) {
      onRegister(email, password);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Area */}
        <View style={styles.logoContainer}>
          <Ionicons name="chatbubbles" size={64} color="#00A884" />
          <Text style={styles.title}>Create Account</Text>
        </View>

        {/* Email Input */}
        <View
          style={[
            styles.inputWrapper,
            emailFocused ? styles.inputWrapperFocused : styles.inputWrapperUnfocused,
          ]}
        >
          <Ionicons
            name="mail-outline"
            size={20}
            color={emailFocused ? '#00A884' : '#8696A0'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Email"
            placeholderTextColor="#8696A0"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email input"
          />
        </View>

        {/* Password Input */}
        <View
          style={[
            styles.inputWrapper,
            passwordFocused ? styles.inputWrapperFocused : styles.inputWrapperUnfocused,
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={passwordFocused ? '#00A884' : '#8696A0'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.textInput}
            placeholder="Password"
            placeholderTextColor="#8696A0"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Password input"
          />
        </View>

        {/* Register Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleRegister}
          disabled={loading}
          accessibilityLabel="Register button"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </Pressable>

        {/* Error Message */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Switch to Login */}
        <Pressable
          onPress={onSwitchToLogin}
          style={styles.switchContainer}
          accessibilityLabel="Switch to login screen"
          accessibilityRole="link"
        >
          <Text style={styles.switchText}>
            Already have an account?{' '}
            <Text style={styles.switchTextAccent}>Login</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111B21',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E9EDEF',
    marginTop: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#1F2C33',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: '#00A884',
  },
  inputWrapperUnfocused: {
    borderColor: '#2A3942',
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 52,
    color: '#E9EDEF',
    fontSize: 15,
  },
  button: {
    height: 52,
    backgroundColor: '#00A884',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    color: '#F15C6D',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  switchContainer: {
    marginTop: 24,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  switchText: {
    color: '#8696A0',
    fontSize: 14,
  },
  switchTextAccent: {
    color: '#00A884',
    fontWeight: '600',
  },
});
