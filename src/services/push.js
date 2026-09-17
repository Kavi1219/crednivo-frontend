import { apiRequest } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function enableWebPush() {
  if (!isPushSupported()) throw new Error('This browser does not support notifications.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const { publicKey, enabled } = await apiRequest('/push/public-key');
  if (!enabled || !publicKey) throw new Error('Push notifications are not configured on the server yet.');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await apiRequest('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });

  return subscription;
}

export async function disableWebPush() {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } catch {
    // Still tell the backend to drop it even if the browser-side call fails.
  }
  await apiRequest('/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });
}
