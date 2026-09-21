import {
  Camera, CheckCircle2, ClipboardList, Clock3, Edit3, Search, ShieldCheck, SlidersHorizontal, Trash2,
  UserCheck, UserPlus, UserX, UsersRound, WalletCards, X
} from 'lucide-react';
import { useMemo, useState, useRef } from 'react';
import ActionButton from '../../components/common/ActionButton';
import StatCard from '../../components/dashboard/StatCard';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import CreateWorkModal from '../../components/work/CreateWorkModal';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, formatIndianMobile } from '../../utils/finance';
import './Agents.css';

const emptyForm = { name: '', mobile: '', branch: '', status: 'Pending Approval', loginPassword: '', photoFile: null, photoPreview: '' };


const permissionGroups = [
  { title: 'Customers', items: [
    ['customers.view', 'View'], ['customers.add', 'Add'], ['customers.edit', 'Edit'], ['customers.delete', 'Delete'],
  ]},
  { title: 'Loans', items: [
    ['loans.view', 'View'], ['loans.create', 'Create'],
  ]},
  { title: 'Collections & Payments', items: [
    ['collections.view', 'View Collections'], ['collections.collect', 'Collect'], ['collections.fine', 'Add Fine'],
    ['payments.view', 'Payment History'], ['payments.record', 'Record Payment'],
  ]},
  { title: 'Expenses', items: [
    ['expenses.view', 'View'], ['expenses.add', 'Add'], ['expenses.edit', 'Edit'], ['expenses.delete', 'Delete'],
  ]},
  { title: 'Documents', items: [
    ['documents.view', 'View'], ['documents.upload', 'Upload'], ['documents.delete', 'Delete'],
  ]},
  { title: 'Reports', items: [
    ['todayReport.view', "Today's Report"], ['reports.full', 'Full Reports'],
  ]},
  { title: 'Capital', items: [
    ['capital.view', 'View Capital'], ['capital.manage', 'Add / Edit / Delete'],
  ]},
  { title: 'Workspace', items: [
    ['overview.view', 'Overview'],
  ]},
];

export default function Agents() {
  const actionLocksRef = useRef(new Set());

  const { agents, company, saveAgent, setAgentStatus, deleteAgent, saveAgentPermissions } = useCrednivo();
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permissionAgent, setPermissionAgent] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState({});
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [workModalOpen, setWorkModalOpen] = useState(false);

  const filtered = useMemo(() => agents.filter((a) => `${a.id} ${a.name} ${a.mobile} ${a.branch} ${a.status}`.toLowerCase().includes(search.toLowerCase().trim())), [agents, search]);

  const openCreate = () => {
    setEditor('new');
    setForm({ ...emptyForm, branch: company.branch || '' });
    setError('');
  };

  const openEdit = (agent) => {
    setEditor(agent.id);
    setForm({ ...emptyForm, name: agent.name, mobile: agent.mobile, branch: agent.branch, status: agent.status, photoPreview: agent.photo || '' });
    setError('');
  };

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((current) => ({ ...current, photoFile: file, photoPreview: URL.createObjectURL(file) }));
  };

  const submit = async (event) => {
    if (actionLocksRef.current.has('submit')) return;
    actionLocksRef.current.add('submit');
    try {
    event.preventDefault();
    setError('');
    const digits = String(form.mobile || '').replace(/\D/g, '');
    if (!form.name.trim() || digits.length !== 10 || !form.branch.trim()) {
      setError('Enter agent name, a valid 10-digit mobile number and branch.');
      return;
    }
    if (form.loginPassword && form.loginPassword.length < 8) {
      setError('Agent login password must contain at least 8 characters.');
      return;
    }
    try {
      setBusy(true);
      await saveAgent({ ...form, mobile: digits }, editor === 'new' ? null : editor);
      setEditor(null);
      setForm(emptyForm);
    } catch (err) {
      setError(err?.message || 'Could not save agent.');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('submit');
    }
  };

  const approve = async (agent) => {
    if (actionLocksRef.current.has('approve')) return;
    actionLocksRef.current.add('approve');
    try {
    try {
      setBusy(true);
      await setAgentStatus(agent.id, 'Active');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('approve');
    }
  };

  const reject = async (agent) => {
    if (actionLocksRef.current.has('reject')) return;
    actionLocksRef.current.add('reject');
    try {
    try {
      setBusy(true);
      await setAgentStatus(agent.id, 'Rejected');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('reject');
    }
  };

  const remove = async () => {
    if (actionLocksRef.current.has('remove')) return;
    actionLocksRef.current.add('remove');
    try {
    if (!deleting) return;
    try {
      setBusy(true);
      await deleteAgent(deleting.id);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('remove');
    }
  };


  const openPermissions = (agent) => {
    setPermissionAgent(agent);
    setPermissionDraft({ ...(agent.permissions || {}) });
    setPermissionError('');
  };

  const togglePermission = (key) => {
    setPermissionDraft((current) => ({ ...current, [key]: !current[key] }));
  };

  const savePermissions = async () => {
    if (actionLocksRef.current.has('savePermissions')) return;
    actionLocksRef.current.add('savePermissions');
    try {
    if (!permissionAgent) return;
    try {
      setPermissionBusy(true);
      setPermissionError('');
      await saveAgentPermissions(permissionAgent.id, permissionDraft);
      setPermissionAgent(null);
    } catch (err) {
      setPermissionError(err?.message || 'Could not update agent permissions.');
    } finally {
      setPermissionBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('savePermissions');
    }
  };

  return (
    <div className="module-page agents-page">
      <ModuleHeader eyebrow="Team Management" title="Agents" description="Manage field agents, approval status, profile details and collection access." actions={<>
        <ActionButton tone="secondary" icon={ClipboardList} onClick={() => setWorkModalOpen(true)}>Create Work</ActionButton>
        <ActionButton icon={UserPlus} onClick={openCreate}>Invite Agent</ActionButton>
      </>} />

      <section className="stats-section">
        <div className="stats-grid">
          <StatCard title="Total Agents" value={String(agents.length)} note="" icon={UsersRound} tone="blue" showProgress={false} />
          <StatCard title="Active" value={String(agents.filter((a) => a.status === 'Active').length)} note="" icon={CheckCircle2} tone="green" showProgress={false} />
          <StatCard title="Pending Approval" value={String(agents.filter((a) => a.status === 'Pending Approval').length)} note="" icon={Clock3} tone="orange" showProgress={false} />
          <StatCard title="Collected" value={formatCurrency(agents.reduce((sum, agent) => sum + Number(agent.collected || 0), 0))} note="" icon={WalletCards} tone="purple" showProgress={false} />
        </div>
      </section>

      <section className="module-card">
        <div className="module-toolbar"><label className="module-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search agent, branch or employee ID..." /></label></div>
        {filtered.length ? <div className="agent-grid">{filtered.map((agent) => (
          <article className="agent-card" key={agent.id}>
            <div className="agent-card-top">
              <span className="agent-avatar">{agent.photo ? <img src={agent.photo} alt={`${agent.name} profile`} /> : agent.name.charAt(0)}</span>
              <div><strong>{agent.name}</strong><small>{String(agent.id || '').startsWith('PENDING-') ? 'Employee ID after approval' : agent.id} · {formatIndianMobile(agent.mobile)}</small></div>
              <div className="agent-status-stack"><span className={`soft-chip ${agent.status === 'Active' ? 'green' : agent.status === 'Pending Approval' ? 'orange' : 'blue'}`}>{agent.status}</span><span className={`agent-login-chip ${agent.loginEnabled ? 'enabled' : ''}`}>{agent.status === 'Pending Approval' && agent.loginEnabled ? 'Password Saved' : agent.loginEnabled ? 'Login Ready' : 'No Login'}</span></div>
            </div>
            <div className="agent-stats"><div><span>Branch</span><strong>{agent.branch}</strong></div><div><span>Assigned</span><strong>{agent.assigned || 0}</strong></div><div><span>Collected</span><strong>{formatCurrency(agent.collected || 0)}</strong></div></div>
            <div className="agent-card-foot"><ShieldCheck size={15} /><span>{agent.status === 'Active' ? 'Approved for collection access' : agent.status === 'Pending Approval' ? 'Waiting for owner approval' : 'Collection access inactive'}</span></div>
            <div className="agent-card-actions">
              {agent.status === 'Pending Approval' && <><ActionButton tone="success" icon={UserCheck} onClick={() => approve(agent)} disabled={busy}>Approve</ActionButton><ActionButton tone="danger" icon={UserX} onClick={() => reject(agent)} disabled={busy}>Reject</ActionButton></>}
              <ActionButton tone="secondary" icon={SlidersHorizontal} onClick={() => openPermissions(agent)}>Permissions</ActionButton>
              <ActionButton tone="secondary" icon={Edit3} onClick={() => openEdit(agent)}>Edit</ActionButton>
              <ActionButton tone="danger" icon={Trash2} onClick={() => setDeleting(agent)}>Delete</ActionButton>
            </div>
          </article>
        ))}</div> : <div className="agents-empty"><UsersRound size={26} /><strong>No agents found</strong><span>Invite an agent or change your search.</span></div>}
      </section>

      {editor && <div className="agent-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditor(null)}>
        <section className="agent-modal app-card" role="dialog" aria-modal="true" aria-label={editor === 'new' ? 'Invite agent' : 'Edit agent'}>
          <div className="agent-modal-head"><div><small>AGENT PROFILE</small><h2>{editor === 'new' ? 'Invite Agent' : 'Edit Agent'}</h2><p>{editor === 'new' ? 'The agent will remain pending until approved.' : 'Update agent profile and access status.'}</p></div><IconButton label="Close" onClick={() => setEditor(null)}><X size={19} /></IconButton></div>
          <form className="agent-form" onSubmit={submit}>
            <div className="agent-photo-row"><div className="agent-photo-preview">{form.photoPreview ? <img src={form.photoPreview} alt="Agent preview" /> : <span>{form.name?.charAt(0) || 'A'}</span>}</div><label className="agent-photo-button"><Camera size={16} /><span>Add Profile Photo</span><input type="file" accept="image/*" onChange={choosePhoto} /></label></div>
            <div className="agent-form-grid">
              <label><span>Name *</span><input value={form.name} onChange={change('name')} /></label>
              <label><span>Mobile *</span><input inputMode="numeric" maxLength={10} value={form.mobile} onChange={change('mobile')} /></label>
              <label><span>Branch *</span><input value={form.branch} onChange={change('branch')} /></label>
              <label><span>Status</span><select value={form.status} onChange={change('status')}><option>Pending Approval</option><option>Active</option><option>Inactive</option></select></label>
              <label className="agent-login-field"><span>{editor === 'new' ? 'Create Login Password' : 'Set / Reset Login Password'}</span><input type="password" autoComplete="new-password" value={form.loginPassword} onChange={change('loginPassword')} placeholder={editor === 'new' ? 'Minimum 8 characters' : 'Leave blank to keep current password'} /><small>{editor === 'new' ? 'Employee ID is generated when approved.' : `Login ID: ${editor} or mobile number.`}</small></label>
            </div>
            {error && <div className="agent-form-error">{error}</div>}
            <div className="agent-modal-actions"><ActionButton type="button" tone="secondary" onClick={() => setEditor(null)}>Cancel</ActionButton><ActionButton type="submit" icon={CheckCircle2} disabled={busy}>{busy ? 'Saving...' : editor === 'new' ? 'Save Invitation' : 'Save Changes'}</ActionButton></div>
          </form>
        </section>
      </div>}

      {permissionAgent && <div className="agent-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPermissionAgent(null)}>
        <section className="agent-permission-modal app-card" role="dialog" aria-modal="true" aria-label={`Permissions for ${permissionAgent.name}`}>
          <div className="agent-modal-head">
            <div><small>ACCESS CONTROL</small><h2>{permissionAgent.name}</h2><p>{permissionAgent.id} · Choose exactly what this agent can access and change.</p></div>
            <IconButton label="Close" onClick={() => setPermissionAgent(null)}><X size={19} /></IconButton>
          </div>
          <div className="agent-permission-body">
            <div className="agent-permission-note"><ShieldCheck size={17}/><span>Personal Settings (Theme, Language and own password) are always available. Agent Management and Business/Admin Settings remain Owner-only.</span></div>
            <div className="agent-permission-groups">
              {permissionGroups.map((group) => <section className="agent-permission-group" key={group.title}>
                <h3>{group.title}</h3>
                <div>{group.items.map(([key, label]) => <label className="agent-permission-toggle" key={key}>
                  <input type="checkbox" checked={Boolean(permissionDraft[key])} onChange={() => togglePermission(key)} />
                  <span className="agent-permission-switch" aria-hidden="true" />
                  <span>{label}</span>
                </label>)}</div>
              </section>)}
            </div>
            {permissionError && <div className="agent-form-error">{permissionError}</div>}
            <div className="agent-modal-actions"><ActionButton tone="secondary" onClick={() => setPermissionAgent(null)}>Cancel</ActionButton><ActionButton icon={CheckCircle2} onClick={savePermissions} disabled={permissionBusy}>{permissionBusy ? 'Saving...' : 'Save Permissions'}</ActionButton></div>
          </div>
        </section>
      </div>}

      {deleting && <div className="agent-modal-backdrop"><section className="agent-delete-dialog app-card" role="dialog" aria-modal="true"><span className="agent-delete-icon"><Trash2 size={22} /></span><h2>Delete Agent?</h2><p>{deleting.name} · {deleting.id}</p><small>This removes the agent record from CREDNIVO.</small><div><ActionButton tone="secondary" onClick={() => setDeleting(null)}>Cancel</ActionButton><ActionButton tone="danger" icon={Trash2} onClick={remove} disabled={busy}>{busy ? 'Deleting...' : 'Delete Agent'}</ActionButton></div></section></div>}

      {workModalOpen && <CreateWorkModal agents={agents} onClose={() => setWorkModalOpen(false)} onCreated={() => {}} />}
    </div>
  );
}
