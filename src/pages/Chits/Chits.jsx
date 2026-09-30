import { Check, ChevronRight, Coins, Layers, Pencil, Plus, Search, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import ProtectedImage from '../../components/common/ProtectedImage';
import SummaryCard from '../../components/common/SummaryCard';
import { PageBackButton } from '../../components/GlobalBackButton';
import {
  addChitMember, createChit, deleteChit, deleteChitMember, getChit, listChitMembers, listChits,
  updateChit, updateChitMember,
} from '../../services/chits';
import { formatCurrency, formatDate, formatIndianMobile, toInputDate } from '../../utils/finance';
// Chits reuses the Expenses page's section title, toolbar, form and delete
// dialog styles, so load them here too (they aren't loaded unless Expenses was opened).
import '../Expenses/Expenses.css';
import './Chits.css';

/** How often a chit installment comes round. */
export const CHIT_INTERVALS = [
  { months: 1, label: 'Monthly' },
  { months: 2, label: 'Every 2 months' },
  { months: 3, label: 'Every 3 months' },
  { months: 4, label: 'Every 4 months' },
  { months: 6, label: 'Every 6 months' },
  { months: 12, label: 'Yearly' },
];
const intervalLabel = (months) => CHIT_INTERVALS.find((item) => item.months === Number(months))?.label || `Every ${months} months`;

const emptyChit = () => ({ name: '', chitValue: '', memberCount: '', startDate: toInputDate(), intervalMonths: '1' });
const emptyMember = () => ({ name: '', phone: '', address: '', photo: null, photoPreview: '' });

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="collection-modal-backdrop" onMouseDown={onClose}>
      <div className="collection-modal module-card chit-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="collection-modal-head">
          <div><strong>{title}</strong><span>{subtitle}</span></div>
          <IconButton label="Close" onClick={onClose}><X size={18} /></IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDelete({ title, detail, note, busy, onCancel, onConfirm }) {
  return (
    <div className="collection-modal-backdrop">
      <div className="delete-expense-dialog module-card">
        <span className="delete-expense-icon"><Trash2 size={22} /></span>
        <h2>{title}</h2>
        <p>{detail}</p>
        <small>{note}</small>
        <div>
          <ActionButton tone="secondary" onClick={onCancel}>Cancel</ActionButton>
          <ActionButton tone="danger" icon={Trash2} onClick={onConfirm} disabled={busy}>{busy ? 'Deleting...' : 'Delete'}</ActionButton>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Chit form (create / edit)
   ================================================================ */
function ChitForm({ initial, busy, error, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const value = Number(form.chitValue) || 0;
  const count = Number(form.memberCount) || 0;
  const installment = count > 0 ? value / count : 0;
  return (
    <Modal title={initial.id ? 'Edit Chit' : 'Create Chit'} subtitle={initial.id ? 'Update this chit group' : 'Start a new chit group'} onClose={onClose}>
      <div className="form-grid expense-form">
        <div className="form-field span-2">
          <label>Chit Name</label>
          <input value={form.name} onChange={set('name')} placeholder="e.g. Diwali 1 Lakh Chit" />
        </div>
        <div className="form-field">
          <label>Chit Value</label>
          <input type="number" min="1" value={form.chitValue} onChange={set('chitValue')} placeholder="₹" />
        </div>
        <div className="form-field">
          <label>Members</label>
          <input type="number" min="2" max="500" value={form.memberCount} onChange={set('memberCount')} placeholder="How many members" />
        </div>
        <div className="form-field">
          <label>Chit Date</label>
          <input type="date" value={form.startDate} onChange={set('startDate')} />
        </div>
        <div className="form-field">
          <label>Duration</label>
          <select value={form.intervalMonths} onChange={set('intervalMonths')}>
            {CHIT_INTERVALS.map((item) => <option key={item.months} value={item.months}>{item.label}</option>)}
          </select>
        </div>
      </div>
      {installment > 0 && (
        <div className="chit-form-hint">
          Each member pays <strong>{formatCurrency(Math.round(installment * 100) / 100)}</strong> {intervalLabel(form.intervalMonths).toLowerCase()} · {count} installments
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
      <ActionButton icon={Check} onClick={() => onSave(form)} disabled={busy}>{busy ? 'Saving...' : initial.id ? 'Save Changes' : 'Create Chit'}</ActionButton>
    </Modal>
  );
}

/* ================================================================
   Member form (add / edit)
   ================================================================ */
function MemberForm({ initial, busy, error, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const set = (key) => (event) => setForm((value) => ({ ...value, [key]: event.target.value }));
  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((value) => ({ ...value, photo: file, photoPreview: URL.createObjectURL(file) }));
  };
  return (
    <Modal title={initial.id ? 'Edit Member' : 'Add Member'} subtitle={initial.id ? 'Update member details' : 'Add a member to this chit'} onClose={onClose}>
      <div className="chit-member-photo-pick">
        <label className="chit-avatar chit-avatar-lg chit-photo-button" title="Choose photo">
          {form.photoPreview
            ? <img src={form.photoPreview} alt="" />
            : form.existingPhoto
              ? <ProtectedImage src={form.existingPhoto} alt="" fallback={<span>{(form.name || '?').charAt(0).toUpperCase()}</span>} />
              : <span>{(form.name || '+').charAt(0).toUpperCase()}</span>}
          <input type="file" accept="image/*" onChange={choosePhoto} hidden />
        </label>
        <small>Tap to {form.photoPreview || form.existingPhoto ? 'change' : 'add'} photo</small>
      </div>
      <div className="form-grid expense-form">
        <div className="form-field span-2">
          <label>Name</label>
          <input value={form.name} onChange={set('name')} placeholder="Member name" />
        </div>
        <div className="form-field span-2">
          <label>Phone</label>
          <input type="tel" inputMode="numeric" value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" />
        </div>
        <div className="form-field span-2">
          <label>Address</label>
          <textarea rows={2} value={form.address} onChange={set('address')} placeholder="Door no, street, area, town" />
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <ActionButton icon={Check} onClick={() => onSave(form)} disabled={busy}>{busy ? 'Saving...' : initial.id ? 'Save Changes' : 'Add Member'}</ActionButton>
    </Modal>
  );
}

/* ================================================================
   Chit list
   ================================================================ */
function ChitList() {
  const navigate = useNavigate();
  const [chits, setChits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setChits(await listChits() || []); }
    catch (err) { setError(err?.message || 'Could not load chits.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    if (!form.name.trim()) { setFormError('Enter a chit name.'); return; }
    if (!(Number(form.chitValue) > 0)) { setFormError('Enter the chit value.'); return; }
    if (!(Number(form.memberCount) >= 2)) { setFormError('Members must be at least 2.'); return; }
    setBusy(true);
    setFormError('');
    try {
      const created = await createChit({
        name: form.name.trim(), chitValue: Number(form.chitValue), memberCount: Number(form.memberCount),
        startDate: form.startDate, intervalMonths: Number(form.intervalMonths),
      });
      setFormOpen(false);
      navigate(`/chits/${created.id}`);
    } catch (err) { setFormError(err?.message || 'Could not create the chit.'); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? chits.filter((chit) => `${chit.name} ${chit.id}`.toLowerCase().includes(query)) : chits;
  }, [chits, search]);

  const totalValue = chits.reduce((sum, chit) => sum + Number(chit.chitValue || 0), 0);
  const totalMembers = chits.reduce((sum, chit) => sum + Number(chit.membersAdded || 0), 0);

  return (
    <div className="module-page chits-page">
      <ModuleHeader actions={
        <div className="page-actions-row">
          <PageBackButton />
          <ActionButton icon={Plus} onClick={() => { setFormError(''); setFormOpen(true); }}>Create Chit</ActionButton>
        </div>
      } />

      <section className="stats-section">
        <div className="chit-summary-grid">
          <SummaryCard title="Chit Groups" value={String(chits.length)} note="All chits you run" icon={Layers} tone="blue" />
          <SummaryCard title="Total Chit Value" value={formatCurrency(totalValue)} note="Across all chits" icon={Coins} tone="purple" />
          <SummaryCard title="Members" value={String(totalMembers)} note="Added across all chits" icon={UsersRound} tone="green" />
        </div>
      </section>

      <section className="module-card">
        <div className="expense-section-title">
          <div><h2>Chits</h2><span>Tap a chit to see and add its members</span></div>
        </div>
        <div className="module-toolbar expense-filter-row">
          <label className="module-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chit name..." aria-label="Search chits" />
          </label>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="chit-list">
          {filtered.map((chit) => {
            const full = Number(chit.membersAdded) >= Number(chit.memberCount);
            return (
              <button type="button" key={chit.id} className="chit-row" onClick={() => navigate(`/chits/${chit.id}`)}>
                <span className="chit-row-icon"><Coins size={20} /></span>
                <span className="chit-row-main">
                  <strong>{chit.name}</strong>
                  <small>{intervalLabel(chit.intervalMonths)} · starts {formatDate(chit.startDate)} · ends {formatDate(chit.endDate)}</small>
                </span>
                <span className="chit-row-value">
                  <strong>{formatCurrency(chit.chitValue)}</strong>
                  <small className={full ? 'full' : ''}>{chit.membersAdded} / {chit.memberCount} members</small>
                </span>
                <ChevronRight size={18} className="chit-row-go" aria-hidden="true" />
              </button>
            );
          })}
          {!loading && filtered.length === 0 && (
            <div className="expense-filter-empty">{chits.length ? 'No chits match your search.' : 'No chits yet. Tap “Create Chit” to start your first chit group.'}</div>
          )}
          {loading && <div className="expense-filter-empty">Loading chits…</div>}
        </div>
      </section>

      {formOpen && <ChitForm initial={emptyChit()} busy={busy} error={formError} onClose={() => setFormOpen(false)} onSave={save} />}
    </div>
  );
}

/* ================================================================
   Chit details: members
   ================================================================ */
function ChitDetails({ chitId }) {
  const navigate = useNavigate();
  const [chit, setChit] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [chitFormOpen, setChitFormOpen] = useState(false);
  const [memberForm, setMemberForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [group, list] = await Promise.all([getChit(chitId), listChitMembers(chitId)]);
      setChit(group);
      setMembers(list || []);
    } catch (err) { setError(err?.message || 'Could not load this chit.'); }
    finally { setLoading(false); }
  }, [chitId]);
  useEffect(() => { load(); }, [load]);

  const full = chit && members.length >= Number(chit.memberCount);

  const saveChit = async (form) => {
    if (!form.name.trim()) { setFormError('Enter a chit name.'); return; }
    setBusy(true);
    setFormError('');
    try {
      await updateChit(chitId, {
        name: form.name.trim(), chitValue: Number(form.chitValue), memberCount: Number(form.memberCount),
        startDate: form.startDate, intervalMonths: Number(form.intervalMonths),
      });
      setChitFormOpen(false);
      await load();
    } catch (err) { setFormError(err?.message || 'Could not save the chit.'); }
    finally { setBusy(false); }
  };

  const saveMember = async (form) => {
    if (!form.name.trim()) { setFormError('Enter the member name.'); return; }
    if (String(form.phone).replace(/\D/g, '').slice(-10).length !== 10) { setFormError('Enter a 10-digit phone number.'); return; }
    setBusy(true);
    setFormError('');
    try {
      const payload = { name: form.name.trim(), phone: form.phone, address: form.address.trim(), photo: form.photo };
      if (form.id) await updateChitMember(chitId, form.id, payload);
      else await addChitMember(chitId, payload);
      setMemberForm(null);
      await load();
    } catch (err) { setFormError(err?.message || 'Could not save the member.'); }
    finally { setBusy(false); }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.type === 'chit') { await deleteChit(chitId); navigate('/chits'); return; }
      await deleteChitMember(chitId, confirm.member.id);
      setConfirm(null);
      await load();
    } catch (err) { setError(err?.message || 'Could not delete.'); setConfirm(null); }
    finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? members.filter((m) => `${m.name} ${m.phone} ${m.address || ''}`.toLowerCase().includes(query)) : members;
  }, [members, search]);

  if (loading && !chit) return <div className="module-page chits-page"><div className="expense-filter-empty">Loading chit…</div></div>;
  if (!chit) return <div className="module-page chits-page"><div className="form-error">{error || 'Chit not found.'}</div></div>;

  return (
    <div className="module-page chits-page">
      <ModuleHeader actions={
        <div className="page-actions-row">
          <PageBackButton />
          <ActionButton tone="secondary" icon={Pencil} onClick={() => { setFormError(''); setChitFormOpen(true); }}>Edit Chit</ActionButton>
          <ActionButton icon={UserPlus} disabled={full} onClick={() => { setFormError(''); setMemberForm(emptyMember()); }}>
            {full ? 'Chit Full' : 'Add Member'}
          </ActionButton>
        </div>
      } />

      <section className="module-card chit-hero">
        <div className="chit-hero-title">
          <span className="chit-row-icon"><Coins size={22} /></span>
          <div><h2>{chit.name}</h2><small>{chit.id}</small></div>
          <IconButton size="sm" label="Delete chit" onClick={() => setConfirm({ type: 'chit' })}><Trash2 size={15} /></IconButton>
        </div>
        <div className="chit-hero-grid">
          <div><span>Chit Value</span><strong>{formatCurrency(chit.chitValue)}</strong></div>
          <div><span>Members</span><strong>{members.length} / {chit.memberCount}</strong></div>
          <div><span>Installment</span><strong>{formatCurrency(chit.installmentAmount)}</strong></div>
          <div><span>Duration</span><strong>{intervalLabel(chit.intervalMonths)}</strong></div>
          <div><span>Chit Date</span><strong>{formatDate(chit.startDate)}</strong></div>
          <div><span>Ends</span><strong>{formatDate(chit.endDate)}</strong></div>
        </div>
      </section>

      <section className="module-card">
        <div className="expense-section-title">
          <div><h2>Members</h2><span>{full ? 'All member places are filled' : `${Number(chit.memberCount) - members.length} places left`}</span></div>
        </div>
        <div className="module-toolbar expense-filter-row">
          <label className="module-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or address..." aria-label="Search members" />
          </label>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="chit-member-list">
          {filtered.map((member) => (
            <article key={member.id} className="chit-member-card">
              <span className="chit-ticket">#{member.ticketNo}</span>
              <span className="chit-avatar">
                {member.photo
                  ? <ProtectedImage src={member.photo} alt="" fallback={<span>{member.name.charAt(0).toUpperCase()}</span>} />
                  : <span>{member.name.charAt(0).toUpperCase()}</span>}
              </span>
              <div className="chit-member-main">
                <strong>{member.name}</strong>
                <span>{formatIndianMobile(member.phone)}</span>
                {member.address && <small>{member.address}</small>}
              </div>
              <div className="row-actions">
                <IconButton size="sm" label={`Edit ${member.name}`} onClick={() => {
                  setFormError('');
                  setMemberForm({ id: member.id, name: member.name, phone: member.phone, address: member.address || '', photo: null, photoPreview: '', existingPhoto: member.photo });
                }}><Pencil size={15} /></IconButton>
                <IconButton size="sm" label={`Remove ${member.name}`} onClick={() => setConfirm({ type: 'member', member })}><Trash2 size={15} /></IconButton>
              </div>
            </article>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="expense-filter-empty">{members.length ? 'No members match your search.' : 'No members yet. Tap “Add Member” to add the first one.'}</div>
          )}
        </div>
      </section>

      {chitFormOpen && (
        <ChitForm
          initial={{ id: chit.id, name: chit.name, chitValue: String(chit.chitValue), memberCount: String(chit.memberCount), startDate: chit.startDate, intervalMonths: String(chit.intervalMonths) }}
          busy={busy} error={formError} onClose={() => setChitFormOpen(false)} onSave={saveChit}
        />
      )}
      {memberForm && <MemberForm initial={memberForm} busy={busy} error={formError} onClose={() => setMemberForm(null)} onSave={saveMember} />}
      {confirm?.type === 'chit' && (
        <ConfirmDelete title="Delete Chit?" detail={<><strong>{chit.name}</strong> · {formatCurrency(chit.chitValue)}</>}
          note="This permanently removes the chit and all its members." busy={busy} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
      )}
      {confirm?.type === 'member' && (
        <ConfirmDelete title="Remove Member?" detail={<><strong>{confirm.member.name}</strong> · {formatIndianMobile(confirm.member.phone)}</>}
          note="This removes the member from this chit." busy={busy} onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
      )}
    </div>
  );
}

export default function Chits() {
  const { chitId } = useParams();
  return chitId ? <ChitDetails chitId={chitId} /> : <ChitList />;
}
