// Minimal service worker — handles push notifications only.
// Deliberately does NOT intercept fetch or cache anything, so the app
// always loads live data exactly as it would without a service worker.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'CREDNIVO', body: 'You have a new notification.' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Keep the default text if the payload wasn't valid JSON.
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'CREDNIVO', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'crednivo-notification',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        if ('navigate' in existing) existing.navigate('/work');
      } else {
        self.clients.openWindow('/work');
      }
    }),
  );
});
