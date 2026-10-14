import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const verification = useRef(null);

  const refreshUser = useCallback(async () => {
    verification.current?.abort();
    const controller = new AbortController();
    verification.current = controller;
    setLoading(true);
    setSessionError(false);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data } = await api.get('/auth/me', { signal: controller.signal });
          if (!controller.signal.aborted) setUser(data.data.user);
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          const status = error.response?.status;
          if (status === 401) { setUser(null); return; }
          const recoverable = !status || status === 429 || status >= 500;
          const retryAfter = error.response?.headers?.['retry-after'];
          const retryDelay = retryAfter === undefined ? 250 * (attempt + 1)
            : Math.max(0, Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now());
          // Long rate-limit windows require explicit recovery, rather than a timer loop.
          if (!recoverable || attempt === 2 || !Number.isFinite(retryDelay) || retryDelay > 2000) {
            setSessionError(true);
            return;
          }
          await new Promise((resolve) => {
            const finish = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
            const timer = setTimeout(finish, retryDelay);
            controller.signal.addEventListener('abort', finish, { once: true });
          });
          if (controller.signal.aborted) return;
        }
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshUser(); return () => verification.current?.abort(); }, [refreshUser]);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    verification.current?.abort();
    setUser(data.data.user);
    setSessionError(false);
    setLoading(false);
    return data.data.user;
  }, []);

  const register = useCallback(async (values) => {
    const { data } = await api.post('/auth/register', values);
    verification.current?.abort();
    setUser(data.data.user);
    setSessionError(false);
    setLoading(false);
    return data.data.user;
  }, []);

  const verifyRegistration = useCallback(async (values) => {
    const { data } = await api.post('/auth/register/verify', values);
    verification.current?.abort();
    setUser(data.data.user);
    setSessionError(false);
    setLoading(false);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    verification.current?.abort();
    try { await api.post('/auth/logout'); } finally { setUser(null); setSessionError(false); setLoading(false); }
  }, []);

  const value = useMemo(() => ({ user, loading, sessionError, login, register, verifyRegistration, logout, refreshUser, setUser }), [user, loading, sessionError, login, register, verifyRegistration, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
