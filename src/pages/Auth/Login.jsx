import { BarChart3, Building2, Eye, EyeOff, KeyRound, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

export default function Login() {
  const { loading, user, status, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('OWNER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!identifier.trim() || !password) { setError('Enter your login ID and password.'); return; }
    try {
      setBusy(true);
      await login({ identifier: identifier.trim(), password, role });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to login.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-lockup"><span className="auth-brand-mark"><BarChart3 size={34} /></span><div><strong>CREDNIVO</strong><small>Finance Management Platform</small></div></div>
        <div className="auth-brand-copy">
          <span className="auth-kicker"><ShieldCheck size={16} /> Secure Business Access</span>
          <h1>Manage finance in your protected workspace.</h1>
          <p>Each company signs into its own isolated customers, loans, collections, expenses and reports.</p>
        </div>
        <div className="auth-company-chip"><Building2 size={18} /><div><small>Company</small><strong>{status?.companyName || 'CREDNIVO'}</strong><span>{status?.branch || 'Main Branch'}</span></div></div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-heading"><span className="auth-heading-icon"><KeyRound size={22} /></span><div><small>WELCOME BACK</small><h2>Sign in to CREDNIVO</h2><p>Choose your access type and continue.</p></div></div>

          <div className="auth-role-tabs" role="tablist" aria-label="Login type">
            <button type="button" className={role === 'OWNER' ? 'active' : ''} onClick={() => setRole('OWNER')}><UserRound size={18} /><span><strong>Owner</strong><small>Full business access</small></span></button>
            <button type="button" className={role === 'AGENT' ? 'active' : ''} onClick={() => setRole('AGENT')}><UsersRound size={18} /><span><strong>Agent</strong><small>Collection workspace</small></span></button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <label><span>{role === 'AGENT' ? 'Employee ID or Mobile' : 'Username or Mobile'}</span><input autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={role === 'AGENT' ? 'EMP-001 or 9876543210' : 'admin or 9876543210'} /></label>
            <label><span>Password</span><div className="auth-password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-primary-button" type="submit" disabled={busy}><ShieldCheck size={18} />{busy ? 'Signing in...' : `Sign in as ${role === 'OWNER' ? 'Owner' : 'Agent'}`}</button>
          </form>

          {role === 'AGENT' && <div className="auth-help-note"><ShieldCheck size={16} /><span>Your agent profile must be <strong>Active</strong>. Self-registered agents can login after Owner approval using mobile or EMP ID.</span></div>}

          <div className="auth-register-section">
            <div><small>NEW TO CREDNIVO?</small><strong>Create an account</strong></div>
            <div className="auth-register-actions">
              <Link to="/register/company"><Building2 size={17} /><span>Register Company</span></Link>
              <Link to="/register/agent"><UsersRound size={17} /><span>Register as Agent</span></Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function AuthLoading() {
  return <main className="auth-loading"><span className="auth-loading-mark"><BarChart3 size={30} /></span><strong>CREDNIVO</strong><small>Securing workspace...</small></main>;
}
