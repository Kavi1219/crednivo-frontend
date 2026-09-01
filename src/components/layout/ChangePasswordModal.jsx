import { CheckCircle2, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import IconButton from '../common/IconButton';

export default function ChangePasswordModal({ open, onClose }) {
  const actionLocksRef = useRef(new Set());

  const navigate = useNavigate();
  const { logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    if (actionLocksRef.current.has('submit')) return;
    actionLocksRef.current.add('submit');
    try {
    event.preventDefault();
    setError('');
    if (form.newPassword.length < 8) { setError('New password must contain at least 8 characters.'); return; }
    if (form.newPassword !== form.confirm) { setError('New passwords do not match.'); return; }
    try {
      setBusy(true);
      await apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      await logout();
      onClose();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err?.message || 'Could not change password.');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('submit');
    }
  };

  return createPortal(
    <div className="password-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="password-modal app-card" role="dialog" aria-modal="true" aria-label="Change password">
        <div className="password-modal-head"><span><KeyRound size={20} /></span><div><small>ACCOUNT SECURITY</small><h2>Change Password</h2><p>Changing your password signs out all active sessions.</p></div><IconButton label="Close" onClick={onClose}><X size={18} /></IconButton></div>
        <form onSubmit={submit} className="password-modal-form">
          <label><span>Current Password</span><div><input type={show ? 'text' : 'password'} autoComplete="current-password" value={form.currentPassword} onChange={change('currentPassword')} /><button type="button" onClick={() => setShow((v) => !v)} aria-label="Toggle password visibility">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          <label><span>New Password</span><input type={show ? 'text' : 'password'} autoComplete="new-password" value={form.newPassword} onChange={change('newPassword')} placeholder="Minimum 8 characters" /></label>
          <label><span>Confirm New Password</span><input type={show ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={change('confirm')} /></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="password-save-button" type="submit" disabled={busy}><CheckCircle2 size={17} />{busy ? 'Changing...' : 'Change Password'}</button>
        </form>
      </section>
    </div>,
    document.body,
  );
}
