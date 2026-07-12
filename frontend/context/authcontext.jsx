import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  authApi,
  setAccessToken,
  clearAccessToken,
  parseApiError,
} from "../api";

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // initial session check
  const [error, setError] = useState(null);

  // ── Bootstrap: check if session exists ──────────────────────────────────────
  const checkSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await authApi.currentUser();
      setUser(data?.data?.user ?? null);
    } catch {
      setUser(null);
      clearAccessToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // ── Register ─────────────────────────────────────────────────────────────────
  const register = useCallback(async (credentials) => {
    setError(null);
    try {
      const { data } = await authApi.register(credentials);
      return { success: true, data: data?.data };
    } catch (err) {
      const message = parseApiError(err);
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────────
  const login = useCallback(async (credentials) => {
    setError(null);
    try {
      const { data } = await authApi.login(credentials);
      const { user: userData, accessToken } = data?.data ?? {};
      if (accessToken) setAccessToken(accessToken);
      setUser(userData ?? null);
      return { success: true };
    } catch (err) {
      const message = parseApiError(err);
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // swallow
    } finally {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  // ── Change password ───────────────────────────────────────────────────────────
  const changePassword = useCallback(async (passwords) => {
    setError(null);
    try {
      await authApi.changePassword(passwords);
      return { success: true };
    } catch (err) {
      const message = parseApiError(err);
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // ── Forgot password ───────────────────────────────────────────────────────────
  const forgotPassword = useCallback(async (email) => {
    setError(null);
    try {
      await authApi.forgotPassword({ email });
      return { success: true };
    } catch (err) {
      const message = parseApiError(err);
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // ── Reset password ────────────────────────────────────────────────────────────
  const resetPassword = useCallback(async (token, passwords) => {
    setError(null);
    try {
      await authApi.resetPassword(token, passwords);
      return { success: true };
    } catch (err) {
      const message = parseApiError(err);
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // ── Resend verification ───────────────────────────────────────────────────────
  const resendVerification = useCallback(async () => {
    setError(null);
    try {
      await authApi.resendVerification();
      return { success: true };
    } catch (err) {
      const message = parseApiError(err);
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────────
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    login,
    logout,
    register,
    changePassword,
    forgotPassword,
    resetPassword,
    resendVerification,
    refreshUser: checkSession,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export default AuthContext;
