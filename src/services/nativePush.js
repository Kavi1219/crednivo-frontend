import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiRequest } from './api';

export function isNativePushSupported() {
  return Capacitor.isNativePlatform();
}

export async function registerNativePush() {
  if (!isNativePushSupported()) return;

  const permStatus = await PushNotifications.checkPermissions();
  let granted = permStatus.receive === 'granted';
  if (!granted) {
    const requested = await PushNotifications.requestPermissions();
    granted = requested.receive === 'granted';
  }
  if (!granted) return;

  await PushNotifications.register();
}

/** Wires up the two listeners we care about; returns a cleanup function. */
export function listenForDeviceToken(onNotificationTapped) {
  if (!isNativePushSupported()) return () => {};

  const registrationHandle = PushNotifications.addListener('registration', async (token) => {
    try {
      await apiRequest('/device-tokens', {
        method: 'POST',
        body: JSON.stringify({ token: token.value, platform: 'android' }),
      });
    } catch {
      // Will simply re-register (and retry) next time the app opens.
    }
  });

  const actionHandle = PushNotifications.addListener('pushNotificationActionPerformed', () => {
    onNotificationTapped?.('/work');
  });

  return () => {
    registrationHandle.then((h) => h.remove());
    actionHandle.then((h) => h.remove());
  };
}
