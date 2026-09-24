import { useEffect, useState } from 'react';
import { getAuthToken, mediaUrl } from '../../services/api';

/**
 * Renders media stored behind the authenticated /uploads endpoint.
 * A normal <img src="https://...railway.app/uploads/..."> cannot attach the
 * Bearer token and cross-site SameSite cookies are not sent reliably, which
 * causes intermittent 401s. Fetch the file with auth and render a blob URL.
 */
export default function ProtectedImage({ src, alt = '', className, fallback = null }) {
  const [resolvedSrc, setResolvedSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    const raw = String(src || '').trim();
    const value = raw.startsWith('/') ? mediaUrl(raw) : raw;

    setFailed(false);
    if (!value) {
      setResolvedSrc('');
      return undefined;
    }

    if (/^(data:|blob:)/i.test(value)) {
      setResolvedSrc(value);
      return undefined;
    }

    const isProtectedUpload = /\/uploads\//i.test(value);
    if (!isProtectedUpload) {
      setResolvedSrc(value);
      return undefined;
    }

    setResolvedSrc('');
    const load = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch(value, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) throw new Error(`Media request failed (${response.status})`);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setResolvedSrc(objectUrl);
      } catch (error) {
        console.error('CREDNIVO protected image load failed', error);
        if (!cancelled) {
          setResolvedSrc('');
          setFailed(true);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src || failed || !resolvedSrc) return fallback;
  return <img src={resolvedSrc} alt={alt} className={className} />;
}
