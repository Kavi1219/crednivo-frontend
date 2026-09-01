import { BarChart3, CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthLoading } from './Login';
import './Auth.css';

export default function OwnerSetup() {
  const actionLocksRef = useRef(new Set());

  const { loading, user, status, setupOwner } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: 'admin', mobile: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;
  if (!status?.ownerSetupRequired) return <Navigate to="/login" replace />;

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    if (actionLocksRef.current.has('submit')) return;
    actionLocksRef.current.add('submit');
    try {
    event.preventDefault();
    setError('');
    const digits = String(form.mobile || '').replace(/\D/g, '');
    if (form.username.trim().length < 3) { setError('Create a username with at least 3 characters.'); return; }
    if (digits && digits.length !== 10) { setError('Mobile number must contain exactly 10 digits.'); return; }
    if (form.password.length < 8) { setError('Password must contain at least 8 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    try {
      setBusy(true);
      await setupOwner({ username: form.username.trim(), mobile: digits, password: form.password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Could not create owner login.');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('submit');
    }
  };

  return (
    <main className="auth-page auth-setup-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-lockup"><span className="auth-brand-mark"><BarChart3 size={34} /></span><div><strong>CREDNIVO</strong><small>Finance Management Platform</small></div></div>
        <div className="auth-brand-copy"><span className="auth-kicker"><ShieldCheck size={16} /> First-time Security Setup</span><h1>Create the owner login before anyone can enter the workspace.</h1><p>This password is securely hashed in PostgreSQL. CREDNIVO never stores the plain password.</p></div>
        <div className="auth-company-chip"><CheckCircle2 size={18} /><div><small>Ready to secure</small><strong>{status?.companyName || 'CREDNIVO'}</strong><span>{status?.ownerName || 'Owner'} · {status?.branch || 'Main Branch'}</span></div></div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-heading"><span className="auth-heading-icon"><KeyRound size={22} /></span><div><small>OWNER ACCOUNT</small><h2>Secure your workspace</h2><p>Create the first CREDNIVO administrator login.</p></div></div>
          <form className="auth-form" onSubmit={submit}>
            <label><span>Owner Username *</span><input autoComplete="username" value={form.username} onChange={change('username')} placeholder="admin" /></label>
            <label><span>Owner Mobile <em>optional</em></span><input inputMode="numeric" maxLength={10} value={form.mobile} onChange={change('mobile')} placeholder="10-digit mobile" /></label>
            <label><span>Create Password *</span><div className="auth-password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={change('password')} placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <label><span>Confirm Password *</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={change('confirm')} placeholder="Re-enter password" /></label>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-primary-button" type="submit" disabled={busy}><ShieldCheck size={18} />{busy ? 'Securing CREDNIVO...' : 'Create Owner Login'}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
