import {
  ArrowLeft, BarChart3, Building2, Camera, CheckCircle2, Eye, EyeOff,
  Landmark, ShieldCheck, UserRound
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthLoading } from './Login';
import './Auth.css';

const initialForm = {
  companyName: '', ownerName: '', companyMobile: '', ownerMobile: '',
  email: '', branch: '', address: '', password: '', confirm: '',
  logoFile: null, logoPreview: '',
};

export default function RegisterCompany() {
  const { loading, user, status, registerCompany } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((current) => ({ ...current, logoFile: file, logoPreview: URL.createObjectURL(file) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const companyMobile = String(form.companyMobile || '').replace(/\D/g, '');
    const ownerMobile = String(form.ownerMobile || '').replace(/\D/g, '');
    if (!form.companyName.trim() || !form.ownerName.trim() || !form.branch.trim() || !form.address.trim()) {
      setError('Complete the company, owner, branch and address details.'); return;
    }
    if (companyMobile.length !== 10 || ownerMobile.length !== 10) {
      setError('Company mobile and owner mobile must contain exactly 10 digits.'); return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Enter a valid company email address.'); return; }
    if (form.password.length < 8) { setError('Password must contain at least 8 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    try {
      setBusy(true);
      await registerCompany({
        companyName: form.companyName.trim(), ownerName: form.ownerName.trim(),
        companyMobile, ownerMobile, email: form.email.trim(), branch: form.branch.trim(),
        address: form.address.trim(), password: form.password, logoFile: form.logoFile,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.message || 'Could not register company.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page auth-registration-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-lockup"><span className="auth-brand-mark"><BarChart3 size={34} /></span><div><strong>CREDNIVO</strong><small>Finance Management Platform</small></div></div>
        <div className="auth-brand-copy"><span className="auth-kicker"><Landmark size={16} /> Company Registration</span><h1>Create your own finance workspace and owner access.</h1><p>No OTP and no email verification for this phase. Your owner password is hashed before it is stored.</p></div>
        <div className="auth-company-chip"><ShieldCheck size={18} /><div><small>Registration mode</small><strong>Company + Owner</strong><span>Direct secure setup</span></div></div>
      </section>

      <section className="auth-form-panel auth-registration-panel">
        <div className="auth-form-card auth-registration-card">
          <div className="auth-back-row"><Link to="/login"><ArrowLeft size={16} /> Back to Sign In</Link></div>
          <div className="auth-form-heading"><span className="auth-heading-icon"><Building2 size={22} /></span><div><small>CREATE ACCOUNT</small><h2>Register Company</h2><p>Create the company profile and Owner login together.</p></div></div>

          <div className="auth-info-note"><ShieldCheck size={17} /><span>Each registration creates a separate company workspace. Customers, loans, collections, expenses, capital, agents and reports stay isolated from other companies. Branch names must be unique.</span></div>

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-registration-grid">
              <label><span>Company Name *</span><input value={form.companyName} onChange={change('companyName')} placeholder="Sangam Fin Capital" /></label>
              <label><span>MD / Owner Name *</span><input value={form.ownerName} onChange={change('ownerName')} placeholder="Owner name" /></label>
              <label><span>Company Mobile *</span><input inputMode="numeric" maxLength={10} value={form.companyMobile} onChange={change('companyMobile')} placeholder="10-digit mobile" /></label>
              <label><span>Owner Mobile *</span><input inputMode="numeric" maxLength={10} value={form.ownerMobile} onChange={change('ownerMobile')} placeholder="Login mobile" /></label>
              <label><span>Company Email *</span><input type="email" value={form.email} onChange={change('email')} placeholder="company@example.com" /></label>
              <label><span>Branch Name / Location *</span><input value={form.branch} onChange={change('branch')} placeholder="Main Branch" /></label>
              <label className="auth-wide-field"><span>Address *</span><textarea rows="3" value={form.address} onChange={change('address')} placeholder="Company address" /></label>
            </div>

            <div className="auth-upload-row">
              <div className="auth-upload-preview">{form.logoPreview ? <img src={form.logoPreview} alt="Company logo preview" /> : <Building2 size={30} />}</div>
              <label className="auth-upload-button"><Camera size={17} /><span>Company Logo / Photo</span><input type="file" accept="image/*" onChange={chooseLogo} /></label>
            </div>

            <div className="auth-registration-grid">
              <label><span>Create Password *</span><div className="auth-password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={change('password')} placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              <label><span>Confirm Password *</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={change('confirm')} placeholder="Re-enter password" /></label>
            </div>

            {error && <div className="auth-error">{error}</div>}
            <button className="auth-primary-button" type="submit" disabled={busy}><CheckCircle2 size={18} />{busy ? 'Creating Company...' : 'Register Company & Owner'}</button>
          </form>
          <div className="auth-switch-note"><UserRound size={16} /><span>Already registered? <Link to="/login">Sign in to CREDNIVO</Link></span></div>
        </div>
      </section>
    </main>
  );
}
