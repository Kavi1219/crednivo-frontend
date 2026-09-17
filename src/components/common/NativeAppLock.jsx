import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  ArrowLeft,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import goldMark from '../../assets/brand/crednivo-gold-mark.png';
import {
  accountEmail,
  accountHolderName,
  createPinRecord,
  fingerprintAvailability,
  isNativeCrednivoApp,
  isUserFallbackError,
  maskEmail,
  readPinRecord,
  savePinRecord,
  deletePinRecord,
  verifyFingerprint,
  verifyPin,
} from '../../services/nativeAppLock';
import './NativeAppLock.css';

const BACKGROUND_LOCK_MS = 30_000;
const MAX_PIN_ATTEMPTS = 5;

function NumericCodeInput({ length, value, onChange, label, autoFocus = false }) {
  const inputRef = useRef(null);
  const digits = Array.from({ length }, (_, index) => value[index] || '');

  const update = (event) => {
    const next = String(event.target.value || '').replace(/\D/g, '').slice(0, length);
    onChange(next);
  };

  return (
    <div className={`native-lock-code-wrap ${length === 6 ? 'six' : 'four'}`}>
      <input
        ref={inputRef}
        className="native-lock-code-input"
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={length}
        value={value}
        onChange={update}
        aria-label={label}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="native-lock-boxes"
        onClick={() => inputRef.current?.focus()}
        aria-label={label}
      >
        {digits.map((digit, index) => (
          <span key={index} className={digit ? 'filled' : ''}>
            {digit ? '•' : ''}
          </span>
        ))}
      </button>
    </div>
  );
}

function BrandHeader({ name, compact = false }) {
  return (
    <div className={`native-lock-brand ${compact ? 'compact' : ''}`}>
      <img src={goldMark} alt="CREDNIVO" draggable="false" />
      <div>
        <strong>CREDNIVO</strong>
        <small>Finance Management Platform</small>
      </div>
      {name && <p>{name}</p>}
    </div>
  );
}

export default function NativeAppLock() {
  const { user, status, logout } = useAuth();
  const native = isNativeCrednivoApp();
  const holderName = useMemo(() => accountHolderName(user, status), [user, status]);
  const email = useMemo(() => accountEmail(user), [user]);

  const [phase, setPhase] = useState('idle');
  const [record, setRecord] = useState(null);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [resendSeconds, setResendSeconds] = useState(0);
  const backgroundAtRef = useRef(0);
  const biometricPromptRef = useRef(false);
  const mountedRef = useRef(true);

  const setViewportVars = useCallback(() => {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    document.documentElement.style.setProperty('--crednivo-lock-height', `${Math.max(280, height)}px`);
    document.documentElement.style.setProperty('--crednivo-lock-top', `${Math.max(0, top)}px`);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setViewportVars();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', setViewportVars);
    viewport?.addEventListener('scroll', setViewportVars);
    window.addEventListener('resize', setViewportVars);
    return () => {
      mountedRef.current = false;
      viewport?.removeEventListener('resize', setViewportVars);
      viewport?.removeEventListener('scroll', setViewportVars);
      window.removeEventListener('resize', setViewportVars);
    };
  }, [setViewportVars]);

  const beginLock = useCallback(async () => {
    if (!native || !user) {
      setPhase('idle');
      return;
    }

    setError('');
    setMessage('');
    setPin('');
    setFirstPin('');
    setAttempts(0);
    setPhase('loading');
    setBusy(true);

    const saved = await readPinRecord(user);
    if (!mountedRef.current) return;
    setRecord(saved);

    if (saved && saved.lockEnabled === false) {
      // User turned the App Lock off in Settings, or skipped setup earlier.
      setPhase('unlocked');
      setBusy(false);
      return;
    }

    if (!saved || !saved.pinHash) {
      setPhase('setup-pin');
      setBusy(false);
      return;
    }

    if (saved.biometricEnabled) {
      const availability = await fingerprintAvailability();
      if (!mountedRef.current) return;
      if (availability.isAvailable) {
        setPhase('biometric');
      } else {
        setPhase('pin');
        setMessage('Fingerprint is not available right now. Use your PIN.');
      }
    } else {
      setPhase('pin');
    }

    setBusy(false);
  }, [native, user]);

  useEffect(() => {
    if (!native || !user) {
      setPhase('idle');
      setRecord(null);
      return;
    }
    beginLock();
  }, [beginLock, native, user]);

  useEffect(() => {
    if (!native) return undefined;
    let handle;
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundAtRef.current = Date.now();
        return;
      }
      const awayFor = backgroundAtRef.current ? Date.now() - backgroundAtRef.current : 0;
      backgroundAtRef.current = 0;
      if (user && awayFor >= BACKGROUND_LOCK_MS) beginLock();
    }).then((listener) => { handle = listener; });
    return () => handle?.remove();
  }, [beginLock, native, user]);

  useEffect(() => {
    if (!native || !user) return undefined;
    window.addEventListener('crednivo-lock-settings-changed', beginLock);
    return () => window.removeEventListener('crednivo-lock-settings-changed', beginLock);
  }, [beginLock, native, user]);

  useEffect(() => {
    if (!resendSeconds) return undefined;
    const timer = window.setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const unlock = useCallback(() => {
    biometricPromptRef.current = false;
    setError('');
    setMessage('');
    setPin('');
    setPhase('unlocked');
  }, []);

  const promptFingerprint = useCallback(async () => {
    if (biometricPromptRef.current || phase !== 'biometric') return;
    biometricPromptRef.current = true;
    setError('');
    try {
      await verifyFingerprint(holderName);
      if (mountedRef.current) unlock();
    } catch (err) {
      if (!mountedRef.current) return;
      if (isUserFallbackError(err)) {
        setPin('');
        setPhase('pin');
      } else {
        setMessage('Fingerprint was not verified. Try again or use your PIN.');
      }
    } finally {
      biometricPromptRef.current = false;
    }
  }, [holderName, phase, unlock]);

  useEffect(() => {
    if (phase !== 'biometric') return undefined;
    const timer = window.setTimeout(() => promptFingerprint(), 500);
    return () => window.clearTimeout(timer);
  }, [phase, promptFingerprint]);

  const finishPinCreation = useCallback(async (newPin, mode = 'setup') => {
    setBusy(true);
    setError('');
    try {
      let nextRecord = await createPinRecord(newPin, { biometricEnabled: false });
      await savePinRecord(user, nextRecord);
      setRecord(nextRecord);

      const availability = await fingerprintAvailability();
      if (availability.isAvailable) {
        nextRecord = { ...nextRecord, biometricEnabled: true, updatedAt: new Date().toISOString() };
        await savePinRecord(user, nextRecord);
        setRecord(nextRecord);
        try {
          await verifyFingerprint(holderName);
        } catch {
          // Fingerprint stays enabled for future opens; the PIN remains the fallback.
        }
      }

      setMessage(mode === 'reset' ? 'Your new PIN is ready.' : 'Your App PIN is ready.');
      unlock();
    } catch (err) {
      setError(err?.message || 'Could not save your App PIN.');
    } finally {
      setBusy(false);
    }
  }, [holderName, unlock, user]);

  const skipSetup = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const minimalRecord = {
        version: 1,
        salt: '',
        pinHash: '',
        biometricEnabled: false,
        lockEnabled: false,
        updatedAt: new Date().toISOString(),
      };
      await savePinRecord(user, minimalRecord);
      setRecord(minimalRecord);
      setPhase('unlocked');
    } catch (err) {
      setError(err?.message || 'Could not skip setup right now.');
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => {
    if (phase === 'setup-pin' && pin.length === 4) {
      const timer = window.setTimeout(() => {
        setFirstPin(pin);
        setPin('');
        setPhase('setup-confirm');
      }, 180);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'setup-confirm' && pin.length === 4) {
      const timer = window.setTimeout(() => {
        if (pin !== firstPin) {
          setError('PINs do not match. Create the PIN again.');
          setFirstPin('');
          setPin('');
          setPhase('setup-pin');
          return;
        }
        finishPinCreation(pin, 'setup');
      }, 180);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'forgot-new-pin' && pin.length === 4) {
      const timer = window.setTimeout(() => {
        setFirstPin(pin);
        setPin('');
        setPhase('forgot-confirm-pin');
      }, 180);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'forgot-confirm-pin' && pin.length === 4) {
      const timer = window.setTimeout(() => {
        if (pin !== firstPin) {
          setError('PINs do not match. Enter a new PIN again.');
          setFirstPin('');
          setPin('');
          setPhase('forgot-new-pin');
          return;
        }
        finishPinCreation(pin, 'reset');
      }, 180);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [finishPinCreation, firstPin, phase, pin]);

  useEffect(() => {
    if (phase !== 'pin' || pin.length !== 4 || !record) return undefined;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      const valid = await verifyPin(pin, record);
      if (valid) {
        setBusy(false);
        unlock();
        return;
      }

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setPin('');
      setBusy(false);

      if (nextAttempts >= MAX_PIN_ATTEMPTS) {
        setError('Too many incorrect PIN attempts. Please sign in again with your account password.');
        try { await deletePinRecord(user); } catch { /* full login remains the fallback */ }
        window.setTimeout(() => logout(), 900);
      } else {
        setError(`Incorrect PIN. ${MAX_PIN_ATTEMPTS - nextAttempts} attempt${MAX_PIN_ATTEMPTS - nextAttempts === 1 ? '' : 's'} remaining.`);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [attempts, logout, phase, pin, record, unlock]);

  const sendForgotPinOtp = useCallback(async () => {
    if (!email) {
      setError('No verified email is available for this account. Sign in again and verify your account email.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest('/auth/otp-login/send', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, role: user?.role }),
      });
      setMaskedEmail(result?.maskedEmail || maskEmail(email));
      setOtp('');
      setResendSeconds(60);
      setPhase('forgot-otp');
      setMessage('Enter the 6-digit OTP sent to your registered email.');
    } catch (err) {
      setError(err?.message || 'Could not send the OTP.');
    } finally {
      setBusy(false);
    }
  }, [email, user?.role]);

  const verifyForgotPinOtp = useCallback(async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit OTP.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await apiRequest('/auth/otp-login/verify', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ email, role: user?.role, otp }),
      });
      setOtp('');
      setPin('');
      setFirstPin('');
      setPhase('forgot-new-pin');
      setMessage('OTP verified. Create your new 4-digit App PIN.');
    } catch (err) {
      setError(err?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  }, [email, otp, user?.role]);

  if (!native || !user || phase === 'idle' || phase === 'unlocked') return null;

  const pinHeading = phase === 'setup-pin'
    ? 'Create your App PIN'
    : phase === 'setup-confirm'
      ? 'Confirm your App PIN'
      : phase === 'forgot-new-pin'
        ? 'Create a new PIN'
        : phase === 'forgot-confirm-pin'
          ? 'Confirm your new PIN'
          : 'Enter your PIN';

  const showPin = ['pin', 'setup-pin', 'setup-confirm', 'forgot-new-pin', 'forgot-confirm-pin'].includes(phase);

  return (
    <div className="native-lock-overlay" role="dialog" aria-modal="true" aria-label="CREDNIVO App Lock">
      <div className="native-lock-shell">
        {phase === 'biometric' && (
          <section className="native-lock-panel native-lock-fingerprint-panel">
            <BrandHeader name={holderName} />
            <button type="button" className="native-lock-fingerprint" onClick={promptFingerprint} disabled={busy}>
              <span className="native-lock-fingerprint-ring"><Fingerprint /></span>
              <strong>Unlock with fingerprint</strong>
              <small>Touch your fingerprint sensor to continue</small>
            </button>
            {message && <p className="native-lock-message">{message}</p>}
            {error && <p className="native-lock-error">{error}</p>}
            <button type="button" className="native-lock-use-pin" onClick={() => { setPin(''); setError(''); setMessage(''); setPhase('pin'); }}>
              Use PIN
            </button>
          </section>
        )}

        {showPin && (
          <section className="native-lock-panel native-lock-pin-panel">
            <BrandHeader name={holderName} compact />
            <div className="native-lock-pin-main">
              <span className="native-lock-mini-icon"><KeyRound /></span>
              <h1>{pinHeading}</h1>
              <p>{phase === 'pin' ? 'Use your 4-digit CREDNIVO App PIN' : 'Choose a 4-digit PIN for this device'}</p>

              <div className="native-lock-pin-zone">
                <NumericCodeInput
                  length={4}
                  value={pin}
                  onChange={(value) => { setError(''); setPin(value); }}
                  label={pinHeading}
                />
                {phase === 'pin' && (
                  <button type="button" className="native-lock-forgot" onClick={sendForgotPinOtp} disabled={busy}>
                    Forgot PIN?
                  </button>
                )}
                {phase === 'setup-pin' && (
                  <button type="button" className="native-lock-forgot" onClick={skipSetup} disabled={busy}>
                    Skip for now
                  </button>
                )}
              </div>

              {busy && <p className="native-lock-status"><LoaderCircle className="spin" /> Checking…</p>}
              {message && !busy && <p className="native-lock-message">{message}</p>}
              {error && <p className="native-lock-error">{error}</p>}
            </div>

            {phase === 'pin' && record?.biometricEnabled && (
              <button type="button" className="native-lock-back-biometric" onClick={() => { setPin(''); setError(''); setPhase('biometric'); }}>
                <Fingerprint /> Use fingerprint
              </button>
            )}
          </section>
        )}

        {phase === 'forgot-otp' && (
          <section className="native-lock-panel native-lock-otp-panel">
            <BrandHeader name={holderName} compact />
            <div className="native-lock-pin-main">
              <span className="native-lock-mini-icon"><Mail /></span>
              <h1>Verify your email</h1>
              <p>We sent a 6-digit OTP to <strong>{maskedEmail || maskEmail(email)}</strong></p>
              <NumericCodeInput
                length={6}
                value={otp}
                onChange={(value) => { setError(''); setOtp(value); }}
                label="Email OTP"
                autoFocus
              />
              {message && <p className="native-lock-message">{message}</p>}
              {error && <p className="native-lock-error">{error}</p>}
              <button type="button" className="native-lock-primary" onClick={verifyForgotPinOtp} disabled={busy || otp.length !== 6}>
                {busy ? <><LoaderCircle className="spin" /> Verifying</> : <><ShieldCheck /> Verify OTP</>}
              </button>
              <button type="button" className="native-lock-resend" disabled={busy || resendSeconds > 0} onClick={sendForgotPinOtp}>
                {resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}
              </button>
            </div>
            <button type="button" className="native-lock-back" onClick={() => { setOtp(''); setError(''); setMessage(''); setPhase('pin'); }}>
              <ArrowLeft /> Back to PIN
            </button>
          </section>
        )}

        {busy && phase === 'loading' && (
          <section className="native-lock-panel native-lock-loading-panel">
            <BrandHeader />
            <LoaderCircle className="spin native-lock-loader" />
            <p>Preparing secure unlock…</p>
          </section>
        )}
      </div>
    </div>
  );
}
