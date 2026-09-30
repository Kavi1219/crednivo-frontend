import { CalendarClock, Check, CheckCircle2, ChevronDown, HandCoins, Pencil, Percent, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import SummaryCard from '../../components/common/SummaryCard';
import { useAuth } from '../../context/AuthContext';
import { useCrednivo } from '../../context/CrednivoContext';
import {
  createCommitment, deleteCommitment, getCommitmentHistory, listCommitments, payCommitment, undoCommitmentPayment, updateCommitment,
} from '../../services/commitments';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';

export const COMMITMENT_CATEGORIES = ['Salary', 'EMI', 'Loan', 'Interest', 'Rent', 'Chit Saving', 'Savings', 'Other'];
/** Payments for these go to Savings instead of Expenses (Owner only). */
const SAVINGS_CATEGORIES = new Set(['Savings', 'Chit Saving']);
const STATUS_LABEL = { PAID: 'Paid', OVERDUE: 'Overdue', DUE: 'Due today', UPCOMING: 'Upcoming' };
/** Categories that show the Interest (%) field. */
const INTEREST_CATEGORIES = new Set(['EMI', 'Loan', 'Interest']);
/** Categories paid in installments: loan amount + EMI (payable) + tenure. */
const EMI_CATEGORIES = new Set(['EMI', 'Loan']);
/** What one due costs: the EMI when set, otherwise the full amount. */
const payableOf = (item) => Number(item?.payableAmount ?? item?.installmentAmount ?? item?.amount) || 0;
const CYCLES = [
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];
const cycleLabel = (value) => CYCLES.find((item) => item.value === value)?.label || value || '—';

/** Amount per month, used for the "Monthly Commitments" card (one-time excluded). */
function monthlyShare(item) {
  const amount = payableOf(item);
  switch (item.cycle) {
    case 'DAILY': return amount * 30;
    case 'WEEKLY': return (amount * 52) / 12;
    case 'MONTHLY': return amount;
    case 'QUARTERLY': return amount / 3;
    case 'YEARLY': return amount / 12;
    default: return 0;
  }
}

const emptyForm = () => ({ title: '', amount: '', cycle: 'MONTHLY', date: toInputDate(), category: 'Salary', interestRate: '', installmentAmount: '', tenure: '', note: '' });

/**
 * Expenses → Commitments: everything the business has to pay regularly.
 * The parent opens the "+ Commit" form through the ref: ref.current.startAdd().
 */
const CommitmentsPanel = forwardRef(function CommitmentsPanel(_props, ref) {
  const { hasPermission, isOwner } = useAuth();
  const { refreshCoreData } = useCrednivo();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  // Pay / history
  const [historyFor, setHistoryFor] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [payFor, setPayFor] = useState(null); // { item, dueDate }
  const [payForm, setPayForm] = useState({ amount: '', paidDate: toInputDate(), note: '' });
  const [payError, setPayError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await listCommitments() || []);
    } catch (err) {
      setError(err?.message || 'Could not load commitments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openHistory = async (item) => {
    setHistoryFor(item);
    setHistory([]);
    setHistoryLoading(true);
    try { setHistory(await getCommitmentHistory(item.id) || []); }
    catch (err) { setError(err?.message || 'Could not load the history.'); }
    finally { setHistoryLoading(false); }
  };

  const canPay = (item) => hasPermission('expenses.add') && (!SAVINGS_CATEGORIES.has(item.category) || isOwner);

  const openPay = (item, dueDate = item.currentDueDate) => {
    setPayFor({ item, dueDate });
    setPayForm({ amount: String(payableOf(item) || ''), paidDate: toInputDate(), note: '' });
    setPayError('');
  };

  const submitPay = async () => {
    if (!payFor) return;
    if (!(Number(payForm.amount) > 0)) { setPayError('Enter an amount greater than 0.'); return; }
    if (!payForm.paidDate) { setPayError('Choose the paid date.'); return; }
    setSaving(true);
    setPayError('');
    try {
      await payCommitment(payFor.item.id, {
        amount: Number(payForm.amount), paidDate: payForm.paidDate, dueDate: payFor.dueDate, note: payForm.note.trim() || null,
      });
      const paidItem = payFor.item;
      setPayFor(null);
      await Promise.all([load(), refreshCoreData?.()]);
      if (historyFor?.id === paidItem.id) await openHistory(paidItem);
    } catch (err) { setPayError(err?.message || 'Could not record the payment.'); }
    finally { setSaving(false); }
  };

  const undoPay = async (row) => {
    if (!row?.paymentId || !historyFor) return;
    setSaving(true);
    try {
      await undoCommitmentPayment(row.paymentId);
      await Promise.all([load(), refreshCoreData?.()]);
      await openHistory(historyFor);
    } catch (err) { setError(err?.message || 'Could not undo the payment.'); }
    finally { setSaving(false); }
  };

  const payCell = (item) => {
    if (item.payStatus === 'PAID') return <span className="commitment-paid-chip"><CheckCircle2 size={13} /> Paid</span>;
    const recentlyPaid = item.payStatus === 'UPCOMING' && item.paidCount > 0;
    return (
      <span className="commitment-pay-cell">
        {recentlyPaid && <span className="commitment-paid-chip"><CheckCircle2 size={13} /> Paid</span>}
        {canPay(item) && (
          <button type="button" className={`commitment-pay-button ${item.payStatus === 'OVERDUE' ? 'overdue' : ''} ${recentlyPaid ? 'ghost' : ''}`}
            onClick={(event) => { event.stopPropagation(); openPay(item); }}>
            {recentlyPaid ? 'Pay next' : item.payStatus === 'OVERDUE' ? 'Pay Now' : 'Pay'}
          </button>
        )}
      </span>
    );
  };

  const startAdd = () => { setEdit(null); setForm(emptyForm()); setFormError(''); setOpen(true); };
  useImperativeHandle(ref, () => ({ startAdd }));

  const startEdit = (item) => {
    setEdit(item);
    setForm({
      title: item.title || '',
      amount: String(item.amount ?? ''),
      cycle: item.cycle || 'MONTHLY',
      date: item.date || toInputDate(),
      category: item.category || 'Other',
      interestRate: item.interestRate == null ? '' : String(item.interestRate),
      installmentAmount: item.installmentAmount == null ? '' : String(item.installmentAmount),
      tenure: item.tenure == null ? '' : String(item.tenure),
      note: item.note || '',
    });
    setFormError('');
    setOpen(true);
  };

  const showInterest = INTEREST_CATEGORIES.has(form.category);
  const showEmi = EMI_CATEGORIES.has(form.category);

  const save = async () => {
    if (!form.title.trim()) { setFormError('Enter the commitment name.'); return; }
    if (!(Number(form.amount) > 0)) { setFormError('Enter an amount greater than 0.'); return; }
    if (!form.date) { setFormError('Choose the date.'); return; }
    if (showEmi && !(Number(form.installmentAmount) > 0)) { setFormError('Enter the EMI amount you pay each time.'); return; }
    const payload = {
      title: form.title.trim(),
      amount: Number(form.amount),
      cycle: form.cycle,
      date: form.date,
      category: form.category,
      interestRate: showInterest && form.interestRate !== '' ? Number(form.interestRate) : null,
      installmentAmount: showEmi && form.installmentAmount !== '' ? Number(form.installmentAmount) : null,
      tenure: showEmi && form.tenure !== '' ? Number(form.tenure) : null,
      note: form.note.trim() || null,
    };
    setSaving(true);
    setFormError('');
    try {
      if (edit) await updateCommitment(edit.id, payload);
      else await createCommitment(payload);
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err?.message || 'Could not save the commitment.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteItem) return;
    setSaving(true);
    try {
      await deleteCommitment(deleteItem.id);
      setDeleteItem(null);
      await load();
    } catch (err) {
      setError(err?.message || 'Could not delete the commitment.');
      setDeleteItem(null);
    } finally {
      setSaving(false);
    }
  };

  const today = toInputDate();
  const weekAhead = new Date(`${today}T00:00:00`);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAheadKey = toInputDate(weekAhead);

  const monthlyTotal = items.reduce((sum, item) => sum + monthlyShare(item), 0);
  const dueSoon = items.filter((item) => item.nextDueDate && item.nextDueDate >= today && item.nextDueDate <= weekAheadKey);
  const dueSoonTotal = dueSoon.reduce((sum, item) => sum + payableOf(item), 0);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (!query) return true;
      return [item.title, item.category, cycleLabel(item.cycle), item.amount, item.note]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [items, search, categoryFilter]);

  return (
    <>
      <section className="stats-section">
        <div className="expense-summary-grid">
          <SummaryCard title="Monthly Commitments" value={formatCurrency(Math.round(monthlyTotal))} note="All recurring commitments per month" icon={CalendarClock} tone="purple" />
          <SummaryCard title="Due in Next 7 Days" value={formatCurrency(dueSoonTotal)} note={`${dueSoon.length} ${dueSoon.length === 1 ? 'commitment' : 'commitments'} coming up`} icon={HandCoins} tone="orange" />
        </div>
      </section>

      <section className="module-card">
        <div className="expense-section-title">
          <div>
            <h2>Commitments</h2>
            <span>Salary, EMI, interest, rent, chit saving and other regular payments</span>
          </div>
          <div className="expense-history-summary">
            <span>{filtered.length} {filtered.length === 1 ? 'commitment' : 'commitments'}</span>
          </div>
        </div>

        <div className="module-toolbar expense-filter-row">
          <label className="module-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search commitment, category or amount..." aria-label="Search commitments" />
          </label>
          <div className="expense-quick-select">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Category">
              <option value="All">All Category</option>
              {COMMITMENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table commitments-table">
            <thead>
              <tr><th>Commitment</th><th>Category</th><th>Cycle</th><th>Next Due</th><th>Amount</th><th>Interest</th><th>Pay</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="commitment-row" onClick={() => openHistory(item)} title="Open payment history">
                  <td><strong>{item.title}</strong>{item.note && <small className="table-sub">{item.note}</small>}</td>
                  <td><span className="commitment-category-chip">{item.category}</span></td>
                  <td>
                    {cycleLabel(item.cycle)}
                    {item.tenure && <small className="table-sub">{item.paidCount} / {item.tenure} paid</small>}
                  </td>
                  <td>
                    {formatDate(item.currentDueDate || item.nextDueDate || item.date)}
                    {item.payStatus === 'OVERDUE' && <small className="commitment-overdue-note">Overdue</small>}
                  </td>
                  <td>
                    <strong>{formatCurrency(payableOf(item))}</strong>
                    {item.installmentAmount != null && <small className="table-sub">of {formatCurrency(item.amount)}</small>}
                  </td>
                  <td>{item.interestRate != null ? `${Number(item.interestRate)}%` : '—'}</td>
                  <td>{payCell(item)}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <div className="row-actions">
                      {hasPermission('expenses.edit') && <IconButton size="sm" label={`Edit ${item.title}`} onClick={() => startEdit(item)}><Pencil size={15} /></IconButton>}
                      {hasPermission('expenses.delete') && <IconButton size="sm" label={`Delete ${item.title}`} onClick={() => setDeleteItem(item)}><Trash2 size={15} /></IconButton>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan="8"><div className="expense-filter-empty">{items.length ? 'No commitments match your search.' : 'No commitments yet. Tap “+ Commit” to add salary, EMI, rent and more.'}</div></td></tr>
              )}
              {loading && <tr><td colSpan="8"><div className="expense-filter-empty">Loading commitments…</div></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mobile-data-list commitments-mobile-list">
          {filtered.map((item) => (
            <article key={item.id} className="commitment-mobile-card" onClick={() => openHistory(item)}>
              <div className="commitment-mobile-head">
                <strong>{item.title}</strong>
                <b>{formatCurrency(payableOf(item))}</b>
              </div>
              <div className="commitment-mobile-meta">
                <span className="commitment-category-chip">{item.category}</span>
                <span>{cycleLabel(item.cycle)}</span>
                <span>Next: {formatDate(item.currentDueDate || item.nextDueDate || item.date)}</span>
                {item.interestRate != null && <span>{Number(item.interestRate)}% interest</span>}
                {item.installmentAmount != null && <span>Loan {formatCurrency(item.amount)}</span>}
                {item.tenure && <span>{item.paidCount} / {item.tenure} paid</span>}
              </div>
              <div className="commitment-mobile-actions" onClick={(event) => event.stopPropagation()}>
                {payCell(item)}
                <div className="row-actions">
                  {hasPermission('expenses.edit') && <IconButton size="sm" label={`Edit ${item.title}`} onClick={() => startEdit(item)}><Pencil size={15} /></IconButton>}
                  {hasPermission('expenses.delete') && <IconButton size="sm" label={`Delete ${item.title}`} onClick={() => setDeleteItem(item)}><Trash2 size={15} /></IconButton>}
                </div>
              </div>
            </article>
          ))}
          {!loading && filtered.length === 0 && <div className="expense-filter-empty">{items.length ? 'No commitments match your search.' : 'No commitments yet.'}</div>}
        </div>
      </section>

      {open && (
        <div className="collection-modal-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="collection-modal module-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div><strong>{edit ? 'Edit Commitment' : 'New Commitment'}</strong><span>{edit ? 'Update this commitment' : 'Add a regular payment the business has to make'}</span></div>
              <IconButton label="Close" onClick={() => setOpen(false)}><X size={18} /></IconButton>
            </div>
            <div className="form-grid expense-form">
              <div className="form-field span-2">
                <label>Commitment</label>
                <input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="Staff salary, bank EMI, shop rent..." />
              </div>
              <div className="form-field">
                <label>{showEmi ? 'Loan Amount' : 'Amount'}</label>
                <input type="number" min="1" value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))} placeholder="₹" />
              </div>
              {showEmi && (
                <>
                  <div className="form-field">
                    <label>EMI Amount (you pay)</label>
                    <input type="number" min="1" value={form.installmentAmount} onChange={(event) => setForm((value) => ({ ...value, installmentAmount: event.target.value }))} placeholder="₹ per installment" />
                  </div>
                  <div className="form-field">
                    <label>Tenure (installments)</label>
                    <input type="number" min="1" value={form.tenure} onChange={(event) => setForm((value) => ({ ...value, tenure: event.target.value }))} placeholder="e.g. 36" />
                  </div>
                </>
              )}
              <div className="form-field">
                <label>Commitment Cycle</label>
                <select value={form.cycle} onChange={(event) => setForm((value) => ({ ...value, cycle: event.target.value }))}>
                  {CYCLES.map((cycle) => <option key={cycle.value} value={cycle.value}>{cycle.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>{form.cycle === 'ONE_TIME' ? 'Date' : 'First Due Date'}</label>
                <input type="date" value={form.date} onChange={(event) => setForm((value) => ({ ...value, date: event.target.value }))} />
              </div>
              <div className="form-field">
                <label>Category</label>
                <select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}>
                  {COMMITMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              {showInterest && (
                <div className="form-field">
                  <label>Interest (%)</label>
                  <div className="commitment-interest-input">
                    <input type="number" min="0" step="0.01" value={form.interestRate} onChange={(event) => setForm((value) => ({ ...value, interestRate: event.target.value }))} placeholder="e.g. 12" />
                    <Percent size={14} aria-hidden="true" />
                  </div>
                </div>
              )}
              <div className="form-field span-2">
                <label>Note (optional)</label>
                <input value={form.note} onChange={(event) => setForm((value) => ({ ...value, note: event.target.value }))} placeholder="Bank name, staff name, chit group..." />
              </div>
            </div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <ActionButton icon={Check} onClick={save} disabled={saving}>{saving ? 'Saving...' : edit ? 'Save Changes' : 'Save Commitment'}</ActionButton>
          </div>
        </div>
      )}

      {historyFor && (
        <div className="collection-modal-backdrop" onMouseDown={() => setHistoryFor(null)}>
          <div className="collection-modal module-card commitment-history-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div>
                <strong>{historyFor.title}</strong>
                <span>{historyFor.category} · {cycleLabel(historyFor.cycle)} · {formatCurrency(payableOf(historyFor))}{historyFor.tenure ? ` × ${historyFor.tenure}` : ''} · goes to {SAVINGS_CATEGORIES.has(historyFor.category) ? 'Savings' : 'Expenses'}</span>
              </div>
              <IconButton label="Close" onClick={() => setHistoryFor(null)}><X size={18} /></IconButton>
            </div>
            <div className="module-table-wrap">
              <table className="module-table commitment-history-table">
                <thead><tr><th>Pay Date</th><th>Paid Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={`${row.payDate}-${row.paymentId || 'open'}`}>
                      <td>{formatDate(row.payDate)}</td>
                      <td>{row.paidDate ? formatDate(row.paidDate) : '—'}</td>
                      <td><strong>{formatCurrency(row.amount)}</strong></td>
                      <td><span className={`commitment-status ${String(row.status).toLowerCase()}`}>{STATUS_LABEL[row.status] || row.status}</span></td>
                      <td>
                        {row.status === 'PAID'
                          ? (hasPermission('expenses.delete') && (!row.savingId || isOwner) && (
                            <button type="button" className="commitment-undo-button" onClick={() => undoPay(row)} disabled={saving} title="Undo this payment">
                              <RotateCcw size={13} /> Undo
                            </button>
                          ))
                          : canPay(historyFor) && (
                            <button type="button" className={`commitment-pay-button ${row.status === 'OVERDUE' ? 'overdue' : ''}`} onClick={() => openPay(historyFor, row.payDate)}>
                              {row.status === 'OVERDUE' ? 'Pay Now' : 'Pay'}
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                  {!historyLoading && history.length === 0 && <tr><td colSpan="5"><div className="expense-filter-empty">No dues yet.</div></td></tr>}
                  {historyLoading && <tr><td colSpan="5"><div className="expense-filter-empty">Loading history…</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {payFor && (
        <div className="collection-modal-backdrop" onMouseDown={() => setPayFor(null)}>
          <div className="collection-modal module-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div><strong>Pay {payFor.item.title}</strong><span>Due on {formatDate(payFor.dueDate)}</span></div>
              <IconButton label="Close" onClick={() => setPayFor(null)}><X size={18} /></IconButton>
            </div>
            <div className="form-grid expense-form">
              <div className="form-field">
                <label>Amount</label>
                <input type="number" min="1" value={payForm.amount} onChange={(event) => setPayForm((value) => ({ ...value, amount: event.target.value }))} />
              </div>
              <div className="form-field">
                <label>Paid Date</label>
                <input type="date" value={payForm.paidDate} onChange={(event) => setPayForm((value) => ({ ...value, paidDate: event.target.value }))} />
              </div>
              <div className="form-field span-2">
                <label>Note (optional)</label>
                <input value={payForm.note} onChange={(event) => setPayForm((value) => ({ ...value, note: event.target.value }))} placeholder="Cheque no, UPI ref..." />
              </div>
            </div>
            <div className="commitment-pay-hint">
              {SAVINGS_CATEGORIES.has(payFor.item.category)
                ? <>This will be added to <strong>Savings</strong>.</>
                : <>This will be added to <strong>Expenses</strong> as <strong>{payFor.item.category}</strong>.</>}
            </div>
            {payError && <div className="form-error" role="alert">{payError}</div>}
            <ActionButton icon={Check} onClick={submitPay} disabled={saving}>{saving ? 'Saving...' : 'Mark as Paid'}</ActionButton>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className="collection-modal-backdrop">
          <div className="delete-expense-dialog module-card">
            <span className="delete-expense-icon"><Trash2 size={22} /></span>
            <h2>Delete Commitment?</h2>
            <p><strong>{deleteItem.title}</strong> · {formatCurrency(payableOf(deleteItem))}</p>
            <small>This removes the commitment. Expenses and Savings already paid from it are kept.</small>
            <div>
              <ActionButton tone="secondary" onClick={() => setDeleteItem(null)}>Cancel</ActionButton>
              <ActionButton tone="danger" icon={Trash2} onClick={remove} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default CommitmentsPanel;
