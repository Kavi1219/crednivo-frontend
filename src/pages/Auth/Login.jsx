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


function PremiumCrednivoBrand() {
  return (
    <div className="v55-brand">
      <div className="v55-brand-logo" aria-hidden="true">
        <svg viewBox="0 0 520 520" role="img">
          <defs>
            <linearGradient id="v55Gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6f4305" />
              <stop offset="16%" stopColor="#fff2b4" />
              <stop offset="38%" stopColor="#d79516" />
              <stop offset="58%" stopColor="#fff6cb" />
              <stop offset="78%" stopColor="#d99b23" />
              <stop offset="100%" stopColor="#704005" />
            </linearGradient>
            <linearGradient id="v55GoldBright" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#8d5507" />
              <stop offset="28%" stopColor="#f0b72f" />
              <stop offset="58%" stopColor="#fff4bd" />
              <stop offset="100%" stopColor="#d48d11" />
            </linearGradient>
            <linearGradient id="v55Bar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7a4b07" />
              <stop offset="22%" stopColor="#d89a1f" />
              <stop offset="52%" stopColor="#fff0a4" />
              <stop offset="78%" stopColor="#d2951a" />
              <stop offset="100%" stopColor="#6d4004" />
            </linearGradient>
            <filter id="v55Glow" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="9" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="v55Soft" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="16" stdDeviation="13" floodColor="#000000" floodOpacity=".48" />
            </filter>
          </defs>

          <ellipse cx="250" cy="456" rx="175" ry="20" fill="#e6aa2a" opacity=".12" />

          <path
            d="M 388 105
               C 323 54, 211 48, 132 111
               C 44 181, 42 326, 133 407
               C 211 477, 333 470, 405 390"
            fill="none"
            stroke="url(#v55Gold)"
            strokeWidth="86"
            strokeLinecap="round"
            filter="url(#v55Soft)"
          />
          <path
            d="M 382 111
               C 317 67, 217 63, 145 119
               C 66 181, 64 318, 144 393
               C 215 459, 323 449, 392 382"
            fill="none"
            stroke="rgba(255,255,255,.23)"
            strokeWidth="18"
            strokeLinecap="round"
          />

          <g filter="url(#v55Soft)">
            <rect x="190" y="306" width="38" height="90" rx="5" fill="url(#v55Bar)" />
            <rect x="244" y="268" width="38" height="128" rx="5" fill="url(#v55Bar)" />
            <rect x="298" y="218" width="38" height="178" rx="5" fill="url(#v55Bar)" />
            <rect x="352" y="162" width="38" height="234" rx="5" fill="url(#v55Bar)" />
            <path d="M203 306H220V395H203Z" fill="rgba(255,255,255,.20)" />
            <path d="M257 268H274V395H257Z" fill="rgba(255,255,255,.20)" />
            <path d="M311 218H328V395H311Z" fill="rgba(255,255,255,.20)" />
            <path d="M365 162H382V395H365Z" fill="rgba(255,255,255,.20)" />
          </g>

          <g filter="url(#v55Glow)">
            <path
              d="M 172 355
                 C 232 334, 279 304, 322 268
                 C 359 237, 392 198, 430 145"
              fill="none"
              stroke="url(#v55GoldBright)"
              strokeWidth="17"
              strokeLinecap="round"
            />
            <polygon points="421,129 466,121 448,164" fill="url(#v55GoldBright)" />
          </g>

          <path
            d="M 178 350 C 236 329, 279 300, 320 267 C 356 237, 389 198, 425 150"
            fill="none"
            stroke="rgba(255,255,255,.50)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="v55-wordmark" aria-label="CREDNIVO">
        <span className="v55-word-silver">CRED</span><span className="v55-word-gold">NIVO</span>
      </div>
      <div className="v55-brand-rule" />
      <div className="v55-brand-tagline">Finance Management Platform</div>
    </div>
  );
}

// V55 — Rebuilt from code: no screenshot/background image is embedded. Authentication logic is unchanged.
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
        <aside className="auth-login-brand-side v55-brand-side" aria-label="CREDNIVO">
          <PremiumCrednivoBrand />
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
