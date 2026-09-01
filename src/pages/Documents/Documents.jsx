import { Download, Eye, FileCheck2, FileText, FolderOpen, Search, Trash2, Upload, X } from 'lucide-react';
import { useMemo, useState, useRef } from 'react';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/finance';
import './Documents.css';

const types = ['Customer KYC', 'Jamin KYC', 'Loan Agreement', 'Company', 'General'];

function fileSize(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Documents() {
  const actionLocksRef = useRef(new Set());

  const { documents, customers, saveDocument, deleteDocument } = useCrednivo();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState({ customerId: '—', type: 'Company', file: null });
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => documents.filter((d) => `${d.name} ${d.customerId} ${d.type} ${d.fileName}`.toLowerCase().includes(search.toLowerCase().trim())), [documents, search]);

  const submit = async (event) => {
    if (actionLocksRef.current.has('submit')) return;
    actionLocksRef.current.add('submit');
    try {
    event.preventDefault();
    setError('');
    if (!form.file) {
      setError('Choose a photo, PDF or document file.');
      return;
    }
    try {
      setBusy(true);
      await saveDocument(form);
      setUploadOpen(false);
      setForm({ customerId: '—', type: 'Company', file: null });
    } catch (err) {
      setError(err?.message || 'Could not upload document.');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('submit');
    }
  };

  const remove = async () => {
    if (actionLocksRef.current.has('remove')) return;
    actionLocksRef.current.add('remove');
    try {
    if (!deleting) return;
    try {
      setBusy(true);
      await deleteDocument(deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('remove');
    }
  };

  const openDocument = (doc) => {
    if (doc.data) window.open(doc.data, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="module-page documents-page">
      <ModuleHeader eyebrow="Document Vault" title="Documents" description="Keep customer KYC, Jamin proofs, agreements and company documents organized in PostgreSQL-backed storage." actions={hasPermission('documents.upload') ? <ActionButton icon={Upload} onClick={() => { setUploadOpen(true); setError(''); }}>Upload Document</ActionButton> : null} />

      <section className="metric-strip">
        <article className="mini-metric module-card"><span className="mini-metric-icon"><FolderOpen size={20} /></span><div><span>Total Documents</span><strong>{documents.length}</strong></div></article>
        <article className="mini-metric module-card"><span className="mini-metric-icon"><FileCheck2 size={20} /></span><div><span>Customer KYC</span><strong>{documents.filter((d) => d.type === 'Customer KYC' || d.type === 'Jamin KYC').length}</strong></div></article>
        <article className="mini-metric module-card"><span className="mini-metric-icon"><FileText size={20} /></span><div><span>Loan Agreements</span><strong>{documents.filter((d) => d.type === 'Loan Agreement').length}</strong></div></article>
        <article className="mini-metric module-card"><span className="mini-metric-icon"><FileText size={20} /></span><div><span>Company Docs</span><strong>{documents.filter((d) => d.type === 'Company').length}</strong></div></article>
      </section>

      <section className="module-card">
        <div className="module-toolbar"><label className="module-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, customer ID or type..." /></label></div>
        {filtered.length ? <div className="document-grid">{filtered.map((doc) => (
          <article className="document-card" key={doc.id}>
            <span className="document-icon"><FileText size={24} /></span>
            <div className="document-main"><strong>{doc.name}</strong><small>{doc.id} · {doc.customerId || '—'}</small></div>
            <span className="soft-chip blue">{doc.type}</span>
            <div className="document-meta"><span>Updated <strong>{formatDate(doc.updated)}</strong></span><span>Size <strong>{fileSize(doc.fileSize)}</strong></span></div>
            <div className="document-actions">
              <ActionButton tone="secondary" icon={Eye} onClick={() => openDocument(doc)} disabled={!doc.data}>View</ActionButton>
              {doc.data && <a className="document-download" href={doc.data} download={doc.fileName || doc.name}><Download size={15} /><span>Download</span></a>}
              {hasPermission('documents.delete') && <ActionButton tone="danger" icon={Trash2} onClick={() => setDeleting(doc)}>Delete</ActionButton>}
            </div>
          </article>
        ))}</div> : <div className="documents-empty"><FolderOpen size={28} /><strong>No documents found</strong><span>Upload a document or change your search.</span></div>}
      </section>

      {uploadOpen && <div className="document-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setUploadOpen(false)}>
        <section className="document-modal app-card" role="dialog" aria-modal="true" aria-label="Upload document">
          <div className="document-modal-head"><div><small>DOCUMENT VAULT</small><h2>Upload Document</h2><p>Link the file to a customer, or keep it as a company document.</p></div><IconButton label="Close" onClick={() => setUploadOpen(false)}><X size={19} /></IconButton></div>
          <form className="document-form" onSubmit={submit}>
            <div className="document-form-grid">
              <label><span>Linked Customer</span><select value={form.customerId} onChange={(e) => setForm((c) => ({ ...c, customerId: e.target.value }))}><option value="—">Company / No Customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.id} — {customer.name}</option>)}</select></label>
              <label><span>Document Type</span><select value={form.type} onChange={(e) => setForm((c) => ({ ...c, type: e.target.value }))}>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="document-file-field"><span>Choose File *</span><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(e) => setForm((c) => ({ ...c, file: e.target.files?.[0] || null }))} /><small>{form.file ? `${form.file.name} · ${fileSize(form.file.size)}` : 'Photo, PDF or document file'}</small></label>
            </div>
            {error && <div className="document-form-error">{error}</div>}
            <div className="document-modal-actions"><ActionButton type="button" tone="secondary" onClick={() => setUploadOpen(false)}>Cancel</ActionButton><ActionButton type="submit" icon={Upload} disabled={busy}>{busy ? 'Uploading...' : 'Upload Document'}</ActionButton></div>
          </form>
        </section>
      </div>}

      {deleting && <div className="document-modal-backdrop"><section className="document-delete-dialog app-card" role="dialog" aria-modal="true"><span className="document-delete-icon"><Trash2 size={22} /></span><h2>Delete Document?</h2><p>{deleting.name}</p><small>The stored file and database record will both be removed.</small><div><ActionButton tone="secondary" onClick={() => setDeleting(null)}>Cancel</ActionButton><ActionButton tone="danger" icon={Trash2} onClick={remove} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</ActionButton></div></section></div>}
    </div>
  );
}
