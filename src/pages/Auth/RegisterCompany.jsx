import {
  ArrowLeft, Building2, Camera, CheckCircle2, ChevronLeft, ChevronRight,
  Eye, EyeOff, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Upload, UserRound
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthLoading } from './Login';
import './Auth.css';

const initialForm = {
  companyName: '', ownerName: '', companyMobile: '', ownerMobile: '',
  email: '', branch: '', address: '', password: '', confirm: '',
  logoFile: null, logoPreview: '',
};

const steps = [
  { id: 1, key: 'company', label: 'Company Details' },
  { id: 2, key: 'owner', label: 'Owner Details' },
  { id: 3, key: 'security', label: 'Security & Review' },
];

export default function RegisterCompany() {
  const { loading, user, registerCompany } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;

  const companyMobile = useMemo(() => String(form.companyMobile || '').replace(/\D/g, ''), [form.companyMobile]);
  const ownerMobile = useMemo(() => String(form.ownerMobile || '').replace(/\D/g, ''), [form.ownerMobile]);

  const change = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((current) => ({ ...current, logoFile: file, logoPreview: URL.createObjectURL(file) }));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!form.companyName.trim() || !form.email.trim() || !form.branch.trim() || !form.address.trim()) {
        return 'Complete the company name, email, branch and address.';
      }
      if (companyMobile.length !== 10) {
        return 'Company mobile must contain exactly 10 digits.';
      }
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
        return 'Enter a valid company email address.';
      }
    }

    if (currentStep === 2) {
      if (!form.ownerName.trim()) {
        return 'Enter the MD / Owner name.';
      }
      if (ownerMobile.length !== 10) {
        return 'Owner mobile must contain exactly 10 digits.';
      }
    }

    if (currentStep === 3) {
      if (form.password.length < 8) {
        return 'Password must contain at least 8 characters.';
      }
      if (form.password !== form.confirm) {
        return 'Passwords do not match.';
      }
    }

    return '';
  };

  const nextStep = () => {
    const nextError = validateStep(step);
    if (nextError) {
      setError(nextError);
      return;
    }
    setError('');
    setStep((value) => Math.min(value + 1, steps.length));
  };

  const prevStep = () => {
    setError('');
    setStep((value) => Math.max(value - 1, 1));
  };

  const submit = async (event) => {
    event.preventDefault();
    const finalError = validateStep(1) || validateStep(2) || validateStep(3);
    if (finalError) {
      setError(finalError);
      return;
    }

    try {
      setBusy(true);
      setError('');
      await registerCompany({
        companyName: form.companyName.trim(),
        ownerName: form.ownerName.trim(),
        companyMobile,
        ownerMobile,
        email: form.email.trim(),
        branch: form.branch.trim(),
        address: form.address.trim(),
        password: form.password,
        logoFile: form.logoFile,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Could not register company.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-step-page">
      <section className="auth-step-shell">
        <div className="auth-back-row auth-step-back"><Link to="/login"><ArrowLeft size={16} /> Back to Sign In</Link></div>

        <header className="auth-step-header">
          <div>
            <h1>Register Company</h1>
            <p>Create the company profile and owner login together.</p>
          </div>
        </header>

        <section className="auth-step-card">
          <div className="auth-step-card-head">
            <div className="auth-step-card-title">
              <span className="auth-heading-icon"><Building2 size={22} /></span>
              <div>
                <strong>Company & Owner Details</strong>
                <small>Complete all steps to create the workspace.</small>
              </div>
            </div>

            <div className="auth-step-progress">
              {steps.map((item) => {
                const active = step === item.id;
                const done = step > item.id;
                return (
                  <div key={item.id} className={`auth-step-chip ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                    <span>{done ? <CheckCircle2 size={14} /> : item.id}</span>
                    <strong>{item.label}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          <form className="auth-step-form" onSubmit={submit}>
            {step === 1 && (
              <div className="auth-step-panel">
                <div className="auth-step-grid">
                  <label className="auth-line-field">
                    <span>Company Name *</span>
                    <div><Building2 size={18} /><input value={form.companyName} onChange={change('companyName')} placeholder="Enter company name" /></div>
                  </label>

                  <label className="auth-line-field">
                    <span>Company Mobile *</span>
                    <div><Phone size={18} /><input inputMode="numeric" maxLength={10} value={form.companyMobile} onChange={change('companyMobile')} placeholder="Enter 10-digit mobile number" /></div>
                  </label>

                  <label className="auth-line-field">
                    <span>Company Email *</span>
                    <div><Mail size={18} /><input type="email" value={form.email} onChange={change('email')} placeholder="Enter company email address" /></div>
                  </label>

                  <label className="auth-line-field">
                    <span>Branch Name / Location *</span>
                    <div><MapPin size={18} /><input value={form.branch} onChange={change('branch')} placeholder="Enter branch name or location" /></div>
                  </label>

                  <label className="auth-line-field auth-wide-field">
                    <span>Address *</span>
                    <div className="auth-line-area"><MapPin size={18} /><textarea rows="3" value={form.address} onChange={change('address')} placeholder="Enter complete company address" /></div>
                  </label>
                </div>

                <div className="auth-upload-strip">
                  <div className={`auth-upload-avatar ${form.logoPreview ? 'has-image' : ''}`}>
                    {form.logoPreview ? <img src={form.logoPreview} alt="Company logo preview" /> : <Building2 size={28} />}
                  </div>
                  <div className="auth-upload-strip-copy">
                    <strong>Company Logo / Photo</strong>
                    <small>Optional — JPG, PNG or WEBP</small>
                  </div>
                  <label className="auth-upload-pill">
                    <Upload size={16} /> Upload
                    <input type="file" accept="image/*" onChange={chooseLogo} />
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="auth-step-panel">
                <div className="auth-step-grid auth-step-grid-single">
                  <label className="auth-line-field">
                    <span>MD / Owner Name *</span>
                    <div><UserRound size={18} /><input value={form.ownerName} onChange={change('ownerName')} placeholder="Enter MD / Owner name" /></div>
                  </label>

                  <label className="auth-line-field">
                    <span>Owner Mobile *</span>
                    <div><Phone size={18} /><input inputMode="numeric" maxLength={10} value={form.ownerMobile} onChange={change('ownerMobile')} placeholder="Enter owner mobile number" /></div>
                  </label>
                </div>

                <div className="auth-step-note">
                  <ShieldCheck size={16} />
                  <span>The owner mobile number will be used for sign in and secure workspace access.</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="auth-step-panel">
                <div className="auth-step-grid auth-step-grid-single">
                  <label className="auth-line-field">
                    <span>Create Password *</span>
                    <div>
                      <LockKeyhole size={18} />
                      <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={change('password')} placeholder="Minimum 8 characters" />
                      <button type="button" className="auth-line-toggle" onClick={() => setShowPassword((v) => !v)}>
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </label>

                  <label className="auth-line-field">
                    <span>Confirm Password *</span>
                    <div>
                      <LockKeyhole size={18} />
                      <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={change('confirm')} placeholder="Re-enter password" />
                    </div>
                  </label>
                </div>

                <div className="auth-review-card">
                  <strong>Review Summary</strong>
                  <div className="auth-review-grid">
                    <div><span>Company</span><strong>{form.companyName || '-'}</strong></div>
                    <div><span>Branch</span><strong>{form.branch || '-'}</strong></div>
                    <div><span>Owner</span><strong>{form.ownerName || '-'}</strong></div>
                    <div><span>Owner Mobile</span><strong>{form.ownerMobile || '-'}</strong></div>
                  </div>
                </div>
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <div className="auth-step-actions">
              <button type="button" className="auth-step-secondary" onClick={prevStep} disabled={step === 1 || busy}>
                <ChevronLeft size={16} /> Previous
              </button>

              {step < steps.length ? (
                <button type="button" className="auth-primary-button" onClick={nextStep}>
                  Next Step <ChevronRight size={16} />
                </button>
              ) : (
                <button className="auth-primary-button" type="submit" disabled={busy}>
                  <CheckCircle2 size={18} /> {busy ? 'Creating Company...' : 'Register Company & Owner'}
                </button>
              )}
            </div>
          </form>

          <div className="auth-switch-note"><UserRound size={16} /><span>Already registered? <Link to="/login">Sign in to CREDNIVO</Link></span></div>
        </section>
      </section>
    </main>
  );
}
