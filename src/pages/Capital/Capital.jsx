import {
  ArrowDownToLine,
  ArrowRight,
  Coins,
  HandCoins,
  Percent,
  ArrowUpFromLine,
  Banknote,
  Landmark,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import { PageBackButton } from '../../components/GlobalBackButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import SummaryCard from '../../components/common/SummaryCard';
import { calculateActualProfit } from '../../utils/profit';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import { CYCLE_UNIT, LOAN_CYCLES, recalcEmi, round2 } from '../../utils/commitmentMath';
import { createCommitment } from '../../services/commitments';
import './Capital.css';

/** Borrowed loans come from Expenses → Commitments and are edited there, not here. */
const isBorrowed = (item) => item?.source === 'LOAN_COMMITMENT';
const COMMITMENT_LOANS_LINK = '/expenses?view=commitments';
/** Type option that saves a borrowed loan straight into Expenses → Commitments (same fields as there). */
const LOAN_TYPE = 'Loan (borrowed)';
const LOAN_DEFAULTS = {
  loanKind: 'EMI', cycle: 'MONTHLY', firstDueDate: '', tenure: '', installmentAmount: '', interestRate: '', emiDriver: 'emi',
};

const EMPTY_FORM = {
  investorName: '',
  amount: '',
  date: toInputDate(),
  paymentMode: 'Bank',
  type: 'Investment',
  note: '',
  createdBy: '',
  ...LOAN_DEFAULTS,
};

/** Check the loan fields and build the same payload the Commitments form sends. Returns { error } or { payload }. */
function buildLoanCommitment(form) {
  const isEmi = form.loanKind === 'EMI';
  const amount = Number(form.amount);
  if (!form.investorName.trim()) return { error: 'Enter the lender.' };
  if (!(amount > 0)) return { error: 'Enter the loan amount.' };
  if (!form.date) return { error: 'Choose the date the loan was received.' };
  if (!form.firstDueDate) return { error: 'Choose the first due date.' };
  if (isEmi) {
    if (!(Number(form.tenure) > 0)) return { error: 'Enter the tenure (number of installments).' };
    if (!(Number(form.installmentAmount) > 0)) return { error: 'Enter the EMI amount or the interest rate.' };
    if (Number(form.installmentAmount) * Number(form.tenure) < amount - 0.5) return { error: 'This EMI is too small to repay the loan in this tenure.' };
  } else if (!(Number(form.interestRate) > 0)) {
    return { error: 'Enter the interest percentage.' };
  }
  const lender = form.investorName.trim();
  const interestPayable = !isEmi ? round2(amount * Number(form.interestRate) / 100) : 0;
  return {
    payload: {
      title: form.note.trim() || `Loan from ${lender}`,
      amount,
      cycle: form.cycle,
      date: form.firstDueDate,
      category: 'Loan',
      interestRate: form.interestRate !== '' ? Number(form.interestRate) : null,
      installmentAmount: isEmi ? Number(form.installmentAmount) : interestPayable,
      tenure: isEmi ? Number(form.tenure) : null,
      note: lender,
      receivedDate: form.date,
    },
  };
}

// mode: 'add' (Investment / Additional Investment) or 'withdrawal' (Capital
// Withdrawal only). Withdrawals have their own button, so the Add Capital
// form no longer offers the withdrawal type.
function CapitalModal({ open, onClose, onSave, onSaveLoan, canAddLoan = false, company, editing, mode = 'add', saving = false }) {
  const isWithdrawal = mode === 'withdrawal';
  const [form, setForm] = useState(EMPTY_FORM);
  const [loanError, setLoanError] = useState('');
  const isLoan = !isWithdrawal && !editing && form.type === LOAN_TYPE;
  const isEmi = isLoan && form.loanKind === 'EMI';
  const cycleUnit = CYCLE_UNIT[form.cycle] || 'month';
  const interestPayable = isLoan && !isEmi && Number(form.amount) > 0 && Number(form.interestRate) > 0
    ? round2(Number(form.amount) * Number(form.interestRate) / 100) : 0;
  const emiTotals = isEmi && Number(form.installmentAmount) > 0 && Number(form.tenure) > 0
    ? { total: round2(Number(form.installmentAmount) * Number(form.tenure)), interest: round2(Number(form.installmentAmount) * Number(form.tenure) - Number(form.amount || 0)) }
    : null;

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      investorName: editing.investorName || '',
      amount: editing.amount || '',
      date: editing.date || toInputDate(),
      paymentMode: editing.paymentMode || 'Bank',
      type: editing.type || (isWithdrawal ? 'Capital Withdrawal' : 'Investment'),
      note: editing.note || '',
      createdBy: editing.createdBy || company?.owner || '',
    } : { ...EMPTY_FORM, date: toInputDate(), type: isWithdrawal ? 'Capital Withdrawal' : 'Investment', createdBy: company?.owner || '' });
    setLoanError('');
  }, [open, editing, company?.owner, isWithdrawal]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  /** Loan fields that affect the EMI ⇄ rate maths go through here. */
  const updateLoan = (patch) => setForm((current) => recalcEmi({ ...current, ...patch }));
  const submit = async (event) => {
    event.preventDefault();
    if (isLoan) {
      const { error, payload } = buildLoanCommitment(form);
      if (error) { setLoanError(error); return; }
      setLoanError('');
      try { await onSaveLoan(payload); } catch (err) { setLoanError(err?.message || 'Could not save the loan.'); }
      return;
    }
    if (!form.investorName.trim() || Number(form.amount) <= 0) return;
    onSave(form);
  };

  return (
    <div className="capital-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capital-modal app-card" role="dialog" aria-modal="true" aria-label={isWithdrawal ? (editing ? 'Edit withdrawal' : 'Capital withdrawal') : (editing ? 'Edit capital entry' : 'Add capital')}>
        <div className="capital-modal-head">
          <div className="capital-modal-title">
            <span>{isWithdrawal ? <ArrowUpFromLine size={20} /> : <Landmark size={20} />}</span>
            <div>
              <small>CAPITAL MANAGEMENT</small>
              <h2>{isWithdrawal ? (editing ? 'Edit Withdrawal' : 'Capital Withdrawal') : (editing ? 'Edit Capital Entry' : 'Add Capital')}</h2>
              <p>{isWithdrawal ? 'Record money taken out by a partner or investor.' : 'Record an investment or additional capital.'}</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={19} /></IconButton>
        </div>

        <form onSubmit={submit} className="capital-form">
          <div className="capital-form-grid">
            <label className="capital-field">
              <span>{isLoan ? 'Lender *' : 'Investor / Partner Name *'}</span>
              <input value={form.investorName} onChange={update('investorName')} placeholder={isLoan ? 'Bank or person who gave the loan' : 'Enter investor or partner name'} autoFocus />
            </label>
            <label className="capital-field">
              <span>{isLoan ? 'Loan Amount *' : 'Amount *'}</span>
              <input type="number" min="1" step="1" value={form.amount} onChange={(event) => updateLoan({ amount: event.target.value })} placeholder="Enter amount" />
            </label>
            <label className="capital-field">
              <span>{isLoan ? 'Loan Received On *' : 'Date *'}</span>
              <input type="date" value={form.date} onChange={update('date')} />
            </label>
            {!isWithdrawal && (
              <label className="capital-field">
                <span>Type *</span>
                <select value={form.type} onChange={update('type')}>
                  <option>Investment</option>
                  <option>Additional Investment</option>
                  {canAddLoan && !editing && <option>{LOAN_TYPE}</option>}
                </select>
              </label>
            )}
            {isLoan ? (
              <>
                <label className="capital-field capital-field-full">
                  <span>Loan Name</span>
                  <input value={form.note} onChange={update('note')} placeholder="Bank EMI, gold loan, hand loan..." />
                </label>

                <div className="capital-field capital-field-full">
                  <span>Repayment *</span>
                  <div className="capital-loan-kind" role="radiogroup" aria-label="Loan repayment type">
                    {[{ value: 'EMI', label: 'EMI', hint: 'Fixed installments' }, { value: 'INTEREST', label: 'Interest', hint: 'Interest only' }].map((kind) => (
                      <button key={kind.value} type="button" role="radio" aria-checked={form.loanKind === kind.value}
                        className={form.loanKind === kind.value ? 'active' : ''} onClick={() => updateLoan({ loanKind: kind.value })}>
                        <strong>{kind.label}</strong><small>{kind.hint}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="capital-field">
                  <span>Commitment Cycle *</span>
                  <select value={form.cycle} onChange={(event) => updateLoan({ cycle: event.target.value })}>
                    {LOAN_CYCLES.map((cycle) => <option key={cycle.value} value={cycle.value}>{cycle.label}</option>)}
                  </select>
                </label>
                <label className="capital-field">
                  <span>First Due Date *</span>
                  <input type="date" value={form.firstDueDate} onChange={update('firstDueDate')} />
                </label>

                {isEmi ? (
                  <>
                    <label className="capital-field">
                      <span>Tenure (installments) *</span>
                      <input type="number" min="1" value={form.tenure} onChange={(event) => updateLoan({ tenure: event.target.value })} placeholder="e.g. 36" />
                    </label>
                    <label className="capital-field">
                      <span>EMI Amount (you pay)</span>
                      <input type="number" min="1" value={form.installmentAmount} placeholder={`₹ per ${cycleUnit}`}
                        onChange={(event) => updateLoan({ installmentAmount: event.target.value, emiDriver: 'emi' })} />
                    </label>
                    <label className="capital-field">
                      <span>Interest (% per year)</span>
                      <div className="capital-input-suffix">
                        <input type="number" min="0" step="0.01" value={form.interestRate} placeholder="or enter the rate"
                          onChange={(event) => updateLoan({ interestRate: event.target.value, emiDriver: 'rate' })} />
                        <Percent size={14} aria-hidden="true" />
                      </div>
                    </label>
                    <div className="capital-calc-note capital-field-full">
                      Enter <strong>either</strong> the EMI <strong>or</strong> the interest rate. The other is calculated.
                      {emiTotals && <> Total repayment <strong>{formatCurrency(emiTotals.total)}</strong>, interest <strong>{formatCurrency(Math.max(0, emiTotals.interest))}</strong>.</>}
                    </div>
                  </>
                ) : (
                  <>
                    <label className="capital-field">
                      <span>Interest (% per {cycleUnit}) *</span>
                      <div className="capital-input-suffix">
                        <input type="number" min="0" step="0.01" value={form.interestRate} onChange={update('interestRate')} placeholder="e.g. 2" />
                        <Percent size={14} aria-hidden="true" />
                      </div>
                    </label>
                    <div className="capital-field">
                      <span>Amount to pay</span>
                      <div className="capital-calc-value">{interestPayable > 0 ? `${formatCurrency(interestPayable)} / ${cycleUnit}` : '—'}</div>
                    </div>
                  </>
                )}

                <div className="capital-loan-hint capital-field-full">
                  Saved under <strong>Expenses → Commitments → Loans</strong>, where each due gets a Pay button.
                  It shows here as a Borrowed Loan and adds to Available Capital.
                </div>
                {loanError && <div className="capital-form-error capital-field-full" role="alert">{loanError}</div>}
              </>
            ) : (
            <>
            <label className="capital-field">
              <span>Payment Mode</span>
              <select value={form.paymentMode} onChange={update('paymentMode')}>
                <option>Bank</option>
                <option>Cash</option>
                <option>UPI</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </label>
            <label className="capital-field">
              <span>Recorded By</span>
              <input value={form.createdBy} onChange={update('createdBy')} placeholder="Person who recorded this entry" />
            </label>
            <label className="capital-field capital-field-full">
              <span>Reference / Note</span>
              <textarea value={form.note} onChange={update('note')} placeholder="Optional reference, bank transaction note or remarks" />
            </label>
            </>
            )}
          </div>

          <div className="capital-modal-actions">
            <ActionButton tone="secondary" type="button" onClick={onClose} disabled={saving}>Cancel</ActionButton>
            {isLoan
              ? <ActionButton type="submit" icon={HandCoins} disabled={saving}>{saving ? 'Saving...' : 'Save Loan'}</ActionButton>
              : <ActionButton type="submit" icon={editing ? Pencil : isWithdrawal ? ArrowUpFromLine : Plus} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : isWithdrawal ? 'Save Withdrawal' : 'Save Capital'}</ActionButton>}
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Capital() {
  const actionLocksRef = useRef(new Set());

  const {
    capital = [],
    capitalMetrics,
    loans = [],
    payments = [],
    company,
    saveCapitalEntry,
    deleteCapitalEntry,
  } = useCrednivo();
  const { hasPermission } = useAuth();
  const { refreshCoreData } = useCrednivo();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalMode, setModalMode] = useState('add');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (searchParams.get('add') === '1' && hasPermission('capital.manage')) {
      setEditing(null);
      setModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...capital]
      .filter((item) => typeFilter === 'All' || item.type === typeFilter)
      .filter((item) => !needle || [item.id, item.investorName, item.paymentMode, item.type, item.note, item.createdBy]
        .some((value) => String(value || '').toLowerCase().includes(needle)))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id)));
  }, [capital, search, typeFilter]);

  const openAdd = () => {
    setEditing(null);
    setModalMode('add');
    setModalOpen(true);
  };

  const openWithdrawal = () => {
    setEditing(null);
    setModalMode('withdrawal');
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setModalMode(item.type === 'Capital Withdrawal' ? 'withdrawal' : 'add');
    setModalOpen(true);
  };

  const save = async (form) => {
    if (actionLocksRef.current.has('save')) return;
    actionLocksRef.current.add('save');
    try {
    if (saving) return;
    try {
      setSaving(true);
      const result = await saveCapitalEntry(form, editing?.id || null);
      if (result) {
        setModalOpen(false);
        setEditing(null);
      }
    } catch (error) {
      window.alert(error?.message || 'Unable to save capital entry');
    } finally {
      setSaving(false);
    }
  
    } finally {
      actionLocksRef.current.delete('save');
    }
  };

  /** "Loan (borrowed)": saved as a Loan commitment, then the capital list and cards reload. Errors go back to the form. */
  const saveLoan = async (payload) => {
    if (actionLocksRef.current.has('loan')) return;
    actionLocksRef.current.add('loan');
    setSaving(true);
    try {
      await createCommitment(payload);
      await refreshCoreData?.();
      setModalOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
      actionLocksRef.current.delete('loan');
    }
  };

  const remove = async (item) => {
    if (actionLocksRef.current.has('remove')) return;
    actionLocksRef.current.add('remove');
    try {
    if (!window.confirm(`Delete ${item.id} - ${item.investorName} ${formatCurrency(item.amount)}?`)) return;
    try {
      await deleteCapitalEntry(item.id);
    } catch (error) {
      window.alert(error?.message || 'Unable to delete capital entry');
    }
  
    } finally {
      actionLocksRef.current.delete('remove');
    }
  };

  // ROI is measured on the same Total Investment the card shows: own investment + borrowed loans.
  const investedTotal = Number(capitalMetrics.totalInvestment || 0) + Number(capitalMetrics.borrowedCapital || 0);
  const actualProfitMetrics = useMemo(() => calculateActualProfit({
    loans,
    payments,
    expensesPaid: capitalMetrics.expensesPaid,
    totalInvestment: investedTotal,
  }), [loans, payments, capitalMetrics.expensesPaid, investedTotal]);

  const grossProfit = actualProfitMetrics.interestEarned + actualProfitMetrics.finesCollected + actualProfitMetrics.documentChargesCollected;
  const borrowedCount = Number(capitalMetrics.borrowedLoans || 0);
  const ownEntries = capital.filter((item) => !isBorrowed(item)).length;
  // Total Investment = your own investment + money borrowed through loans (Commitments → Loans).
  const ownInvestment = Number(capitalMetrics.totalInvestment || 0);
  const borrowedAmount = Number(capitalMetrics.borrowedCapital || 0);
  const metrics = [
    {
      label: 'Total Investment',
      value: formatCurrency(ownInvestment + borrowedAmount),
      note: `${formatCurrency(ownInvestment)} investment, ${borrowedCount} ${borrowedCount === 1 ? 'loan' : 'loans'}, ${formatCurrency(borrowedAmount)} loan amount`,
      showNote: true,
      icon: Landmark,
      tone: 'blue',
    },
    { label: 'Available Capital', value: formatCurrency(capitalMetrics.availableCapital), note: 'Capital + borrowed loans + collections + document charges − loans − expenses − savings', icon: Wallet, tone: capitalMetrics.availableCapital < 0 ? 'red' : 'green' },
    { label: 'Loan Book Outstanding', value: formatCurrency(capitalMetrics.loanBookOutstanding), note: 'Outstanding across active loans', icon: Banknote, tone: 'purple' },
    { label: 'Capital Withdrawn', value: formatCurrency(capitalMetrics.totalWithdrawn), note: 'Partner / investor withdrawals', icon: ArrowUpFromLine, tone: 'orange' },
    {
      // What the lending earned before any expense is taken off.
      label: 'Profit Before Expenses',
      value: formatCurrency(grossProfit),
      note: 'Interest + fines + document charges',
      showNote: true,
      icon: Coins,
      tone: 'green',
    },
    {
      label: 'Actual Profit Earned',
      value: formatCurrency(actualProfitMetrics.actualProfit),
      note: `After ${formatCurrency(actualProfitMetrics.expensesPaid)} expenses, ${actualProfitMetrics.roiPercent.toFixed(2)}% ROI`,
      showNote: true,
      icon: TrendingUp,
      tone: actualProfitMetrics.actualProfit < 0 ? 'red' : 'green',
      className: 'capital-profit-metric',
    },
  ];

  return (
    <div className="module-page capital-page">
      <ModuleHeader
        eyebrow="Capital Management"
        title="Capital"
        description="Track opening investment, partner contributions, withdrawals and the capital currently available for lending."
        actions={
          <div className="page-actions-row">
            <PageBackButton />
            {hasPermission('capital.manage') && (
              <>
                <ActionButton tone="secondary" icon={ArrowUpFromLine} onClick={openWithdrawal}>Withdrawal</ActionButton>
                <ActionButton icon={Plus} onClick={openAdd}>Add Capital</ActionButton>
              </>
            )}
          </div>
        }
      />

      <section className="capital-metrics capital-metrics-six" aria-label="Capital summary">
        {metrics.map(({ label, value, note, showNote, icon, tone }) => (
          <SummaryCard key={label} title={label} value={value} note={showNote ? note : undefined} icon={icon} tone={tone} />
        ))}
      </section>

      <section className="capital-history app-card">
        <div className="capital-history-head">
          <div>
            <h2>Capital History</h2>
            <p>
              {ownEntries} capital entr{ownEntries === 1 ? 'y' : 'ies'}
              {borrowedCount > 0 && `, ${borrowedCount} borrowed ${borrowedCount === 1 ? 'loan' : 'loans'} from Commitments`}
            </p>
          </div>
          <div className="capital-history-tools">
            <label className="capital-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search investor, ID or note..." /></label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Capital type filter">
              <option>All</option>
              <option>Investment</option>
              <option>Additional Investment</option>
              <option>Capital Withdrawal</option>
              <option>Borrowed Loan</option>
            </select>
          </div>
        </div>

        {filtered.length ? (
          <>
            <div className="capital-table-wrap desktop-capital-table">
              <table className="capital-table">
                <thead><tr><th>Date</th><th>Investor / Partner</th><th>Type</th><th>Amount</th><th>Mode</th><th>Recorded By</th><th>Note</th><th>Action</th></tr></thead>
                <tbody>
                  {filtered.map((item) => {
                    const withdrawal = item.type === 'Capital Withdrawal';
                    const borrowed = isBorrowed(item);
                    return (
                      <tr key={item.id}>
                        <td>{formatDate(item.date)}</td>
                        <td><strong>{item.investorName}</strong><small>{item.id}</small></td>
                        <td><span className={`capital-type-chip ${withdrawal ? 'withdrawal' : borrowed ? 'borrowed' : 'investment'}`}>{withdrawal ? <ArrowUpFromLine size={13} /> : borrowed ? <HandCoins size={13} /> : <ArrowDownToLine size={13} />}{item.type}</span></td>
                        <td className={withdrawal ? 'capital-out' : 'capital-in'}>{withdrawal ? '−' : '+'}{formatCurrency(item.amount)}</td>
                        <td>{item.paymentMode}</td>
                        <td>{item.createdBy || '—'}</td>
                        <td className="capital-note-cell">{item.note || '—'}</td>
                        <td>
                          {borrowed
                            ? <Link className="capital-source-link" to={COMMITMENT_LOANS_LINK}>Open in Commitments <ArrowRight size={13} /></Link>
                            : hasPermission('capital.manage') && <div className="capital-row-actions"><IconButton label="Edit capital entry" onClick={() => openEdit(item)}><Pencil size={16} /></IconButton><IconButton label="Delete capital entry" onClick={() => remove(item)}><Trash2 size={16} /></IconButton></div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-capital-list">
              {filtered.map((item) => {
                const withdrawal = item.type === 'Capital Withdrawal';
                const borrowed = isBorrowed(item);
                return (
                  <article className="mobile-capital-card" key={item.id}>
                    <div className="mobile-capital-top">
                      <div><small>{item.id} · {formatDate(item.date)}</small><strong>{item.investorName}</strong></div>
                      <strong className={withdrawal ? 'capital-out' : 'capital-in'}>{withdrawal ? '−' : '+'}{formatCurrency(item.amount)}</strong>
                    </div>
                    <span className={`capital-type-chip ${withdrawal ? 'withdrawal' : borrowed ? 'borrowed' : 'investment'}`}>{withdrawal ? <ArrowUpFromLine size={13} /> : borrowed ? <HandCoins size={13} /> : <ArrowDownToLine size={13} />}{item.type}</span>
                    <div className="mobile-capital-meta"><div><span>Mode</span><strong>{item.paymentMode}</strong></div><div><span>Recorded By</span><strong>{item.createdBy || '—'}</strong></div><div className="wide"><span>Note</span><strong>{item.note || '—'}</strong></div></div>
                    {borrowed && <div className="mobile-capital-actions"><Link className="capital-source-link" to={COMMITMENT_LOANS_LINK}>Open in Commitments <ArrowRight size={13} /></Link></div>}
                    {!borrowed && hasPermission('capital.manage') && <div className="mobile-capital-actions"><ActionButton tone="secondary" icon={Pencil} onClick={() => openEdit(item)}>Edit</ActionButton><ActionButton tone="danger" icon={Trash2} onClick={() => remove(item)}>Delete</ActionButton></div>}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="capital-empty">
            <Landmark size={36} />
            <strong>{capital.length ? 'No capital entries match this filter' : 'Add your opening investment'}</strong>
            <p>{capital.length ? 'Try changing the search or type filter.' : 'Record the money invested into the finance business before issuing loans.'}</p>
            {!capital.length && hasPermission('capital.manage') && <ActionButton icon={Plus} onClick={openAdd}>Add Capital</ActionButton>}
          </div>
        )}
      </section>

      <CapitalModal open={hasPermission('capital.manage') && modalOpen} onClose={() => { if (!saving) { setModalOpen(false); setEditing(null); } }} onSave={save} onSaveLoan={saveLoan} canAddLoan={hasPermission('expenses.add')} company={company} editing={editing} mode={modalMode} saving={saving} />
    </div>
  );
}
