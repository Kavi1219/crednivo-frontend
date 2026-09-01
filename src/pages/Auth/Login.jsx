import {
  ArrowRight,
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import crednivoApprovedMark from '../../assets/brand/crednivo-approved-mark.png';
import './Auth.css';

const LOGIN_PREF_KEY = 'crednivo-login-preferences';

function readLoginPreferences() {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_PREF_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function Login() {
  const { loading, user, login } = useAuth();
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
  };

  return (
    <main className="auth-page auth-login-page auth-login-mirror">
      <section className="auth-login-split">
        <aside className="auth-login-brand-side" aria-label="CREDNIVO">
          <div className="crednivo-cinematic-brand" aria-label="CREDNIVO Finance Management Platform">
            <div className="crednivo-cinematic-symbol" aria-hidden="true">
              <img
                className="crednivo-approved-mark crednivo-approved-mark-login"
                src={crednivoApprovedMark}
                alt=""
              />
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
                    ? 'Enter employee ID or phone number'
                    : 'Enter user ID or phone number'}
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

            <div className="auth-login-options">
              <label className="auth-remember-control">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span className="auth-checkbox-ui" aria-hidden="true" />
                <span>Remember me</span>
              </label>
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-primary-button auth-login-submit" type="submit" disabled={busy}>
              <span>{busy ? 'Signing in...' : 'Sign In'}</span>
              {!busy && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="auth-login-divider"><span>OR</span></div>
          <div className="auth-create-row">
            <span>New to CREDNIVO?</span>
            <button type="button" onClick={() => setShowCreate(true)}>Create an account</button>
          </div>
        </section>
      </section>

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
        <img
          className="crednivo-approved-mark crednivo-approved-mark-loader"
          src={crednivoApprovedMark}
          alt=""
        />
      </div>

      <strong>CREDNIVO</strong>
      <small>Securing workspace...</small>
    </main>
  );
}
