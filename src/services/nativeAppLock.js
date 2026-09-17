import { Capacitor, registerPlugin } from '@capacitor/core';

const CrednivoAppLock = registerPlugin('CrednivoAppLock');

const SERVER_PREFIX = 'crednivo-native-lock-v1';

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function accountIdentity(user) {
  return String(
    user?.id
      ?? user?.userId
      ?? user?.employeeId
      ?? user?.username
      ?? user?.mobile
      ?? user?.email
      ?? user?.displayName
      ?? 'account',
  ).trim();
}

export function isNativeCrednivoApp() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CrednivoAppLock');
}

export function lockServerFor(user) {
  const role = String(user?.role || 'USER').toUpperCase();
  return `${SERVER_PREFIX}:${role}:${accountIdentity(user)}`;
}

export function accountHolderName(user, status) {
  if (String(user?.role || '').toUpperCase() === 'OWNER') {
    return String(
      user?.displayName
        || user?.name
        || user?.fullName
        || status?.ownerName
        || 'Owner',
    ).trim();
  }

  return String(
    user?.displayName
      || user?.name
      || user?.fullName
      || user?.employeeName
      || 'Agent',
  ).trim();
}

export function accountEmail(user) {
  return String(
    user?.email
      || user?.accountEmail
      || user?.companyEmail
      || '',
  ).trim().toLowerCase();
}

export function maskEmail(value) {
  const email = String(value || '').trim();
  const [local, domain] = email.split('@');
  if (!local || !domain) return email || 'your registered email';
  if (local.length <= 2) return `${local.charAt(0) || '*'}***@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

async function digest(value) {
  const encoded = new TextEncoder().encode(String(value));
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(buffer));
}

function randomSalt() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function createPinRecord(pin, { biometricEnabled = false } = {}) {
  const salt = randomSalt();
  return {
    version: 1,
    salt,
    pinHash: await digest(`${salt}:${pin}`),
    biometricEnabled: Boolean(biometricEnabled),
    lockEnabled: true,
    updatedAt: new Date().toISOString(),
  };
}

export async function verifyPin(pin, record) {
  if (!record?.salt || !record?.pinHash) return false;
  const candidate = await digest(`${record.salt}:${pin}`);
  return candidate === record.pinHash;
}

export async function readPinRecord(user) {
  if (!isNativeCrednivoApp()) return null;
  try {
    const result = await CrednivoAppLock.getRecord({ accountKey: lockServerFor(user) });
    if (!result?.value) return null;
    return JSON.parse(result.value);
  } catch {
    return null;
  }
}

export async function savePinRecord(user, record) {
  if (!isNativeCrednivoApp()) return;
  await CrednivoAppLock.saveRecord({
    accountKey: lockServerFor(user),
    value: JSON.stringify(record),
  });
}

export async function deletePinRecord(user) {
  if (!isNativeCrednivoApp() || !user) return;
  try {
    await CrednivoAppLock.deleteRecord({ accountKey: lockServerFor(user) });
  } catch {
    // Missing credentials are already effectively cleared.
  }
}

export async function fingerprintAvailability() {
  if (!isNativeCrednivoApp()) return { isAvailable: false };
  try {
    return await CrednivoAppLock.isAvailable();
  } catch {
    return { isAvailable: false };
  }
}

export async function verifyFingerprint(name = '') {
  await CrednivoAppLock.authenticate({
    title: 'CREDNIVO',
    subtitle: name ? `Welcome back, ${name}` : 'Welcome back',
    description: 'Use your fingerprint to unlock the app.',
    negativeButtonText: 'Use PIN',
  });
  return true;
}

export function isUserFallbackError(error) {
  return String(error?.code || '').toUpperCase() === 'USE_PIN';
}
