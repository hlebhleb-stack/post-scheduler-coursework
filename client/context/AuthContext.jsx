import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { request, sessionKey } from '../services/api.js';
const AuthContext = createContext(null);
function storedSession() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}
export function AuthProvider({ children }) {
  const [session, setSession] = useState(storedSession);
  const login = useCallback((value) => {
    sessionStorage.setItem(sessionKey, JSON.stringify(value));
    setSession(value);
  }, []);
  const logout = useCallback(() => {
    sessionStorage.removeItem(sessionKey);
    setSession(null);
  }, []);
  useEffect(() => {
    window.addEventListener('session-expired', logout);
    return () => window.removeEventListener('session-expired', logout);
  }, [logout]);
  // Восстанавливаем роль и для сессий, созданных до появления панели администратора.
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    request('auth/me', { signal: controller.signal })
      .then((user) => {
        if (!controller.signal.aborted)
          setSession((current) => {
            if (!current) return null;
            const updated = { ...current, ...user };
            sessionStorage.setItem(sessionKey, JSON.stringify(updated));
            return updated;
          });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [session?.token]);
  return <AuthContext.Provider value={{ session, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
