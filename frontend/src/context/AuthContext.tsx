import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setToken, getToken, removeToken } from '../services/api';
import Constants from 'expo-constants';

interface User {
  id: number;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  /** Email awaiting confirmation after register; null if no pending verification. */
  pendingVerificationEmail: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  /** Returns true if email verification is required before login completes. */
  register: (email: string, password: string) => Promise<boolean>;
  /** Confirm the code emailed to the user. On success, the user is logged in. */
  verifyEmail: (email: string, code: string) => Promise<void>;
  /** Ask the backend to send a fresh verification code to the email. */
  resendVerification: (email: string) => Promise<void>;
  /** Cancel the pending verification (e.g. user navigates back to login). */
  cancelVerification: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  // Auto-login on app launch
  useEffect(() => {
    checkToken();
  }, []);

  async function checkToken() {
    try {
      const token = await getToken();
      if (token) {
        // Decode the JWT payload locally to check expiry and get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.userId, email: '' });
        } else {
          await removeToken();
        }
      }
    } catch {
      await removeToken();
    } finally {
      setLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      // Backend may respond with { pendingVerification: true, email } for
      // accounts whose email hasn't been confirmed yet (a fresh code is
      // re-sent automatically). In that case we return true so the
      // navigator can push the VerifyEmail screen.
      const data = await api<{
        token?: string;
        user?: User;
        pendingVerification?: boolean;
        email?: string;
      }>('/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      if (data.token && data.user) {
        await setToken(data.token);
        setUser(data.user);
        setPendingVerificationEmail(null);
        return false;
      }
      setPendingVerificationEmail(data.email ?? email);
      return true;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Login failed';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      // Backend (using BREVO) emails a verification code and returns
      // { pendingVerification: true, email } instead of a token.
      // For backwards compatibility, if a token is returned the user is logged
      // in directly.
      const data = await api<{
        token?: string;
        user?: User;
        pendingVerification?: boolean;
        email?: string;
      }>('/auth/register', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      if (data.token && data.user) {
        await setToken(data.token);
        setUser(data.user);
        setPendingVerificationEmail(null);
        return false;
      } else {
        setPendingVerificationEmail(data.email ?? email);
        return true;
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Registration failed';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ token: string; user: User }>('/auth/verify-email', {
        method: 'POST',
        body: { email, code },
        auth: false,
      });
      await setToken(data.token);
      setUser(data.user);
      setPendingVerificationEmail(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Verification failed';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    setError(null);
    try {
      await api<{ ok: boolean }>('/auth/resend-verification', {
        method: 'POST',
        body: { email },
        auth: false,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to resend code';
      setError(message);
      throw e;
    }
  }, []);

  const cancelVerification = useCallback(() => {
    setPendingVerificationEmail(null);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    await removeToken();
    setUser(null);
    setError(null);
  }, []);

  // TEST_ACCOUNT auto-login support
  useEffect(() => {
    if (loading || user) return;

    const testAccount = Constants.expoConfig?.extra?.TEST_ACCOUNT;
    if (testAccount === '0' || testAccount === '1') {
      const accounts = [
        { email: 'test1@test.com', password: 'password123' },
        { email: 'test2@test.com', password: 'password123' },
      ];
      const acc = accounts[Number(testAccount)];
      if (acc) {
        login(acc.email, acc.password).catch(() => {});
      }
    }
  }, [loading, user, login]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        pendingVerificationEmail,
        login,
        register,
        verifyEmail,
        resendVerification,
        cancelVerification,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
