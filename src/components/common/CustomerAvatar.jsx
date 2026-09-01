import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getAuthToken } from '../../services/api';
import './CustomerAvatar.css';

function initialOf(name) {
  return String(name || 'C').trim().charAt(0).toUpperCase() || 'C';
}

export default function CustomerAvatar({
  photo,
  name,
  className = '',
  alt,
  openOnClick = true,
  title,
}) {
  const [resolvedSrc, setResolvedSrc] = useState(() => {
    const value = String(photo || '').trim();
    return /^(data:|blob:)/i.test(value) ? value : '';
  });
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const fallback = useMemo(() => initialOf(name), [name]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    const value = String(photo || '').trim();

    setFailed(false);

    if (!value) {
      setResolvedSrc('');
      return undefined;
    }

    if (/^(data:|blob:)/i.test(value)) {
      setResolvedSrc(value);
      return undefined;
    }

    const load = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch(value, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) throw new Error(`Customer photo request failed (${response.status})`);

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setResolvedSrc(objectUrl);
      } catch (error) {
        console.error('CREDNIVO customer photo load failed', error);
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
  }, [photo]);

  const hasPhoto = Boolean(photo && !failed && resolvedSrc);

  const avatar = (
    <span
      className={`customer-avatar-smart ${hasPhoto ? 'has-photo' : ''} ${openOnClick && hasPhoto ? 'can-open-photo' : ''} ${className}`.trim()}
      onClick={(event) => {
        if (!openOnClick || !hasPhoto) return;
        event.preventDefault();
        event.stopPropagation();
        setViewerOpen(true);
      }}
      onKeyDown={(event) => {
        if (!openOnClick || !hasPhoto) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          setViewerOpen(true);
        }
      }}
      role={openOnClick && hasPhoto ? 'button' : undefined}
      tabIndex={openOnClick && hasPhoto ? 0 : undefined}
      title={title || (hasPhoto ? `View ${name || 'customer'} photo` : `${name || 'Customer'} profile photo`)}
      aria-label={hasPhoto && openOnClick ? `View ${name || 'customer'} photo` : undefined}
    >
      {hasPhoto ? <img src={resolvedSrc} alt={alt || `${name || 'Customer'} profile`} /> : fallback}
    </span>
  );

  return (
    <>
      {avatar}
      {viewerOpen && hasPhoto && (
        <div
          className="customer-avatar-viewer"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewerOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`${name || 'Customer'} photo`}
        >
          <button type="button" className="customer-avatar-viewer-close" onClick={() => setViewerOpen(false)} aria-label="Close photo">
            <X size={22} />
          </button>
          <div className="customer-avatar-viewer-content">
            <img src={resolvedSrc} alt={alt || `${name || 'Customer'} profile`} />
            <strong>{name || 'Customer'}</strong>
          </div>
        </div>
      )}
    </>
  );
}
