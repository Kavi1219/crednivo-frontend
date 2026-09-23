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
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { apiRequest } from '../../services/api';
import AuthLoading from '../../components/common/AuthLoading';
import './Auth.css';

const LOGIN_PREF_KEY = 'crednivo-login-preferences';

function readLoginPreferences() {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_PREF_KEY) || '{}');
  } catch {
    return {};
  }
}

async function saveCredentialToBrowser(identifier, password) {
  // Never store the raw password in localStorage. Let the browser / Android
  // password manager store it in its protected credential store instead.
  try {
    if (
      typeof window === 'undefined'
      || typeof navigator === 'undefined'
      || !navigator.credentials?.store
      || typeof window.PasswordCredential === 'undefined'
    ) return;

    const credential = new window.PasswordCredential({
      id: identifier,
      name: identifier,
      password,
    });
    await navigator.credentials.store(credential);
  } catch {
    // Browser credential APIs are optional. Standard autocomplete attributes
    // below still allow Chrome/Edge/Android password managers to save/autofill.
  }
}

// V51 — Gold emblem + blue glass login redesign. Authentication logic is unchanged.
export default function Login() {
  const actionLocksRef = useRef(new Set());

  const { loading, user, login, otpLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addMode = searchParams.get('mode') === 'add';
  const saved = readLoginPreferences();
  const [role, setRole] = useState(saved.role === 'AGENT' ? 'AGENT' : 'OWNER');
  const [identifier, setIdentifier] = useState(saved.remember ? (saved.identifier || '') : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isNativeApp = Capacitor.isNativePlatform();
  const [remember, setRemember] = useState(isNativeApp ? true : Boolean(saved.remember));
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
  if (user && !addMode) return <Navigate to="/overview" replace />;

  const submit = async (event) => {
    if (actionLocksRef.current.has('submit')) return;
    actionLocksRef.current.add('submit');
    try {
    event.preventDefault();
    setError('');

    // Read directly from the submitted form as well as React state. This makes
    // browser/Android password-manager autofill reliable even when a browser
    // does not dispatch a normal React change event for an autofilled field.
    const submitted = new FormData(event.currentTarget);
    const submittedIdentifier = String(submitted.get('username') || identifier || '').trim();
    const submittedPassword = String(submitted.get('password') || password || '');

    if (!submittedIdentifier || !submittedPassword) {
      setError('Enter your User ID / Phone Number and password.');
      return;
    }

    try {
      setBusy(true);
      await login({
        identifier: submittedIdentifier,
        password: submittedPassword,
        role,
        remember,
      });

      if (remember && !addMode) {
        localStorage.setItem(LOGIN_PREF_KEY, JSON.stringify({
          remember: true,
          role,
          identifier: submittedIdentifier,
        }));
        await saveCredentialToBrowser(submittedIdentifier, submittedPassword);
      } else if (!addMode) {
        localStorage.removeItem(LOGIN_PREF_KEY);
      }

      navigate('/overview', { replace: true });
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
      navigate('/overview', { replace: true });
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
            <div className="crednivo-cinematic-symbol crednivo-premium-symbol crednivo-classic-symbol" aria-hidden="true">
              <svg
                className="crednivo-premium-svg crednivo-classic-svg"
                viewBox="0 0 360 330"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="cnV54Gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f4dfaa" />
                    <stop offset="23%" stopColor="#d9b86b" />
                    <stop offset="52%" stopColor="#9b6a22" />
                    <stop offset="76%" stopColor="#d6ad58" />
                    <stop offset="100%" stopColor="#f0d695" />
                  </linearGradient>

                  <linearGradient id="cnV54GoldLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f8e6b9" />
                    <stop offset="45%" stopColor="#c99a43" />
                    <stop offset="100%" stopColor="#8b5a1c" />
                  </linearGradient>

                  <linearGradient id="cnV54Steel" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="28%" stopColor="#cbd3db" />
                    <stop offset="58%" stopColor="#6f7b88" />
                    <stop offset="78%" stopColor="#e8edf1" />
                    <stop offset="100%" stopColor="#8995a1" />
                  </linearGradient>

                  <filter id="cnV54Shadow" x="-40%" y="-40%" width="180%" height="180%">
                    <feDropShadow dx="0" dy="11" stdDeviation="8" floodColor="#000000" floodOpacity=".42" />
                  </filter>

                  <filter id="cnV54SoftShine" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="2.2" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Classic open C */}
                <g className="cn-v54-c" filter="url(#cnV54Shadow)" transform="rotate(-7 150 158) translate(-8 4)">
                  <path
                    className="cn-v54-c-main"
                    pathLength="100"
                    d="M258 69
                       C226 39 184 26 143 32
                       C86 40 46 85 42 143
                       C37 204 75 255 131 273
                       C178 288 228 272 258 237"
                    fill="none"
                    stroke="url(#cnV54Gold)"
                    strokeWidth="43"
                    strokeLinecap="butt"
                    strokeLinejoin="round"
                  />
                  <path
                    className="cn-v54-c-edge"
                    pathLength="100"
                    d="M251 67
                       C221 43 183 34 147 39
                       C96 46 61 87 58 140"
                    fill="none"
                    stroke="#f8e6b7"
                    strokeOpacity=".72"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    className="cn-v54-c-lower-edge"
                    pathLength="100"
                    d="M62 210
                       C78 242 107 264 141 273
                       C183 284 225 270 251 241"
                    fill="none"
                    stroke="#704616"
                    strokeOpacity=".58"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>

                {/* Slim classic growth bars */}
                <g className="cn-v54-bars">
                  <rect className="cn-v54-bar cn-v54-bar-1" x="104" y="204" width="24" height="54" rx="4" fill="url(#cnV54GoldLight)" />
                  <rect className="cn-v54-bar cn-v54-bar-2" x="141" y="175" width="25" height="83" rx="4" fill="url(#cnV54GoldLight)" />
                  <rect className="cn-v54-bar cn-v54-bar-3" x="179" y="140" width="26" height="118" rx="4" fill="url(#cnV54GoldLight)" />

                  <line x1="111" y1="210" x2="111" y2="249" stroke="#fff4cf" strokeOpacity=".44" strokeWidth="2" />
                  <line x1="148" y1="181" x2="148" y2="249" stroke="#fff4cf" strokeOpacity=".40" strokeWidth="2" />
                  <line x1="186" y1="146" x2="186" y2="249" stroke="#fff4cf" strokeOpacity=".36" strokeWidth="2" />
                </g>

                {/* Single continuous curved growth arrow */}
                <g className="cn-v64-arrow">
                  <path
                    className="cn-v64-arrow-shape"
                    d="
                      M112 230
                      C143 214 173 193 198 169
                      C222 146 245 118 266 88
                      L256 82
                      L290 72
                      L288 107
                      L278 99
                      C254 131 231 158 206 181
                      C180 205 150 226 118 241
                      Z
                    "
                    fill="url(#cnV54Gold)"
                    stroke="#ecd49a"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path
                    className="cn-v64-arrow-highlight"
                    d="
                      M119 229
                      C148 214 176 194 200 172
                      C224 150 245 124 264 97
                    "
                    fill="none"
                    stroke="#f8e6ba"
                    strokeOpacity=".62"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <circle
                    className="cn-v64-arrow-shine"
                    cx="284"
                    cy="79"
                    r="3.2"
                    fill="#fff5cf"
                  />
                </g>
              </svg>
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
          {addMode && (
            <div className="auth-add-account-banner">
              <UsersRound size={16} />
              <span>Adding another company account &mdash; you'll stay signed in to your current one too.</span>
              <button type="button" onClick={() => navigate('/overview', { replace: true })}>Cancel</button>
            </div>
          )}
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

          <form className="auth-form auth-login-form auth-login-line-form" onSubmit={submit} autoComplete="on">
            <label>
              <span>User ID / Phone Number</span>
              <div className="auth-input-shell auth-line-input">
                <UserRound size={18} />
                <input
                  id="crednivo-login-username"
                  name="username"
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
                  id="crednivo-login-password"
                  name="password"
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
              {!isNativeApp && (
                <label className="auth-remember-control">
                  <input
                    id="crednivo-remember-me"
                    name="remember"
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span className="auth-checkbox-ui" aria-hidden="true" />
                  <span>Remember me</span>
                </label>
              )}
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

