import { useMemo, useState, useRef } from 'react';
import { CalendarDays, Pencil, PiggyBank, Plus, Trash2, Wallet, X } from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Savings.css';

const emptyDraft = () => ({ amount: '', date: toInputDate(), note: '' });

export default function Savings() {
  const actionLocksRef = useRef(new Set());

  const {
    savings = [],
    savingsTotal = 0,
    capitalMetrics,
    saveSavingEntry,
    deleteSavingEntry,
  } = useCrednivo();

  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentInHand = Number(capitalMetrics?.availableCapital || 0);
  const transferDelta = Number(draft.amount || 0) - Number(editor?.previousAmount || 0);

  const sortedSavings = useMemo(
    () => [...savings].sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }),
    [savings],
  );

  const openAdd = () => {
    setEditor({ mode: 'add', id: null, previousAmount: 0 });
    setDraft(emptyDraft());
    setError('');
  };

  const openEdit = (item) => {
    setEditor({ mode: 'edit', id: item.id, previousAmount: Number(item.amount || 0) });
    setDraft({ amount: String(item.amount || ''), date: item.date || toInputDate(), note: item.note || '' });
    setError('');
  };

  const closeEditor = () => {
    if (busy) return;
    setEditor(null);
    setDraft(emptyDraft());
    setError('');
  };

  const save = async (event) => {
    if (actionLocksRef.current.has('save')) return;
    actionLocksRef.current.add('save');
    try {
    event.preventDefault();
    if (busy || !editor) return;

    const amount = Number(draft.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid savings amount.');
      return;
    }
    if (!draft.date) {
      setError('Select a savings date.');
      return;
    }
    if (draft.date > toInputDate()) {
      setError('Future savings date is not allowed.');
      return;
    }

    // Available Capital already has all existing savings deducted. While editing,
    // the old amount is temporarily added back so the replacement can be checked.
    const maximumAllowed = currentInHand + Number(editor.previousAmount || 0);
    if (amount > maximumAllowed) {
      setError(`Savings cannot exceed the available in-hand amount (${formatCurrency(maximumAllowed)}).`);
      return;
    }

    try {
      setBusy(true);
      setError('');
      await saveSavingEntry(
        { amount, date: draft.date, note: draft.note },
        editor.mode === 'edit' ? editor.id : null,
      );
      setEditor(null);
      setDraft(emptyDraft());
      setError('');
    } catch (apiError) {
      setError(apiError?.message || 'Could not save the savings entry.');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('save');
    }
  };

  const confirmDelete = async () => {
    if (actionLocksRef.current.has('confirmDelete')) return;
    actionLocksRef.current.add('confirmDelete');
    try {
    if (!deleteTarget || busy) return;
    try {
      setBusy(true);
      setError('');
      await deleteSavingEntry(deleteTarget.id);
      setDeleteTarget(null);
    } catch (apiError) {
      setError(apiError?.message || 'Could not delete the savings entry.');
    } finally {
      setBusy(false);
    }
  
    } finally {
      actionLocksRef.current.delete('confirmDelete');
    }
  };

  return (
    <div className="module-page savings-page">
      <ModuleHeader
        eyebrow="Owner Reserve"
        title="Savings"
        description="Move business cash from In Hand into Savings without recording it as an expense."
        actions={<ActionButton icon={Plus} onClick={openAdd}>Add Savings</ActionButton>}
      />

      {error && !editor && <div className="savings-page-error">{error}</div>}

      <section className="savings-summary-grid" aria-label="Savings summary">
        <article className="savings-summary-card savings-total-card">
          <span className="savings-summary-icon"><PiggyBank size={25} /></span>
          <div><span>Overall Savings</span><strong>{formatCurrency(savingsTotal)}</strong><small>Total cash moved into Savings</small></div>
        </article>
        <article className="savings-summary-card savings-inhand-card">
          <span className="savings-summary-icon"><Wallet size={25} /></span>
          <div><span>Current In Hand</span><strong>{formatCurrency(currentInHand)}</strong><small>Savings already deducted from available cash</small></div>
        </article>
      </section>

      <section className="savings-rule app-card">
        <PiggyBank size={20} />
        <div><strong>Savings is a cash transfer, not an expense.</strong><span>Adding Savings increases Overall Savings and decreases In Hand by the same amount. Expense totals stay unchanged.</span></div>
      </section>

      <section className="savings-history app-card">
        <div className="savings-history-head">
          <div><h2>Savings History</h2><p>{sortedSavings.length} recorded entr{sortedSavings.length === 1 ? 'y' : 'ies'} · newest first</p></div>
          <strong>{formatCurrency(savingsTotal)}</strong>
        </div>

        {sortedSavings.length ? (
          <>
            <div className="savings-table-wrap savings-desktop-table">
              <table className="savings-table">
                <thead><tr><th>Date</th><th>Note / Purpose</th><th>Amount</th><th>Actions</th></tr></thead>
                <tbody>
                  {sortedSavings.map((item) => (
                    <tr key={item.id}>
                      <td><span className="savings-date"><CalendarDays size={15} />{formatDate(item.date)}</span></td>
                      <td>{item.note || <span className="savings-muted">No note</span>}</td>
                      <td><strong className="savings-money">{formatCurrency(item.amount)}</strong></td>
                      <td><div className="savings-actions"><IconButton label="Edit savings" onClick={() => openEdit(item)}><Pencil size={17} /></IconButton><IconButton label="Delete savings" className="savings-delete-icon" onClick={() => setDeleteTarget(item)}><Trash2 size={17} /></IconButton></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="savings-mobile-list">
              {sortedSavings.map((item) => (
                <article key={`mobile-${item.id}`} className="savings-mobile-card">
                  <div className="savings-mobile-top"><span><CalendarDays size={14} />{formatDate(item.date)}</span><strong>{formatCurrency(item.amount)}</strong></div>
                  <p>{item.note || 'No note'}</p>
                  <div className="savings-mobile-actions"><button onClick={() => openEdit(item)}><Pencil size={15} /> Edit</button><button className="danger" onClick={() => setDeleteTarget(item)}><Trash2 size={15} /> Delete</button></div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="savings-empty"><PiggyBank size={34} /><strong>No savings recorded yet</strong><p>Use “Add Savings” to move cash from In Hand into your owner reserve.</p><ActionButton icon={Plus} onClick={openAdd}>Add First Savings</ActionButton></div>
        )}
      </section>

      {editor && (
        <div className="savings-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeEditor()}>
          <form className="savings-modal" onSubmit={save}>
            <div className="savings-modal-head"><div><span>{editor.mode === 'edit' ? 'UPDATE SAVINGS' : 'NEW SAVINGS'}</span><h2>{editor.mode === 'edit' ? 'Edit Savings' : 'Add Savings'}</h2></div><button type="button" onClick={closeEditor} aria-label="Close"><X size={20} /></button></div>
            <div className="savings-modal-balance"><span>Available In Hand</span><strong>{formatCurrency(currentInHand + Number(editor.previousAmount || 0))}</strong></div>
            <label><span>Amount *</span><div className="savings-amount-input"><b>₹</b><input type="number" min="1" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0" autoFocus /></div></label>
            <label><span>Date *</span><input type="date" max={toInputDate()} value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
            <label><span>Note / Purpose</span><textarea maxLength={500} value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Example: Emergency reserve, monthly savings..." /></label>
            <div className="savings-transfer-preview"><span>{editor.mode === 'edit' ? 'Change from this edit:' : 'After saving this amount:'}</span><div><b>Savings</b><strong>{transferDelta >= 0 ? '+' : '−'} {formatCurrency(Math.abs(transferDelta))}</strong></div><div><b>In Hand</b><strong>{transferDelta >= 0 ? '−' : '+'} {formatCurrency(Math.abs(transferDelta))}</strong></div><small>Expenses will not change.</small></div>
            {error && <div className="savings-modal-error">{error}</div>}
            <div className="savings-modal-actions"><button type="button" onClick={closeEditor} disabled={busy}>Cancel</button><ActionButton type="submit" icon={PiggyBank} disabled={busy}>{busy ? 'Saving…' : 'Save Savings'}</ActionButton></div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="savings-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setDeleteTarget(null)}>
          <section className="savings-delete-modal">
            <span className="savings-delete-mark"><Trash2 size={24} /></span>
            <h2>Delete Savings Entry?</h2>
            <p>Deleting <strong>{formatCurrency(deleteTarget.amount)}</strong> will reduce Overall Savings and return the same amount to In Hand. Expenses remain unchanged.</p>
            <div className="savings-modal-actions"><button type="button" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</button><button type="button" className="savings-danger-button" onClick={confirmDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete'}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
