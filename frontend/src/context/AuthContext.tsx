import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Constants from 'expo-constants';
import type { User } from '../types';
import { getBackend, resetBackend } from '../backend';
import { clearSession, getStoredUser, getToken, setSession } from '../services/authStore';
import { initDB } from '../services/messageStore';
import { flushQueue } from '../services/offlineQueue';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

let stopConn: (() => void) | null = null;

async function bootSession(token: string, user: User): Promise<void> {
  await initDB();
  const backend = getBackend();
  backend.connect(token);
  stopConn?.();
  stopConn = backend.onConnectionChange((connected) => {
    if (connected) flushQueue().catch(() => {});
  });
  await setSession(token, user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDB();
        const token = await getToken();
        const stored = await getStoredUser();
        if (!token) return;
        const backend = getBackend();
        try {
          const me = await backend.me(token);
          if (cancelled) return;
          await bootSession(token, me);
          setUser(me);
        } catch {
          if (stored) {
            await bootSession(token, stored);
            if (!cancelled) setUser(stored);
          } else {
            await clearSession();
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const backend = getBackend();
      const data = await backend.login(email.trim().toLowerCase(), password);
      await bootSession(data.token, data.user);
      setUser(data.user);
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
      const backend = getBackend();
      const data = await backend.register(email.trim().toLowerCase(), password);
      await bootSession(data.token, data.user);
      setUser(data.user);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Registration failed';
      setError(message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    stopConn?.();
    stopConn = null;
    resetBackend();
    await clearSession();
    setUser(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (loading || user) return;
    const testAccount = Constants.expoConfig?.extra?.TEST_ACCOUNT;
    if (testAccount === '0' || testAccount === '1') {
      const accounts = [
        { email: 'test1@test.com', password: 'password123' },
        { email: 'test2@test.com', password: 'password123' },
      ];
      const acc = accounts[Number(testAccount)];
      if (acc) login(acc.email, acc.password).catch(() => {});
    }
  }, [loading, user, login]);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
