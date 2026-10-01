import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Stops "Failed to fetch dynamically imported module" before it happens.
 *
 * Every build writes /version.json with its build id. This checks it when the
 * app comes back to the foreground and every few minutes. When a newer build
 * is live, the NEXT page change loads that page fresh from the server instead
 * of asking for old file names that a deploy has removed.
 */
const BUILD_ID = typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : '';
const CHECK_EVERY_MS = 5 * 60 * 1000;

export default function UpdateWatcher() {
  const location = useLocation();
  const updateReady = useRef(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!BUILD_ID || import.meta.env.DEV) return undefined;
    let stopped = false;

    const check = async () => {
      if (updateReady.current || document.visibilityState === 'hidden') return;
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const { buildId } = await response.json();
        if (!stopped && buildId && buildId !== BUILD_ID) updateReady.current = true;
      } catch {
        // Offline or blocked — try again next time.
      }
    };

    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    // The address bar already shows the new page; reloading opens it with the new build.
    if (updateReady.current) window.location.reload();
  }, [location.pathname]);

  return null;
}
