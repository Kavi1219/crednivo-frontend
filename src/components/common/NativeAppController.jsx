import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useLocation, useNavigate } from 'react-router-dom';
import './NativeAppController.css';

const ROOT_PATHS = new Set(['/', '/overview', '/login']);

function fallbackRoute(pathname) {
  const path = String(pathname || '/');

  if (/^\/customers\/[^/]+$/.test(path)) return '/customers';
  if (path.startsWith('/customers/')) return '/customers';
  if (path.startsWith('/loans/')) return '/loans';
  if (path.startsWith('/collection')) return '/collection';
  if (path.startsWith('/payments')) return '/payments';
  if (path.startsWith('/expenses')) return '/expenses';
  if (path.startsWith('/capital')) return '/capital';
  if (path.startsWith('/savings')) return '/savings';
  if (path.startsWith('/agents')) return '/agents';
  if (path.startsWith('/documents')) return '/documents';
  if (path.startsWith('/reports')) return '/reports';
  if (path.startsWith('/settings')) return '/overview';

  return '/overview';
}

export default function NativeAppController() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let disposed = false;
    let listenerHandle;

    CapacitorApp.addListener('backButton', async () => {
      const pathname = window.location.pathname || location.pathname || '/';

      // At a true app root, Android Back behaves like a normal Android app:
      // minimize instead of destroying the React navigation experience.
      if (ROOT_PATHS.has(pathname)) {
        await CapacitorApp.minimizeApp();
        return;
      }

      // React Router stores a browser-history index in history.state.
      // When it exists, navigate(-1) returns to the exact previous screen,
      // including Collection -> Overdue -> customer -> Back.
      const historyIndex = Number(window.history?.state?.idx);
      const hasHistoryIndex = Number.isFinite(historyIndex) && historyIndex > 0;
      const hasLocationHistory = Boolean(location.key && location.key !== 'default');

      if (hasHistoryIndex || hasLocationHistory || window.history.length > 1) {
        navigate(-1);
        return;
      }

      // Deep links / restored activities may have no usable browser history.
      // Stay inside CREDNIVO instead of closing the Activity.
      navigate(fallbackRoute(pathname), { replace: true });
    }).then((handle) => {
      if (disposed) {
        handle.remove();
      } else {
        listenerHandle = handle;
      }
    });

    return () => {
      disposed = true;
      listenerHandle?.remove();
    };
  }, [location.key, location.pathname, navigate]);

  return null;
}
