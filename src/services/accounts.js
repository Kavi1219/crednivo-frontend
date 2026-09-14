import { setAuthToken } from './api';

const ACCOUNTS_KEY = 'crednivo-accounts';
const ACTIVE_ACCOUNT_KEY = 'crednivo-active-account';

function readAccounts() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAccounts(list) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  } catch {
    /* storage can be unavailable in private environments */
  }
}

export function accountId(auth) {
  return `${auth?.companyId || 'company'}:${auth?.username || ''}`;
}

export function listAccounts() {
  return readAccounts();
}

export function getActiveAccountId() {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || '';
  } catch {
    return '';
  }
}

function setActiveAccountId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
    else localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    /* storage can be unavailable in private environments */
  }
}

/**
 * Save (or update) an account after a successful login/registration and make
 * it the active one. Other already-saved accounts are left untouched, so the
 * user stays signed into all of them and can switch instantly.
 */
export function saveAccount(auth, { remember = true } = {}) {
  const id = accountId(auth);
  const entry = {
    id,
    token: auth.token,
    role: auth.role,
    username: auth.username,
    displayName: auth.displayName,
    mobile: auth.mobile,
    companyName: auth.companyName,
    companyId: auth.companyId,
    profilePhoto: auth.profilePhoto,
    remember,
    addedAt: new Date().toISOString(),
  };
  const list = readAccounts().filter((item) => item.id !== id);
  list.push(entry);
  writeAccounts(list);
  setActiveAccountId(id);
  return entry;
}

/** Switch the active token slot to a previously saved account. Returns the account, or null if not found. */
export function switchToAccount(id) {
  const account = readAccounts().find((item) => item.id === id);
  if (!account) return null;
  setAuthToken(account.token, { remember: account.remember !== false });
  setActiveAccountId(id);
  return account;
}

/** Remove a saved account (e.g. after logging out of it). Switches to another saved account if one remains. */
export function removeAccount(id) {
  const list = readAccounts().filter((item) => item.id !== id);
  writeAccounts(list);
  if (getActiveAccountId() === id) {
    const next = list[0] || null;
    if (next) {
      setAuthToken(next.token, { remember: next.remember !== false });
      setActiveAccountId(next.id);
    } else {
      setActiveAccountId('');
    }
    return next;
  }
  return readAccounts().find((item) => item.id === getActiveAccountId()) || null;
}

export function clearAccounts() {
  writeAccounts([]);
  setActiveAccountId('');
}
