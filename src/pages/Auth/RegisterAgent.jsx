import {
  ArrowLeft, BarChart3, Camera, CheckCircle2, Clock3, Eye, EyeOff,
  ShieldCheck, UserRound, UsersRound
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { AuthLoading } from './Login';
import './Auth.css';

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
      <main className="auth-page auth-registration-page">
        <section className="auth-brand-panel">
          <div className="auth-brand-lockup"><span className="auth-brand-mark"><BarChart3 size={34} /></span><div><strong>CREDNIVO</strong><small>Finance Management Platform</small></div></div>
          <div className="auth-brand-copy"><span className="auth-kicker"><Clock3 size={16} /> Approval Pending</span><h1>Your registration is safely submitted.</h1><p>No OTP or email acceptance is required. The company Owner only needs to approve the request inside CREDNIVO.</p></div>
          <div className="auth-company-chip"><ShieldCheck size={18} /><div><small>Company</small><strong>{form.companyName || status?.companyName || 'CREDNIVO'}</strong><span>{submitted.branch}</span></div></div>
        </section>
        <section className="auth-form-panel"><div className="auth-form-card auth-success-card">
          <span className="auth-success-icon"><CheckCircle2 size={34} /></span>
          <small>REGISTRATION SUBMITTED</small><h2>Waiting for Owner approval</h2>
          <p>{submitted.name}, your password is already secured. Your Employee ID will be created only after approval.</p>
          <div className="auth-success-details"><div><span>Request</span><strong>{submitted.requestId}</strong></div><div><span>Mobile</span><strong>{submitted.mobile}</strong></div><div><span>Status</span><strong>{submitted.status}</strong></div></div>
          <div className="auth-info-note"><Clock3 size={17} /><span>After approval, sign in with your <strong>mobile number</strong> or newly generated <strong>EMP ID</strong> using the password you created.</span></div>
          <Link className="auth-primary-link" to="/login">Go to Sign In</Link>
        </div></section>
      </main>
    );
  }

  return (
    <main className="auth-page auth-registration-page">
      <section className="auth-brand-panel">
        <div className="auth-brand-lockup"><span className="auth-brand-mark"><BarChart3 size={34} /></span><div><strong>CREDNIVO</strong><small>Finance Management Platform</small></div></div>
        <div className="auth-brand-copy"><span className="auth-kicker"><UsersRound size={16} /> Agent Registration</span><h1>Join your company collection workspace.</h1><p>Enter the exact registered company and branch. No OTP and no email acceptance. Access starts only after that company Owner approves you.</p></div>
        <div className="auth-company-chip"><ShieldCheck size={18} /><div><small>Workspace request</small><strong>{form.companyName || 'Choose company'}</strong><span>{form.branch || 'Enter registered branch'}</span></div></div>
      </section>

      <section className="auth-form-panel auth-registration-panel">
        <div className="auth-form-card auth-registration-card auth-agent-register-card">
          <div className="auth-back-row"><Link to="/login"><ArrowLeft size={16} /> Back to Sign In</Link></div>
          <div className="auth-form-heading"><span className="auth-heading-icon"><UserRound size={22} /></span><div><small>CREATE AGENT ACCOUNT</small><h2>Register as Agent</h2><p>Your request will appear in the Owner's Agents page.</p></div></div>

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-upload-row auth-agent-photo-row">
              <div className="auth-upload-preview auth-round-preview">{form.photoPreview ? <img src={form.photoPreview} alt="Agent preview" /> : <UserRound size={30} />}</div>
              <label className="auth-upload-button"><Camera size={17} /><span>Profile Photo *</span><input type="file" accept="image/*" onChange={choosePhoto} /></label>
            </div>

            <div className="auth-registration-grid">
              <label><span>Agent Name *</span><input value={form.name} onChange={change('name')} placeholder="Full name" /></label>
              <label><span>Mobile Number *</span><input inputMode="numeric" maxLength={10} value={form.mobile} onChange={change('mobile')} placeholder="10-digit mobile" /></label>
              <label><span>Company Name *</span><input list="crednivo-company-options" value={form.companyName} onChange={changeCompany} placeholder="Search registered company" /><datalist id="crednivo-company-options">{[...new Set(workspaces.map((item) => item.name))].map((name) => <option key={name} value={name} />)}</datalist></label>
              <label><span>Branch Name *</span><input list="crednivo-branch-options" value={form.branch} onChange={change('branch')} placeholder="Registered branch" /><datalist id="crednivo-branch-options">{branchOptions.map((item) => <option key={`${item.companyId}-${item.branch}`} value={item.branch}>{item.name}</option>)}</datalist></label>
              <label><span>Create Password *</span><div className="auth-password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={change('password')} placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              <label><span>Confirm Password *</span><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={change('confirm')} placeholder="Re-enter password" /></label>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-primary-button" type="submit" disabled={busy}><ShieldCheck size={18} />{busy ? 'Submitting...' : 'Submit Agent Registration'}</button>
          </form>
          <div className="auth-help-note"><Clock3 size={16} /><span>Employee ID is generated after Owner approval. Until then your status remains <strong>Pending Approval</strong>.</span></div>
        </div>
      </section>
    </main>
  );
}
