import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const PREFIX = 'crednivo:navigation:v41:';
const LAST_INTERNAL = `${PREFIX}last-internal`;

function routeUrl(location) {
  return `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
}

function scrollKey(url) {
  return `${PREFIX}scroll:${encodeURIComponent(url)}`;
}

function saveScroll(url, y = window.scrollY) {
  try {
    sessionStorage.setItem(scrollKey(url), String(Math.max(0, Number(y || 0))));
  } catch {}
}

function readScroll(url) {
  try {
    const value = Number(sessionStorage.getItem(scrollKey(url)) || 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function getLastInternalRoute() {
  try {
    return sessionStorage.getItem(LAST_INTERNAL) || '';
  } catch {
    return '';
  }
}

export function rememberCurrentRouteNow() {
  const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  saveScroll(url, window.scrollY);
  return url;
}

export default function NavigationMemory() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const url = useMemo(
    () => routeUrl(location),
    [location.pathname, location.search, location.hash],
  );
  const previousUrlRef = useRef('');
  const timersRef = useRef([]);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    let frame = 0;

    const record = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        saveScroll(url, window.scrollY);
      });
    };

    record();
    window.addEventListener('scroll', record, { passive: true });

    return () => {
      window.removeEventListener('scroll', record);
      if (frame) window.cancelAnimationFrame(frame);
      saveScroll(url, window.scrollY);
    };
  }, [url]);

  useEffect(() => {
    const previous = previousUrlRef.current;
    try {
      if (previous && previous !== url) {
        sessionStorage.setItem(LAST_INTERNAL, previous);
      }
    } catch {}
    previousUrlRef.current = url;
  }, [url]);

  useEffect(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    userInteractedRef.current = false;

    const stopRestore = () => {
      userInteractedRef.current = true;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };

    const events = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
    events.forEach((name) => window.addEventListener(name, stopRestore, { passive: true, once: true }));

    if (navigationType === 'POP') {
      const targetY = readScroll(url);
      const restore = () => {
        if (!userInteractedRef.current) {
          window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
        }
      };

      window.requestAnimationFrame(() => window.requestAnimationFrame(restore));
      [80, 220, 500].forEach((delay) => {
        timersRef.current.push(window.setTimeout(restore, delay));
      });
    } else {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }

    return () => {
      events.forEach((name) => window.removeEventListener(name, stopRestore));
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, [url, navigationType]);

  return null;
}
