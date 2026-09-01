import {
  ArrowLeft,
  BarChart3,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { AuthLoading } from './Login';
import './Auth.css';
import crednivoApprovedMark from '../../assets/brand/crednivo-approved-mark.png';

export default function RegisterAgent() {
  const { loading, user, status, registerAgent } = useAuth();
  const [form, setForm] = useState({
    name: '', mobile: '', companyName: '', branch: '',
    password: '', confirm: '', photoFile: null, photoPreview: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    apiRequest('/auth/companies', { skipAuth: true }).then((rows) => setWorkspaces(rows || [])).catch(() => setWorkspaces([]));
  }, []);

  useEffect(() => {
    if (loading) return;
    setForm((current) => ({
      ...current,
      companyName: current.companyName || (status?.companyName === 'CREDNIVO' ? '' : (status?.companyName || '')),
      branch: current.branch || (status?.branch || ''),
    }));
  }, [loading, status?.companyName, status?.branch]);

  if (loading) return <AuthLoading />;
  if (user) return <Navigate to="/" replace />;

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const changeCompany = (event) => {
    const value = event.target.value;
    const matches = workspaces.filter((item) => String(item.name || '').toLowerCase() === value.trim().toLowerCase());
    setForm((current) => ({ ...current, companyName: value, branch: matches.length === 1 ? matches[0].branch : current.branch }));
  };
  const branchOptions = workspaces.filter((item) => !form.companyName.trim() || String(item.name || '').toLowerCase() === form.companyName.trim().toLowerCase());
  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((current) => ({ ...current, photoFile: file, photoPreview: URL.createObjectURL(file) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const mobile = String(form.mobile || '').replace(/\D/g, '');
    if (!form.name.trim() || mobile.length !== 10 || !form.companyName.trim() || !form.branch.trim()) {
      setError('Enter agent name, valid mobile, company name and branch.'); return;
    }
    if (!form.photoFile) { setError('Add the agent profile photo.'); return; }
    if (form.password.length < 8) { setError('Password must contain at least 8 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    try {
      setBusy(true);
      const result = await registerAgent({ ...form, mobile });
      setSubmitted(result);
    } catch (err) {
      setError(err?.message || 'Could not submit agent registration.');
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <main className="auth-page auth-registration-page auth-registration-v2">
        <header className="auth-site-header">
          <div className="auth-site-brand"><span className="auth-site-mark auth-site-mark-approved"><img src={crednivoApprovedMark} alt="" /></span><strong>CREDNIVO</strong></div>
          <span className="auth-secure-badge"><ShieldCheck size={16} /> Secure &amp; Encrypted</span>
        </header>
        <section className="auth-registration-shell auth-agent-success-shell">
          <div className="auth-form-card auth-success-card auth-success-card-v2">
            <span className="auth-success-icon"><CheckCircle2 size={34} /></span>
            <small>REGISTRATION SUBMITTED</small>
            <h2>Waiting for Owner approval</h2>
            <p>{submitted.name}, your registration was submitted successfully. Your Employee ID will be created after the Owner approves your request.</p>
            <div className="auth-success-details"><div><span>Request</span><strong>{submitted.requestId}</strong></div><div><span>Mobile</span><strong>{submitted.mobile}</strong></div><div><span>Status</span><strong>{submitted.status}</strong></div></div>
            <div className="auth-info-note"><Clock3 size={17} /><span>After approval, sign in with your <strong>mobile number</strong> or generated <strong>Employee ID</strong> using the password you created.</span></div>
            <Link className="auth-primary-link" to="/login">Go to Sign In</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page auth-registration-page auth-registration-v2">
      <header className="auth-site-header">
        <div className="auth-site-brand">
          <span className="auth-site-mark auth-site-mark-approved"><img src={crednivoApprovedMark} alt="" /></span>
          <strong>CREDNIVO</strong>
        </div>
        <span className="auth-secure-badge"><ShieldCheck size={16} /> Secure &amp; Encrypted</span>
      </header>

      <section className="auth-registration-shell auth-agent-registration-shell">
        <div className="auth-registration-titlebar">
          <Link className="auth-back-link" to="/login"><ArrowLeft size={17} /> Back to Sign In</Link>
          <h1>Register as Agent</h1>
          <p>Join your registered company workspace.</p>
        </div>

        <div className="auth-registration-main-card auth-agent-register-card-v2">
          <div className="auth-section-heading">
            <span><UsersRound size={21} /></span>
            <h2>Agent Details</h2>
          </div>

          <form className="auth-form auth-registration-form" onSubmit={submit}>
            <div className="auth-upload-row auth-upload-row-compact auth-agent-photo-row">
              <div className="auth-upload-preview auth-round-preview">{form.photoPreview ? <img src={form.photoPreview} alt="Agent preview" /> : <UserRound size={27} />}</div>
              <div className="auth-upload-copy"><strong>Agent Profile Photo *</strong><small>Upload a clear profile photo</small></div>
              <label className="auth-upload-button"><Camera size={17} /><span>Upload</span><input type="file" accept="image/*" onChange={choosePhoto} /></label>
            </div>

            <div className="auth-registration-grid">
              <label>
                <span>Agent Name *</span>
                <div className="auth-input-shell"><UserRound size={17} /><input value={form.name} onChange={change('name')} placeholder="Enter full name" /></div>
              </label>
              <label>
                <span>Mobile Number *</span>
                <div className="auth-input-shell"><Phone size={17} /><input inputMode="numeric" maxLength={10} value={form.mobile} onChange={change('mobile')} placeholder="Enter 10-digit mobile number" /></div>
              </label>
              <label>
                <span>Company Name *</span>
                <div className="auth-input-shell"><UsersRound size={17} /><input list="crednivo-company-options" value={form.companyName} onChange={changeCompany} placeholder="Search registered company" /><datalist id="crednivo-company-options">{[...new Set(workspaces.map((item) => item.name))].map((name) => <option key={name} value={name} />)}</datalist></div>
              </label>
              <label>
                <span>Branch Name *</span>
                <div className="auth-input-shell"><MapPin size={17} /><input list="crednivo-branch-options" value={form.branch} onChange={change('branch')} placeholder="Registered branch" /><datalist id="crednivo-branch-options">{branchOptions.map((item) => <option key={`${item.companyId}-${item.branch}`} value={item.branch}>{item.name}</option>)}</datalist></div>
              </label>
              <label>
                <span>Create Password *</span>
                <div className="auth-input-shell auth-password-input"><KeyRound size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={change('password')} placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              </label>
              <label>
                <span>Confirm Password *</span>
                <div className="auth-input-shell"><KeyRound size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={change('confirm')} placeholder="Re-enter password" /></div>
              </label>
            </div>

            {error && <div className="auth-error">{error}</div>}
            <button className="auth-primary-button auth-registration-submit" type="submit" disabled={busy}><ShieldCheck size={18} />{busy ? 'Submitting...' : 'Submit Agent Registration'}</button>
          </form>

          <div className="auth-help-note auth-agent-note"><Clock3 size={16} /><span>Employee ID is generated after Owner approval. Until then your status remains <strong>Pending Approval</strong>.</span></div>
        </div>

        <div className="auth-switch-note auth-registration-switch-note"><UserRound size={16} /><span>Already registered? <Link to="/login">Sign in to CREDNIVO</Link></span></div>
      </section>
    </main>
  );
}
