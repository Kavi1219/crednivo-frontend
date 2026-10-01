import { BadgeCheck, CalendarClock, Check, CheckCircle2, ChevronDown, HandCoins, Pencil, Percent, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import SummaryCard from '../../components/common/SummaryCard';
import { useAuth } from '../../context/AuthContext';
import { useCrednivo } from '../../context/CrednivoContext';
import {
  completeCommitment, createCommitment, deleteCommitment, getCommitmentHistory, listCommitments, payCommitment, reopenCommitment,
  undoCommitmentPayment, updateCommitment,
} from '../../services/commitments';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';

export const COMMITMENT_CATEGORIES = ['Salary', 'Loan', 'Rent', 'Chit Saving', 'Savings', 'Other'];
/** Older commitments saved as EMI / Interest are shown and filtered as Loan. */
const categoryOf = (item) => (['EMI', 'Interest'].includes(item?.category) ? 'Loan' : item?.category);
/** Loan repayment kind: EMI (fixed installments over a tenure) or Interest (interest only, no end). */
const loanKindOf = (item) => {
  if (item?.category === 'EMI') return 'EMI';
  if (item?.category === 'Interest') return 'INTEREST';
  return item?.tenure ? 'EMI' : 'INTEREST';
};
/** Chip text: loans show their repayment type (EMI / Interest), the rest show their category. */
const chipLabel = (item) => (categoryOf(item) === 'Loan' ? (loanKindOf(item) === 'EMI' ? 'EMI' : 'Interest') : item?.category);
const PERIODS_PER_YEAR = { DAILY: 365, WEEKLY: 52, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1, ONE_TIME: 12 };
const CYCLE_UNIT = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', QUARTERLY: 'quarter', YEARLY: 'year', ONE_TIME: 'month' };
const round2 = (value) => Math.round(value * 100) / 100;

/** Tenure column: "48 months", "20 weeks" … or the cycle when there is no end ("Monthly"). */
function tenureLabel(item) {
  if (item?.cycle === 'ONE_TIME') return 'One time';
  if (!item?.tenure) return CYCLES.find((c) => c.value === item?.cycle)?.label || '—';
  const unit = CYCLE_UNIT[item.cycle] || 'month';
  return `${item.tenure} ${unit}${Number(item.tenure) === 1 ? '' : 's'}`;
}

/** Interest column: EMI rate is per year; interest-only rate is per cycle. */
function interestLabel(item) {
  if (item?.interestRate == null) return '—';
  const rate = `${Number(item.interestRate)}%`;
  if (categoryOf(item) !== 'Loan') return rate;
  return loanKindOf(item) === 'EMI' ? `${rate} / year` : `${rate} / ${CYCLE_UNIT[item.cycle] || 'month'}`;
}

/**
 * EMI for a loan (reducing balance): EMI = P·r·(1+r)^n / ((1+r)^n − 1),
 * r = annual rate ÷ 100 ÷ installments per year. 0% → P ÷ n.
 */
function emiFromRate(principal, annualRate, n, cycle) {
  if (!(principal > 0) || !(n > 0)) return 0;
  const r = (Number(annualRate) || 0) / 100 / (PERIODS_PER_YEAR[cycle] || 12);
  if (r <= 0) return round2(principal / n);
  const f = (1 + r) ** n;
  return round2((principal * r * f) / (f - 1));
}

/** Yearly interest rate that gives this EMI (inverse of emiFromRate); null if the EMI can't repay the loan. */
function rateFromEmi(principal, emi, n, cycle) {
  if (!(principal > 0) || !(n > 0) || !(emi > 0)) return null;
  if (emi * n < principal - 0.5) return null; // EMI too small to ever repay the loan
  if (Math.abs(emi * n - principal) < 0.5) return 0;
  let low = 0;
  let high = 1000;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (emiFromRate(principal, mid, n, cycle) > emi) high = mid; else low = mid;
  }
  return round2((low + high) / 2);
}
/** Payments for these go to Savings instead of Expenses (Owner only). */
const SAVINGS_CATEGORIES = new Set(['Savings', 'Chit Saving']);
const STATUS_LABEL = { PAID: 'Paid', OVERDUE: 'Overdue', DUE: 'Due today', UPCOMING: 'Upcoming' };
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

const emptyForm = () => ({
  receivedDate: '',
  title: '', amount: '', cycle: 'MONTHLY', date: toInputDate(), category: 'Salary',
  loanKind: 'EMI', interestRate: '', installmentAmount: '', tenure: '', emiDriver: 'emi', note: '',
});

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
  // Two separate lists: 'loans' (EMI + Interest loans) and 'payments' (salary, rent, chit…).
  // Loans never show in Payments. The category dropdown exists only in Payments.
  const [view, setView] = useState('loans');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  // Loans: "Mark as completed" dialog
  const [completeFor, setCompleteFor] = useState(null);
  const [completeDate, setCompleteDate] = useState(toInputDate());
  const [completeError, setCompleteError] = useState('');
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
    if (item.payStatus === 'COMPLETED') return <span className="commitment-muted">—</span>;
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

  const isDone = (item) => item?.payStatus === 'COMPLETED' || item?.payStatus === 'PAID';

  const openComplete = (item) => { setCompleteFor(item); setCompleteDate(toInputDate()); setCompleteError(''); };

  const submitComplete = async () => {
    if (!completeFor) return;
    if (!completeDate) { setCompleteError('Choose the completed date.'); return; }
    if (completeDate > toInputDate()) { setCompleteError("The completed date can't be in the future."); return; }
    setSaving(true);
    setCompleteError('');
    try {
      const updated = await completeCommitment(completeFor.id, { completedDate: completeDate });
      setCompleteFor(null);
      await Promise.all([load(), refreshCoreData?.()]);
      if (historyFor?.id === updated?.id) await openHistory(updated);
    } catch (err) { setCompleteError(err?.message || 'Could not complete the loan.'); }
    finally { setSaving(false); }
  };

  const reopen = async (item) => {
    setSaving(true);
    try {
      const updated = await reopenCommitment(item.id);
      await load();
      if (historyFor?.id === updated?.id) await openHistory(updated);
    } catch (err) { setError(err?.message || 'Could not reopen the loan.'); }
    finally { setSaving(false); }
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
      category: categoryOf(item) || 'Other',
      loanKind: loanKindOf(item),
      emiDriver: 'emi',
      interestRate: item.interestRate == null ? '' : String(item.interestRate),
      installmentAmount: item.installmentAmount == null ? '' : String(item.installmentAmount),
      tenure: item.tenure == null ? '' : String(item.tenure),
      note: item.note || '',
      receivedDate: item.receivedDate || '',
    });
    setFormError('');
    setOpen(true);
  };

  const isLoan = form.category === 'Loan';
  const isEmi = isLoan && form.loanKind === 'EMI';
  const isInterestOnly = isLoan && form.loanKind === 'INTEREST';
  const cycleUnit = CYCLE_UNIT[form.cycle] || 'month';
  // Interest-only: amount to pay each cycle = loan × rate % (rate per cycle).
  const interestPayable = isInterestOnly && Number(form.amount) > 0 && Number(form.interestRate) > 0
    ? round2(Number(form.amount) * Number(form.interestRate) / 100) : 0;
  const emiTotals = isEmi && Number(form.installmentAmount) > 0 && Number(form.tenure) > 0
    ? { total: round2(Number(form.installmentAmount) * Number(form.tenure)), interest: round2(Number(form.installmentAmount) * Number(form.tenure) - Number(form.amount || 0)) }
    : null;

  /**
   * EMI form: enter EITHER the EMI or the yearly interest rate; the other is
   * worked out from the loan amount and tenure. emiDriver remembers which one
   * the user typed last, so changing the amount/tenure/cycle recalculates the other.
   */
  const updateEmiForm = (patch) => setForm((current) => {
    const next = { ...current, ...patch };
    if (next.category !== 'Loan' || next.loanKind !== 'EMI') return next;
    const principal = Number(next.amount);
    const n = Number(next.tenure);
    if (next.emiDriver === 'rate') {
      const emi = emiFromRate(principal, Number(next.interestRate), n, next.cycle);
      next.installmentAmount = emi > 0 && next.interestRate !== '' ? String(emi) : next.installmentAmount;
    } else {
      const rate = rateFromEmi(principal, Number(next.installmentAmount), n, next.cycle);
      next.interestRate = rate == null ? '' : String(rate);
    }
    return next;
  });

  const save = async () => {
    if (!form.title.trim()) { setFormError('Enter the commitment name.'); return; }
    if (!(Number(form.amount) > 0)) { setFormError('Enter an amount greater than 0.'); return; }
    if (!form.date) { setFormError('Choose the date.'); return; }
    if (isEmi) {
      if (!(Number(form.tenure) > 0)) { setFormError('Enter the tenure (number of installments).'); return; }
      if (!(Number(form.installmentAmount) > 0)) { setFormError('Enter the EMI amount or the interest rate.'); return; }
      if (Number(form.installmentAmount) * Number(form.tenure) < Number(form.amount) - 0.5) {
        setFormError('This EMI is too small to repay the loan in this tenure.'); return;
      }
    }
    if (isInterestOnly && !(Number(form.interestRate) > 0)) { setFormError('Enter the interest percentage.'); return; }
    const payload = {
      title: form.title.trim(),
      amount: Number(form.amount),
      cycle: form.cycle,
      date: form.date,
      category: form.category,
      // Loan → EMI: installment + tenure (+ yearly rate). Loan → Interest: payable = interest, no tenure.
      interestRate: isLoan && form.interestRate !== '' ? Number(form.interestRate) : null,
      installmentAmount: isEmi ? Number(form.installmentAmount) : isInterestOnly ? interestPayable : null,
      tenure: isEmi ? Number(form.tenure) : null,
      note: form.note.trim() || null,
      receivedDate: isLoan && form.receivedDate ? form.receivedDate : null,
    };
    setSaving(true);
    setFormError('');
    try {
      if (edit) await updateCommitment(edit.id, payload);
      else await createCommitment(payload);
      setOpen(false);
      setView(isLoan ? 'loans' : 'payments');
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

  const running = items.filter((item) => !isDone(item));
  const monthlyTotal = running.reduce((sum, item) => sum + monthlyShare(item), 0);
  const dueSoon = running.filter((item) => item.nextDueDate && item.nextDueDate >= today && item.nextDueDate <= weekAheadKey);
  const dueSoonTotal = dueSoon.reduce((sum, item) => sum + payableOf(item), 0);

  const isLoanView = view === 'loans';
  const loanCount = items.filter((item) => categoryOf(item) === 'Loan').length;
  const paymentCount = items.length - loanCount;

  // First load: if there are no loans but there are payments, open Payments instead of an empty tab.
  const viewPicked = useRef(false);
  useEffect(() => {
    if (loading || viewPicked.current) return;
    viewPicked.current = true;
    if (loanCount === 0 && paymentCount > 0) setView('payments');
  }, [loading, loanCount, paymentCount]);

  const switchView = (next) => { setView(next); setCategoryFilter('All'); };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if ((categoryOf(item) === 'Loan') !== isLoanView) return false;
      if (!isLoanView && categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (!query) return true;
      return [item.title, item.note, chipLabel(item), cycleLabel(item.cycle), item.amount, payableOf(item)]
        .some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [items, search, isLoanView, categoryFilter]);

  const stateChip = (item) => (
    <span className={`commitment-state ${isDone(item) ? 'closed' : 'active'}`}>{isDone(item) ? 'Completed' : 'Active'}</span>
  );
  /**
   * Date under the Pay button. Loans: "Due …". Payments (salary, rent…) aren't debts,
   * so they read "Next on …" — only a missed date is shown as "Overdue since …".
   */
  const dueLabel = (item) => {
    if (item.payStatus === 'OVERDUE') return isLoanView ? 'Due' : 'Overdue since';
    return isLoanView ? 'Due' : 'Next on';
  };
  const dueNote = (item) => !isDone(item) && (
    <small className={`table-sub ${item.payStatus === 'OVERDUE' ? 'commitment-overdue-note' : ''}`}>
      {dueLabel(item)} {formatDate(item.currentDueDate || item.nextDueDate || item.date)}
    </small>
  );
  // Payments already have a Frequency column, so "per month" is only shown for loans.
  const payableCell = (item) => (
    <>
      <strong>{formatCurrency(payableOf(item))}</strong>
      {isLoanView && <small className="table-sub">per {CYCLE_UNIT[item.cycle] || 'month'}</small>}
    </>
  );
  // Each list shows only the columns it needs. Edit / Delete / Complete live in the detail view (click a row).
  const LOAN_HEADINGS = ['Loan', 'Lender', 'Type', 'Loan Amount', 'Received On', 'Interest', 'Tenure', 'Payable', 'Status', 'Pay'];
  const PAYMENT_HEADINGS = ['Commitment', 'Paid To', 'Category', 'Frequency', 'Payable', 'Status', 'Pay'];
  const headings = isLoanView ? LOAN_HEADINGS : PAYMENT_HEADINGS;

  const loanCells = (item) => (
    <>
      <td><strong>{item.title}</strong></td>
      <td>{item.note || '—'}</td>
      <td><span className="commitment-category-chip">{chipLabel(item)}</span></td>
      <td><strong>{formatCurrency(item.amount)}</strong></td>
      <td>{item.receivedDate ? formatDate(item.receivedDate) : '—'}</td>
      <td>{interestLabel(item)}</td>
      <td>
        {tenureLabel(item)}
        {item.tenure && <small className="table-sub">{item.paidCount} / {item.tenure} paid</small>}
      </td>
    </>
  );
  const paymentCells = (item) => (
    <>
      <td><strong>{item.title}</strong></td>
      <td>{item.note || '—'}</td>
      <td><span className="commitment-category-chip">{chipLabel(item)}</span></td>
      <td>{cycleLabel(item.cycle)}</td>
    </>
  );

  /** The commitments list (desktop table + phone cards) for the open tab. */
  const renderCommitmentList = (list, emptyText) => (
    <div className="commitment-group">
        <div className="module-table-wrap desktop-data-table">
          <table className={`module-table commitments-table ${isLoanView ? 'is-loans' : 'is-payments'}`}>
            <thead>
              <tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id} className={`commitment-row ${isDone(item) ? 'is-done' : ''}`} onClick={() => openHistory(item)} title="Open details">
                  {isLoanView ? loanCells(item) : paymentCells(item)}
                  <td>{payableCell(item)}</td>
                  <td>{stateChip(item)}</td>
                  <td className="commitment-pay-col">
                    {payCell(item)}
                    {dueNote(item)}
                  </td>
                </tr>
              ))}
              {!loading && list.length === 0 && (
                <tr><td colSpan={headings.length}><div className="expense-filter-empty">{emptyText}</div></td></tr>
              )}
              {loading && <tr><td colSpan={headings.length}><div className="expense-filter-empty">Loading commitments…</div></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mobile-data-list commitments-mobile-list">
          {list.map((item) => (
            <article key={item.id} className={`commitment-mobile-card ${isDone(item) ? 'is-done' : ''}`} onClick={() => openHistory(item)}>
              <div className="commitment-mobile-head">
                <strong>{item.title}</strong>
                <b>{formatCurrency(payableOf(item))}</b>
              </div>
              <div className="commitment-mobile-meta">
                <span className="commitment-category-chip">{chipLabel(item)}</span>
                {stateChip(item)}
                {item.note && <span>{isLoanView ? 'From' : 'To'}: {item.note}</span>}
                <span>{isLoanView ? tenureLabel(item) : cycleLabel(item.cycle)}</span>
                {isLoanView && <span>Loan {formatCurrency(item.amount)}</span>}
                {isLoanView && item.receivedDate && <span>Received {formatDate(item.receivedDate)}</span>}
                {isLoanView && item.interestRate != null && <span>{interestLabel(item)}</span>}
                {isLoanView && item.tenure && <span>{item.paidCount} / {item.tenure} paid</span>}
                {!isDone(item) && <span>{dueLabel(item)} {formatDate(item.currentDueDate || item.nextDueDate || item.date)}</span>}
              </div>
              <div className="commitment-mobile-actions" onClick={(event) => event.stopPropagation()}>
                {payCell(item)}
              </div>
            </article>
          ))}
          {!loading && list.length === 0 && <div className="expense-filter-empty">{emptyText}</div>}
        </div>
    </div>
  );

  const countLabel = isLoanView
    ? `${filtered.length} ${filtered.length === 1 ? 'loan' : 'loans'}`
    : `${filtered.length} ${filtered.length === 1 ? 'commitment' : 'commitments'}`;
  const emptyText = isLoanView
    ? (loanCount ? 'No loans match your search.' : 'No loans yet. Tap “+ Commit” and choose Loan as the category.')
    : (paymentCount ? 'No commitments match your search.' : 'No payments yet. Tap “+ Commit” to add salary, rent and more.');

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
            <span>{isLoanView ? 'Loans you are repaying' : 'Salary, rent and other regular payments'}</span>
          </div>
          <div className="expense-history-summary">
            <span>{countLabel}</span>
          </div>
        </div>

        <div className="module-toolbar expense-filter-row">
          <div className="commitment-view-tabs" role="tablist" aria-label="Commitment type">
            <button type="button" role="tab" aria-selected={isLoanView} className={isLoanView ? 'active' : ''} onClick={() => switchView('loans')}>
              Loans <span>{loanCount}</span>
            </button>
            <button type="button" role="tab" aria-selected={!isLoanView} className={!isLoanView ? 'active' : ''} onClick={() => switchView('payments')}>
              Payments <span>{paymentCount}</span>
            </button>
          </div>
          <label className="module-search">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder={isLoanView ? 'Search loan, lender or amount...' : 'Search commitment, paid to or amount...'}
              aria-label={isLoanView ? 'Search loans' : 'Search payments'} />
          </label>
          {!isLoanView && (
            <div className="expense-quick-select">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Category">
                <option value="All">All categories</option>
                {COMMITMENT_CATEGORIES.filter((category) => category !== 'Loan').map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <ChevronDown size={14} />
            </div>
          )}
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        {renderCommitmentList(filtered, emptyText)}
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
                <label>Category</label>
                <select value={form.category} onChange={(event) => updateEmiForm({ category: event.target.value })}>
                  {COMMITMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>{isLoan ? 'Loan Amount' : 'Amount'}</label>
                <input type="number" min="1" value={form.amount} onChange={(event) => updateEmiForm({ amount: event.target.value })} placeholder="₹" />
              </div>
              <div className="form-field">
                <label>Commitment Cycle</label>
                <select value={form.cycle} onChange={(event) => updateEmiForm({ cycle: event.target.value })}>
                  {CYCLES.filter((cycle) => !isLoan || cycle.value !== 'ONE_TIME').map((cycle) => <option key={cycle.value} value={cycle.value}>{cycle.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>{form.cycle === 'ONE_TIME' ? 'Date' : 'First Due Date'}</label>
                <input type="date" value={form.date} onChange={(event) => setForm((value) => ({ ...value, date: event.target.value }))} />
              </div>

              {isLoan && (
                <div className="form-field">
                  <label>Loan Received On</label>
                  <input type="date" value={form.receivedDate} onChange={(event) => setForm((value) => ({ ...value, receivedDate: event.target.value }))} />
                </div>
              )}

              {isLoan && (
                <div className="form-field span-2">
                  <label>Repayment</label>
                  <div className="commitment-loan-kind" role="radiogroup" aria-label="Loan repayment type">
                    {[{ value: 'EMI', label: 'EMI', hint: 'Fixed installments' }, { value: 'INTEREST', label: 'Interest', hint: 'Interest only' }].map((kind) => (
                      <button key={kind.value} type="button" role="radio" aria-checked={form.loanKind === kind.value}
                        className={form.loanKind === kind.value ? 'active' : ''}
                        onClick={() => updateEmiForm({ loanKind: kind.value })}>
                        <strong>{kind.label}</strong><small>{kind.hint}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isEmi && (
                <>
                  <div className="form-field">
                    <label>Tenure (installments)</label>
                    <input type="number" min="1" value={form.tenure} onChange={(event) => updateEmiForm({ tenure: event.target.value })} placeholder="e.g. 36" />
                  </div>
                  <div className="form-field">
                    <label>EMI Amount (you pay)</label>
                    <input type="number" min="1" value={form.installmentAmount}
                      onChange={(event) => updateEmiForm({ installmentAmount: event.target.value, emiDriver: 'emi' })}
                      placeholder={`₹ per ${cycleUnit}`} />
                  </div>
                  <div className="form-field">
                    <label>Interest (% per year)</label>
                    <div className="commitment-interest-input">
                      <input type="number" min="0" step="0.01" value={form.interestRate}
                        onChange={(event) => updateEmiForm({ interestRate: event.target.value, emiDriver: 'rate' })}
                        placeholder="or enter the rate" />
                      <Percent size={14} aria-hidden="true" />
                    </div>
                  </div>
                  <div className="form-field span-2">
                    <div className="commitment-calc-note">
                      Enter <strong>either</strong> the EMI <strong>or</strong> the interest rate — the other is calculated.
                      {emiTotals && <> Total repayment <strong>{formatCurrency(emiTotals.total)}</strong> · interest <strong>{formatCurrency(Math.max(0, emiTotals.interest))}</strong>.</>}
                    </div>
                  </div>
                </>
              )}

              {isInterestOnly && (
                <>
                  <div className="form-field">
                    <label>Interest (% per {cycleUnit})</label>
                    <div className="commitment-interest-input">
                      <input type="number" min="0" step="0.01" value={form.interestRate}
                        onChange={(event) => setForm((value) => ({ ...value, interestRate: event.target.value }))} placeholder="e.g. 2" />
                      <Percent size={14} aria-hidden="true" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Amount to pay</label>
                    <div className="commitment-calc-value">{interestPayable > 0 ? `${formatCurrency(interestPayable)} / ${cycleUnit}` : '—'}</div>
                  </div>
                </>
              )}

              <div className="form-field span-2">
                <label>Paid To</label>
                <input value={form.note} onChange={(event) => setForm((value) => ({ ...value, note: event.target.value }))}
                  placeholder={isLoan ? 'Bank or person who gave the loan' : 'Staff, landlord, chit group...'} />
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

            {(hasPermission('expenses.edit') || hasPermission('expenses.delete')) && (
              <div className="commitment-detail-actions">
                {hasPermission('expenses.edit') && (
                  <ActionButton tone="secondary" icon={Pencil} onClick={() => { const item = historyFor; setHistoryFor(null); startEdit(item); }}>Edit</ActionButton>
                )}
                {hasPermission('expenses.edit') && categoryOf(historyFor) === 'Loan' && (
                  historyFor.payStatus === 'COMPLETED'
                    ? <ActionButton tone="secondary" icon={RotateCcw} onClick={() => reopen(historyFor)} disabled={saving}>Reopen</ActionButton>
                    : <ActionButton tone="success" icon={BadgeCheck} onClick={() => openComplete(historyFor)}>Mark as completed</ActionButton>
                )}
                {hasPermission('expenses.delete') && (
                  <ActionButton tone="danger" icon={Trash2} className="commitment-detail-delete"
                    onClick={() => { const item = historyFor; setHistoryFor(null); setDeleteItem(item); }}>Delete</ActionButton>
                )}
              </div>
            )}

            {historyFor.payStatus === 'COMPLETED' && (
              <div className="commitment-completed-note">
                <BadgeCheck size={15} aria-hidden="true" />
                Completed on {formatDate(historyFor.completedDate)}. No more dues — only paid history is shown.
              </div>
            )}

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

      {completeFor && (
        <div className="collection-modal-backdrop" onMouseDown={() => setCompleteFor(null)}>
          <div className="collection-modal module-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div><strong>Complete {completeFor.title}?</strong><span>The loan stops creating dues. Payments already made stay in Expenses.</span></div>
              <IconButton label="Close" onClick={() => setCompleteFor(null)}><X size={18} /></IconButton>
            </div>
            <div className="form-grid expense-form">
              <div className="form-field span-2">
                <label>Completed On</label>
                <input type="date" value={completeDate} max={toInputDate()} onChange={(event) => setCompleteDate(event.target.value)} />
              </div>
            </div>
            {completeFor.tenure && completeFor.paidCount < completeFor.tenure && (
              <div className="commitment-pay-hint">
                Only <strong>{completeFor.paidCount} of {completeFor.tenure}</strong> installments are recorded as paid. Use this when the loan is settled or closed early.
              </div>
            )}
            {completeError && <div className="form-error" role="alert">{completeError}</div>}
            <ActionButton tone="success" icon={BadgeCheck} onClick={submitComplete} disabled={saving}>{saving ? 'Saving...' : 'Mark as completed'}</ActionButton>
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
