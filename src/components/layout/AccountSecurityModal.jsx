import { CheckCircle2, Mail, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import IconButton from '../common/IconButton';

export default function AccountSecurityModal({ open, onClose, onVerified }) {
  const { refresh } = useAuth();
  const [state, setState] = useState(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const result = await apiRequest('/auth/email-security');
      setState(result);
      setEmail(result?.email || '');
    } catch (err) {
      setError(err?.message || 'Could not load account security.');
    }
  };

  useEffect(() => {
    if (!open) return;
    setOtp('');
    setMessage('');
    load();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const saveEmail = async () => {
    setError(''); setMessage(''); setBusy('email');
    try {
      const result = await apiRequest('/auth/email-security/update', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
      setState(result);
      setMessage('Email updated. Verify it before using OTP login or password recovery.');
      await refresh();
    } catch (err) {
      setError(err?.message || 'Could not update email.');
    } finally { setBusy(''); }
  };

  const sendOtp = async () => {
    setError(''); setMessage(''); setBusy('send');
    try {
      const result = await apiRequest('/auth/email-security/send', { method: 'POST' });
      setMessage(`${result?.message || 'OTP sent.'} ${result?.maskedEmail || ''}`.trim());
      setOtp('');
    } catch (err) {
      setError(err?.message || 'Could not send OTP.');
    } finally { setBusy(''); }
  };

  const verify = async () => {
    setError(''); setMessage('');
    if (!/^\d{6}$/.test(otp.trim())) { setError('Enter the 6-digit OTP.'); return; }
    setBusy('verify');
    try {
      const result = await apiRequest('/auth/email-security/verify', {
        method: 'POST',
        body: JSON.stringify({ otp: otp.trim() }),
      });
      setState(result);
      setMessage('Email verified successfully. OTP login, forgot password, and password change are now enabled.');
      await refresh();
      onVerified?.();
    } catch (err) {
      setError(err?.message || 'Could not verify OTP.');
    } finally { setBusy(''); }
  };

  return createPortal(
    <div className="password-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="password-modal app-card account-security-modal" role="dialog" aria-modal="true" aria-label="Account security">
        <div className="password-modal-head">
          <span><ShieldCheck size={20} /></span>
          <div>
            <small>ACCOUNT SECURITY</small>
            <h2>Email Verification</h2>
            <p>Verify your email to enable OTP login, forgot password, and password changes.</p>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>

        <div className="account-security-status">
          <span className={state?.verified ? 'verified' : 'pending'}>
            {state?.verified ? <CheckCircle2 size={17} /> : <Mail size={17} />}
          </span>
          <div>
            <small>OTP Verification</small>
            <strong>{state?.verified ? 'Verified' : 'Pending'}</strong>
            {state?.verifiedAt && <em>{new Date(state.verifiedAt).toLocaleString()}</em>}
          </div>
        </div>

        <div className="password-modal-form account-security-form">
          <label>
            <span>Account Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" disabled={busy !== ''} />
          </label>
          <button type="button" className="account-security-secondary" onClick={saveEmail} disabled={busy !== '' || !email.trim()}>
            <Mail size={16} />{busy === 'email' ? 'Saving...' : 'Save Email'}
          </button>

          {!state?.verified && <>
            <button type="button" className="account-security-secondary" onClick={sendOtp} disabled={busy !== '' || !email.trim()}>
              <RefreshCw size={16} />{busy === 'send' ? 'Sending...' : 'Send Verification OTP'}
            </button>
            <label>
              <span>6-digit OTP</span>
              <input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
            </label>
            <button type="button" className="password-save-button" onClick={verify} disabled={busy !== '' || otp.length !== 6}>
              <CheckCircle2 size={17} />{busy === 'verify' ? 'Verifying...' : 'Verify Email'}
            </button>
          </>}

          {message && <div className="auth-success-inline">{message}</div>}
          {error && <div className="auth-error">{error}</div>}
        </div>
      </section>
    </div>,
    document.body,
  );
}
