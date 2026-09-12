import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import './Auth.css';

const LOGIN_PREF_KEY = 'crednivo-login-preferences';

function readLoginPreferences() {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_PREF_KEY) || '{}');
  } catch {
    return {};
  }
}

// V51 — Gold emblem + blue glass login redesign. Authentication logic is unchanged.
export default function Login() {
  const actionLocksRef = useRef(new Set());

  const { loading, user, login, otpLogin } = useAuth();
  const navigate = useNavigate();
  const saved = readLoginPreferences();
  const [role, setRole] = useState(saved.role === 'AGENT' ? 'AGENT' : 'OWNER');
  const [identifier, setIdentifier] = useState(saved.remember ? (saved.identifier || '') : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(Boolean(saved.remember));
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [securityFlow, setSecurityFlow] = useState(null);
  const [securityEmail, setSecurityEmail] = useState('');
  const [securityStep, setSecurityStep] = useState('start');
  const [securityOtp, setSecurityOtp] = useState('');
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityConfirm, setSecurityConfirm] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityError, setSecurityError] = useState('');

  useEffect(() => {
    if (!showCreate) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowCreate(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCreate]);

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    if (actionLocksRef.current.has('submit')) return;
    actionLocksRef.current.add('submit');
    try {
    event.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Enter your User ID / Phone Number and password.');
      return;
    }

    try {
      setBusy(true);
      await login({
        identifier: identifier.trim(),
        password,
        role,
        remember,
      });

      if (remember) {
        localStorage.setItem(LOGIN_PREF_KEY, JSON.stringify({
          remember: true,
          role,
          identifier: identifier.trim(),
        }));
      } else {
        localStorage.removeItem(LOGIN_PREF_KEY);
      }

      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to login.');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('submit');
    }
  };


  const openSecurityFlow = (type) => {
    setSecurityFlow(type);
    setSecurityEmail('');
    setSecurityStep('start');
    setSecurityOtp('');
    setSecurityPassword('');
    setSecurityConfirm('');
    setSecurityMessage('');
    setSecurityError('');
  };

  const sendSecurityOtp = async () => {
    setSecurityError('');
    const email = securityEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSecurityError('Enter your verified email address.');
      return;
    }
    setSecurityBusy(true);
    try {
      const endpoint = securityFlow === 'otp'
        ? '/auth/otp-login/send'
        : '/auth/forgot-password/send';
      const result = await apiRequest(endpoint, {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, role }),
      });
      setSecurityMessage(`${result?.message || 'OTP sent.'} ${result?.maskedEmail || ''}`.trim());
      setSecurityStep('verify');
    } catch (err) {
      setSecurityError(err?.message || 'Could not send OTP.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const verifyOtpLogin = async () => {
    setSecurityError('');
    if (!/^\d{6}$/.test(securityOtp)) {
      setSecurityError('Enter the 6-digit OTP.');
      return;
    }
    setSecurityBusy(true);
    try {
      await otpLogin({
        email: securityEmail.trim().toLowerCase(),
        role,
        otp: securityOtp,
        remember,
      });
      setSecurityFlow(null);
      navigate('/', { replace: true });
    } catch (err) {
      setSecurityError(err?.message || 'OTP login failed.');
    } finally {
      setSecurityBusy(false);
    }
  };

  const resetForgotPassword = async () => {
    setSecurityError('');
    if (!/^\d{6}$/.test(securityOtp)) {
      setSecurityError('Enter the 6-digit OTP.');
      return;
    }
    if (securityPassword.length < 8) {
      setSecurityError('New password must contain at least 8 characters.');
      return;
    }
    if (securityPassword !== securityConfirm) {
      setSecurityError('Passwords do not match.');
      return;
    }
    setSecurityBusy(true);
    try {
      await apiRequest('/auth/forgot-password/reset', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          email: securityEmail.trim().toLowerCase(),
          role,
          otp: securityOtp,
          newPassword: securityPassword,
        }),
      });
      setSecurityMessage('Password changed successfully. Sign in with your new password.');
      setSecurityStep('done');
      setPassword('');
    } catch (err) {
      setSecurityError(err?.message || 'Could not reset password.');
    } finally {
      setSecurityBusy(false);
    }
  };

  return (
    <main className="auth-page auth-login-page auth-login-mirror">
      <section className="auth-login-split">
        <aside className="auth-login-brand-side" aria-label="CREDNIVO">
          <div className="crednivo-cinematic-brand" aria-label="CREDNIVO Finance Management Platform">
            <div className="crednivo-cinematic-symbol" aria-hidden="true">
              <div className="crednivo-c-ring" />

              <div className="crednivo-growth-bars">
                <span className="crednivo-growth-bar crednivo-growth-bar-1" />
                <span className="crednivo-growth-bar crednivo-growth-bar-2" />
                <span className="crednivo-growth-bar crednivo-growth-bar-3" />
              </div>

              <div className="crednivo-growth-arrow">
                <span className="crednivo-growth-arrow-line" />
                <span className="crednivo-growth-arrow-head" />
                <span className="crednivo-growth-arrow-glow" />
              </div>
            </div>

            <div className="crednivo-cinematic-copy">
              <div className="crednivo-cinematic-wordmark" aria-hidden="true">
                {'CREDNIVO'.split('').map((letter, index) => (
                  <span key={`${letter}-${index}`}>{letter}</span>
                ))}
              </div>

              <div className="crednivo-cinematic-tagline">
                <i aria-hidden="true" />
                <span>Finance Management Platform</span>
                <i aria-hidden="true" />
              </div>
            </div>
          </div>
        </aside>

        <section className="auth-login-card" aria-label="Sign in">
          <div className="auth-role-tabs auth-role-tabs-clean" role="tablist" aria-label="Login type">
            <button
              type="button"
              className={role === 'OWNER' ? 'active' : ''}
              onClick={() => setRole('OWNER')}
              aria-selected={role === 'OWNER'}
            >
              <UserRound size={19} />
              <strong>Owner</strong>
            </button>
            <button
              type="button"
              className={role === 'AGENT' ? 'active' : ''}
              onClick={() => setRole('AGENT')}
              aria-selected={role === 'AGENT'}
            >
              <UsersRound size={19} />
              <strong>Agent</strong>
            </button>
          </div>

          <form className="auth-form auth-login-form auth-login-line-form" onSubmit={submit}>
            <label>
              <span>User ID / Phone Number</span>
              <div className="auth-input-shell auth-line-input">
                <UserRound size={18} />
                <input
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder={role === 'AGENT'
                    ? 'Employee ID or mobile number'
                    : 'Mobile number or user ID'}
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="auth-input-shell auth-password-input auth-line-input">
                <KeyRound size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            <div className="auth-login-options auth-login-options-v48">
              <label className="auth-remember-control">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span className="auth-checkbox-ui" aria-hidden="true" />
                <span>Remember me</span>
              </label>
              <button type="button" className="auth-forgot-link" onClick={() => openSecurityFlow('forgot')}>Forgot Password?</button>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-primary-button auth-login-submit" type="submit" disabled={busy}>
              <span>{busy ? 'Signing in...' : 'Sign In'}</span>
              {!busy && <ArrowRight size={19} />}
            </button>
            <button className="auth-otp-login-button" type="button" onClick={() => openSecurityFlow('otp')}>
              <Mail size={17} /><span>Login with Email OTP</span>
            </button>
          </form>

          <div className="auth-login-divider"><span>OR</span></div>
          <div className="auth-create-row">
            <span>New to CREDNIVO?</span>
            <button type="button" onClick={() => setShowCreate(true)}>Create an account</button>
          </div>
        </section>
      </section>

      {securityFlow && (
        <div className="auth-create-overlay" onMouseDown={(event) => event.currentTarget === event.target && setSecurityFlow(null)}>
          <section className="auth-create-modal auth-security-flow-modal" role="dialog" aria-modal="true" aria-label={securityFlow === 'otp' ? 'Email OTP login' : 'Forgot password'}>
            <button className="auth-modal-close" type="button" onClick={() => setSecurityFlow(null)} aria-label="Close"><X size={21} /></button>
            <span className="auth-create-icon"><ShieldCheck size={29} /></span>
            <h2>{securityFlow === 'otp' ? 'Login with Email OTP' : 'Forgot Password'}</h2>
            <p>{securityStep === 'start'
              ? `Enter the verified email address for this ${role === 'OWNER' ? 'Owner' : 'Agent'} account.`
              : securityMessage}</p>

            {securityStep === 'start' && (
              <div className="auth-security-flow-form">
                <label>
                  <span>Verified Email Address</span>
                  <div className="auth-input-shell">
                    <Mail size={17} />
                    <input
                      type="email"
                      autoComplete="email"
                      value={securityEmail}
                      onChange={(event) => setSecurityEmail(event.target.value)}
                      placeholder="name@example.com"
                    />
                  </div>
                </label>
                <div className="auth-security-flow-account">
                  <small>Account Type</small>
                  <strong>{role === 'OWNER' ? 'Owner' : 'Agent'}</strong>
                  <span>Email OTP only</span>
                </div>
                <button className="auth-primary-button" type="button" onClick={sendSecurityOtp} disabled={securityBusy}>
                  <Mail size={17} />{securityBusy ? 'Sending...' : 'Send Email OTP'}
                </button>
              </div>
            )}

            {securityStep === 'verify' && (
              <div className="auth-security-flow-form">
                <label>
                  <span>6-digit OTP</span>
                  <div className="auth-input-shell"><KeyRound size={17} /><input inputMode="numeric" maxLength={6} value={securityOtp} onChange={(event) => setSecurityOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></div>
                </label>

                {securityFlow === 'forgot' && <>
                  <label>
                    <span>New Password</span>
                    <div className="auth-input-shell"><KeyRound size={17} /><input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} placeholder="Minimum 8 characters" /></div>
                  </label>
                  <label>
                    <span>Confirm New Password</span>
                    <div className="auth-input-shell"><KeyRound size={17} /><input type="password" value={securityConfirm} onChange={(event) => setSecurityConfirm(event.target.value)} placeholder="Re-enter password" /></div>
                  </label>
                </>}

                <button className="auth-primary-button" type="button" onClick={securityFlow === 'otp' ? verifyOtpLogin : resetForgotPassword} disabled={securityBusy}>
                  <CheckCircle2 size={17} />{securityBusy ? 'Verifying...' : securityFlow === 'otp' ? 'Verify & Sign In' : 'Verify & Change Password'}
                </button>
                <button className="auth-otp-resend-button" type="button" onClick={sendSecurityOtp} disabled={securityBusy}>Resend OTP</button>
              </div>
            )}

            {securityStep === 'done' && (
              <button className="auth-primary-button" type="button" onClick={() => setSecurityFlow(null)}>Back to Sign In</button>
            )}

            {securityError && <div className="auth-error">{securityError}</div>}
          </section>
        </div>
      )}

      {showCreate && (
        <div
          className="auth-create-overlay"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setShowCreate(false);
          }}
        >
          <section className="auth-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title">
            <button className="auth-modal-close" type="button" onClick={() => setShowCreate(false)} aria-label="Close">
              <X size={21} />
            </button>
            <span className="auth-create-icon"><UserRound size={30} /></span>
            <h2 id="create-account-title">Create an account</h2>
            <p>Choose how you&apos;d like to get started.</p>

            <div className="auth-create-options">
              <Link to="/register/company" onClick={() => setShowCreate(false)}>
                <span className="auth-create-option-icon company"><Building2 size={25} /></span>
                <span className="auth-create-option-copy">
                  <strong>Register Company</strong>
                  <small>Create your company and Owner account.</small>
                </span>
                <ChevronRight size={22} />
              </Link>

              <Link to="/register/agent" onClick={() => setShowCreate(false)}>
                <span className="auth-create-option-icon agent"><UsersRound size={25} /></span>
                <span className="auth-create-option-copy">
                  <strong>Register as Agent</strong>
                  <small>Join an existing company workspace.</small>
                </span>
                <ChevronRight size={22} />
              </Link>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export function AuthLoading() {
  return (
    <main className="auth-loading auth-loading-classic">
      <div className="auth-loading-new-logo" aria-hidden="true">
        <span className="auth-loading-c-shape" />
        <span className="auth-loading-bar auth-loading-bar-1" />
        <span className="auth-loading-bar auth-loading-bar-2" />
        <span className="auth-loading-bar auth-loading-bar-3" />
        <span className="auth-loading-arrow-line" />
        <span className="auth-loading-arrow-head" />
      </div>

      <strong>CREDNIVO</strong>
      <small>Securing workspace...</small>
    </main>
  );
}
