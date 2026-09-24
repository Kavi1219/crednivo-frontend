import { Building2, Camera, Save, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import ActionButton from '../common/ActionButton';
import IconButton from '../common/IconButton';
import { useCrednivo } from '../../context/CrednivoContext';
import './CompanyProfileModal.css';
import ProtectedImage from '../common/ProtectedImage';

export default function CompanyProfileModal({ open, onClose }) {
  const actionLocksRef = useRef(new Set());

  const { company, updateCompany } = useCrednivo();
  const [form, setForm] = useState(company);
  const [logoFile, setLogoFile] = useState(null);
  const [preview, setPreview] = useState(company.logo || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm(company);
    setLogoFile(null);
    setPreview(company.logo || '');
    setError('');
  }, [open, company]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async (event) => {
    if (actionLocksRef.current.has('submit')) return;
    actionLocksRef.current.add('submit');
    try {
    event.preventDefault();
    setError('');
    if (!form.name?.trim() || !form.owner?.trim() || !form.branch?.trim()) {
      setError('Company name, Owner / MD and Branch are required.');
      return;
    }
    try {
      setSaving(true);
      await updateCompany({ ...form, logoFile });
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not update company profile.');
    } finally {
      setSaving(false);
    }
  
    } finally {
      actionLocksRef.current.delete('submit');
    }
  };

  return createPortal(
    <div className="company-profile-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="company-profile-modal app-card" role="dialog" aria-modal="true" aria-label="Edit company profile">
        <div className="company-profile-modal-head">
          <div className="company-profile-modal-title">
            <span><Building2 size={20} /></span>
            <div><small>COMPANY PROFILE</small><h2>Edit Profile</h2><p>Saved to PostgreSQL and used across CREDNIVO.</p></div>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={19} /></IconButton>
        </div>

        <form className="company-profile-form" onSubmit={submit}>
          <div className="company-logo-editor">
            <div className="company-logo-preview">
              {preview ? <ProtectedImage src={preview} alt="Company logo" fallback={<span>{form.name?.charAt(0) || 'C'}</span>} /> : <span>{form.name?.charAt(0) || 'C'}</span>}
            </div>
            <label className="company-logo-button">
              <Camera size={16} /> <span>Change Logo / Photo</span>
              <input type="file" accept="image/*" onChange={chooseLogo} />
            </label>
          </div>

          <div className="company-profile-grid">
            <label><span>Company Name *</span><input value={form.name || ''} onChange={change('name')} /></label>
            <label><span>Owner / MD Name *</span><input value={form.owner || ''} onChange={change('owner')} /></label>
            <label><span>Branch *</span><input value={form.branch || ''} onChange={change('branch')} /></label>
            <label><span>Mobile</span><input inputMode="numeric" maxLength={10} value={form.mobile || ''} onChange={change('mobile')} /></label>
            <label><span>Email</span><input type="email" value={form.email || ''} onChange={change('email')} /></label>
            <label className="company-profile-full"><span>Address</span><textarea value={form.address || ''} onChange={change('address')} /></label>
          </div>

          {error && <div className="company-profile-error">{error}</div>}
          <div className="company-profile-modal-actions">
            <ActionButton type="button" tone="secondary" onClick={onClose}>Cancel</ActionButton>
            <ActionButton type="submit" icon={Save} disabled={saving}>{saving ? 'Saving...' : 'Save Profile'}</ActionButton>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
