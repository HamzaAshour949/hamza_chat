/**
 * VerifyEmailScreen
 *
 * Shown after a successful POST /auth/register when the backend (which sends
 * the email via BREVO) reports that email confirmation is required.
 *
 * Layout (mirrors LoginScreen / RegisterScreen):
 *  - Centered logo area (mail icon + "Verify your email" title)
 *  - Subtitle showing the destination email
 *  - 6-digit numeric code input
 *  - Full-width teal Verify button (spinner when loading)
 *  - Error message area
 *  - "Resend code" link
 *  - "Back to login" link at bottom
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

interface VerifyEmailScreenProps {
  email: string;
  onVerify: (email: string, code: string) => Promise<void> | void;
  onResend: (email: string) => Promise<void> | void;
  onBackToLogin: () => void;
  loading: boolean;
  error: string | null;
}

export default function VerifyEmailScreen({
  email,
  onVerify,
  onResend,
  onBackToLogin,
  loading,
  error,
}: VerifyEmailScreenProps) {
  const [code, setCode] = useState('');
  const [codeFocused, setCodeFocused] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleVerify = () => {
    if (loading || code.length !== 6) return;
    onVerify(email, code.trim());
  };

  const handleResend = async () => {
    if (resending) return;
    setResendStatus(null);
    setResending(true);
    try {
      await onResend(email);
      setResendStatus('A new code has been sent to your email.');
    } catch {
      // Error surfaced via context `error` prop; nothing extra to do here.
    } finally {
      setResending(false);
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
          <Ionicons name="mail-unread-outline" size={64} color="#00A884" />
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation code to{'\n'}
            <Text style={styles.subtitleAccent}>{email}</Text>
          </Text>
        </View>

        {/* Code Input */}
        <View
          style={[
            styles.inputWrapper,
            codeFocused ? styles.inputWrapperFocused : styles.inputWrapperUnfocused,
          ]}
        >
          <Ionicons
            name="key-outline"
            size={20}
            color={codeFocused ? '#00A884' : '#8696A0'}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.textInput}
            placeholder="6-digit code"
            placeholderTextColor="#8696A0"
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={6}
            accessibilityLabel="Verification code input"
          />
        </View>

        {/* Verify Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
            (loading || code.length !== 6) && styles.buttonDisabled,
          ]}
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
          accessibilityLabel="Verify email button"
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </Pressable>

        {/* Error / status messages */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {resendStatus ? <Text style={styles.statusText}>{resendStatus}</Text> : null}

        {/* Resend code */}
        <Pressable
          onPress={handleResend}
          style={styles.linkContainer}
          disabled={resending}
          accessibilityLabel="Resend verification code"
          accessibilityRole="button"
        >
          <Text style={styles.switchText}>
            Didn&apos;t get the code?{' '}
            <Text style={styles.switchTextAccent}>
              {resending ? 'Sending…' : 'Resend'}
            </Text>
          </Text>
        </Pressable>

        {/* Back to login */}
        <Pressable
          onPress={onBackToLogin}
          style={styles.linkContainer}
          accessibilityLabel="Back to login screen"
          accessibilityRole="link"
        >
          <Text style={styles.switchText}>
            <Text style={styles.switchTextAccent}>Back to Login</Text>
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
  subtitle: {
    fontSize: 14,
    color: '#8696A0',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  subtitleAccent: {
    color: '#E9EDEF',
    fontWeight: '600',
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
    fontSize: 18,
    letterSpacing: 4,
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
  buttonDisabled: {
    opacity: 0.5,
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
  statusText: {
    color: '#00A884',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  linkContainer: {
    marginTop: 20,
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
