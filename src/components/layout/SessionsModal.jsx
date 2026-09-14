import { Laptop2, MapPin, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../../services/api';
import IconButton from '../common/IconButton';

function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function SessionsModal({ open, onClose }) {
  const actionLocksRef = useRef(new Set());
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revokingId, setRevokingId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await apiRequest('/auth/sessions');
      setSessions(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || 'Could not load active sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    load();
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const revoke = async (id) => {
    if (actionLocksRef.current.has(id)) return;
    actionLocksRef.current.add(id);
    try {
      setRevokingId(id);
      setError('');
      await apiRequest(`/auth/sessions/${id}`, { method: 'DELETE' });
      setSessions((current) => current.filter((s) => s.id !== id));
    } catch (err) {
      setError(err?.message || 'Could not sign out that device.');
    } finally {
      setRevokingId(null);
      actionLocksRef.current.delete(id);
    }
  };

  return createPortal(
    <div className="password-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="password-modal sessions-modal app-card" role="dialog" aria-modal="true" aria-label="Active sessions">
        <div className="password-modal-head">
          <span><ShieldCheck size={20} /></span>
          <div>
            <small>ACCOUNT SECURITY</small>
            <h2>Active Sessions</h2>
            <p>Every device currently signed in to this account. Don&apos;t recognise one? Sign it out.</p>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>

        <div className="sessions-modal-toolbar">
          <button type="button" className="sessions-refresh-button" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /><span>Refresh</span>
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <div className="sessions-modal-list">
          {loading && sessions.length === 0 && <div className="sessions-modal-empty">Loading sessions&hellip;</div>}
          {!loading && sessions.length === 0 && !error && <div className="sessions-modal-empty">No active sessions found.</div>}
          {sessions.map((session) => (
            <div key={session.id} className={`sessions-modal-row ${session.current ? 'current' : ''}`}>
              <span className="sessions-modal-icon"><Laptop2 size={17} /></span>
              <div className="sessions-modal-info">
                <strong>{session.deviceLabel || 'Unknown device'}{session.current && <em> · This device</em>}</strong>
                <span className="sessions-modal-meta"><MapPin size={12} />{session.ipAddress || 'Unknown IP'}</span>
                <span className="sessions-modal-meta">Last active {formatWhen(session.lastActiveAt)}</span>
              </div>
              {!session.current && (
                <button
                  type="button"
                  className="sessions-signout-button"
                  onClick={() => revoke(session.id)}
                  disabled={revokingId === session.id}
                >
                  {revokingId === session.id ? 'Signing out…' : 'Sign out'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
