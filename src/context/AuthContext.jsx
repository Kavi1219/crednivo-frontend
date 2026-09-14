import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { apiRequest, clearAuthToken, getAuthToken, mediaUrl, setAuthToken, uploadCompanyLogo } from '../services/api';
import { getActiveAccountId, listAccounts, removeAccount, saveAccount, switchToAccount } from '../services/accounts';

const AuthContext = createContext(null);
const UI_SETTINGS_KEY = 'crednivo-ui-settings';

function applyStoredTheme() {
  try {
    const settings = JSON.parse(localStorage.getItem(UI_SETTINGS_KEY) || '{}');
    const selected = settings.theme || 'system';
    const theme = selected === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : selected;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch { /* use CSS defaults */ }
}

function normalizeUser(payload) {
  if (!payload) return null;
  return {
    ...payload,
    role: String(payload.role || '').toUpperCase(),
    profilePhoto: mediaUrl(payload.profilePhoto),
    permissions: payload.permissions || {},
  };
}

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState({ ownerSetupRequired: false, companyName: 'CREDNIVO', ownerName: 'Owner', branch: '' });
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState(() => listAccounts());

  const refreshAccountsList = useCallback(() => setAccounts(listAccounts()), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      applyStoredTheme();
      const authStatus = await apiRequest('/auth/status', { skipAuth: true });
      setStatus(authStatus || {});
      if (authStatus?.ownerSetupRequired) {
        clearAuthToken();
        setUser(null);
        return;
      }
      const token = getAuthToken();
      if (!token) { setUser(null); return; }
      try {
        const me = await apiRequest('/auth/me');
        setUser(normalizeUser(me));
      } catch {
        clearAuthToken();
        setUser(null);
      }
    } catch (err) {
      setError(err?.message || 'Unable to reach CREDNIVO backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const expired = () => { clearAuthToken(); setUser(null); };
    window.addEventListener('crednivo-auth-expired', expired);
    return () => window.removeEventListener('crednivo-auth-expired', expired);
  }, []);


  useEffect(() => {
    const refreshCurrentUser = async () => {
      if (!getAuthToken()) return;
      try {
        const me = await apiRequest('/auth/me');
        setUser(normalizeUser(me));
      } catch {
        // Auth expiry is handled centrally by the API service/event listener.
      }
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') refreshCurrentUser(); };
    window.addEventListener('focus', refreshCurrentUser);
    document.addEventListener('visibilitychange', onVisibility);

    // Poll while the app is open and visible so a session ended from another
    // device (e.g. "Sign out" in Active Sessions) is picked up within ~30s,
    // instead of waiting for the next manual refresh or tab focus.
    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshCurrentUser();
    }, 30000);

    // In the Android app, the WebView pauses JS timers and web visibility
    // events while backgrounded, so the interval/focus listeners above
    // don't reliably fire on resume. Hook into Capacitor's native resume
    // event directly, same pattern as NativeAppLock.jsx.
    let nativeListenerHandle;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) refreshCurrentUser();
      }).then((handle) => { nativeListenerHandle = handle; });
    }

    return () => {
      window.removeEventListener('focus', refreshCurrentUser);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(pollId);
      nativeListenerHandle?.remove();
    };
  }, []);

  const login = async ({ identifier, password, role, remember = true }) => {
    setError('');
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ identifier, password, role }),
    });
    setAuthToken(result.token, { remember });
    saveAccount(result, { remember });
    refreshAccountsList();
    setUser(normalizeUser(result));
    return result;
  };

  const otpLogin = async ({ email, role, otp, remember = true }) => {
    setError('');
    const result = await apiRequest('/auth/otp-login/verify', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ email, role, otp }),
    });
    setAuthToken(result.token, { remember });
    saveAccount(result, { remember });
    refreshAccountsList();
    setUser(normalizeUser(result));
    return result;
  };

  const setupOwner = async ({ username, mobile, password }) => {
    setError('');
    const result = await apiRequest('/auth/setup-owner', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ username, mobile, password }),
    });
    setAuthToken(result.token);
    saveAccount(result);
    refreshAccountsList();
    setUser(normalizeUser(result));
    setStatus((current) => ({ ...current, ownerSetupRequired: false }));
    return result;
  };


  const registerCompany = async ({ logoFile, ...payload }) => {
    setError('');
    const result = await apiRequest('/auth/register-company', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify(payload),
    });
    setAuthToken(result.token);
    saveAccount(result);
    refreshAccountsList();
    setUser(normalizeUser(result));
    setStatus((current) => ({ ...current, ownerSetupRequired: false, companyName: payload.companyName, ownerName: payload.ownerName, branch: payload.branch }));
    if (logoFile) {
      try {
        await uploadCompanyLogo(logoFile);
        const me = await apiRequest('/auth/me');
        setUser(normalizeUser(me));
      } catch (uploadError) {
        console.warn('Company registered but logo upload failed', uploadError);
      }
    }
    return result;
  };

  const registerAgent = async ({ photoFile, name, mobile, email, companyName, branch, password }) => {
    setError('');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('mobile', mobile);
    formData.append('email', email);
    formData.append('companyName', companyName);
    formData.append('branch', branch);
    formData.append('password', password);
    if (photoFile) formData.append('photo', photoFile);
    return apiRequest('/auth/register-agent', { method: 'POST', skipAuth: true, body: formData });
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const currentId = getActiveAccountId();
    if (currentId) removeAccount(currentId);
    refreshAccountsList();
    clearAuthToken();
    setUser(null);
    return true;
  };

  const logout = async () => {
    try {
      if (getAuthToken()) await apiRequest('/auth/logout', { method: 'POST' });
    } catch { /* local logout must still succeed if backend is unavailable */ }
    finally {
      const currentId = getActiveAccountId();
      const next = currentId ? removeAccount(currentId) : null;
      refreshAccountsList();
      if (next) {
        setUser(null);
        await refresh();
      } else {
        clearAuthToken();
        setUser(null);
      }
    }
  };

  /** Switch to another saved account (e.g. a different company) without a fresh login. */
  const switchAccount = async (id) => {
    const account = switchToAccount(id);
    if (!account) return null;
    refreshAccountsList();
    setUser(null);
    await refresh();
    return account;
  };

  /** Forget a saved account from the switcher without touching its backend session. */
  const forgetAccount = (id) => {
    removeAccount(id);
    refreshAccountsList();
  };

  const isOwner = user?.role === 'OWNER';
  const hasPermission = useCallback((permission) => {
    if (!permission) return true;
    if (user?.role === 'OWNER') return true;
    return Boolean(user?.permissions?.[permission]);
  }, [user]);
  const value = useMemo(() => ({
    loading, user, status, error, login, otpLogin, setupOwner, registerCompany, registerAgent,
    logout, changePassword, refresh, isOwner, hasPermission, permissions: user?.permissions || {},
    accounts, activeAccountId: getActiveAccountId(), switchAccount, forgetAccount,
  }), [loading, user, status, error, isOwner, hasPermission, refresh, accounts]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
