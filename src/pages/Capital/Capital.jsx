import {
  ArrowDownToLine,
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
import { useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Capital.css';

const EMPTY_FORM = {
  investorName: '',
  amount: '',
  date: toInputDate(),
  paymentMode: 'Bank',
  type: 'Investment',
  note: '',
  createdBy: '',
};

function CapitalModal({ open, onClose, onSave, company, editing, saving = false }) {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      investorName: editing.investorName || '',
      amount: editing.amount || '',
      date: editing.date || toInputDate(),
      paymentMode: editing.paymentMode || 'Bank',
      type: editing.type || 'Investment',
      note: editing.note || '',
      createdBy: editing.createdBy || company?.owner || '',
    } : { ...EMPTY_FORM, createdBy: company?.owner || '' });
  }, [open, editing, company?.owner]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.investorName.trim() || Number(form.amount) <= 0) return;
    onSave(form);
  };

  return (
    <div className="capital-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="capital-modal app-card" role="dialog" aria-modal="true" aria-label={editing ? 'Edit capital entry' : 'Add capital'}>
        <div className="capital-modal-head">
          <div className="capital-modal-title">
            <span><Landmark size={20} /></span>
            <div>
              <small>CAPITAL MANAGEMENT</small>
              <h2>{editing ? 'Edit Capital Entry' : 'Add Capital'}</h2>
              <p>Record investment, additional capital or a capital withdrawal.</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}><X size={19} /></IconButton>
        </div>

        <form onSubmit={submit} className="capital-form">
          <div className="capital-form-grid">
            <label className="capital-field">
              <span>Investor / Partner Name *</span>
              <input value={form.investorName} onChange={update('investorName')} placeholder="Enter investor or partner name" autoFocus />
            </label>
            <label className="capital-field">
              <span>Amount *</span>
              <input type="number" min="1" step="1" value={form.amount} onChange={update('amount')} placeholder="Enter amount" />
            </label>
            <label className="capital-field">
              <span>Date *</span>
              <input type="date" value={form.date} onChange={update('date')} />
            </label>
            <label className="capital-field">
              <span>Type *</span>
              <select value={form.type} onChange={update('type')}>
                <option>Investment</option>
                <option>Additional Investment</option>
                <option>Capital Withdrawal</option>
              </select>
            </label>
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
          </div>

          <div className="capital-modal-actions">
            <ActionButton tone="secondary" type="button" onClick={onClose} disabled={saving}>Cancel</ActionButton>
            <ActionButton type="submit" icon={editing ? Pencil : Plus} disabled={saving}>{saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Capital'}</ActionButton>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
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

  const actualProfitMetrics = useMemo(() => {
    let interestEarned = 0;
    let finesCollected = 0;
    let documentChargesCollected = 0;

    loans.forEach((loan) => {
      const loanPayments = payments.filter(
        (payment) => payment.loanId === loan.id
          && payment.type === 'Collection'
          && payment.direction === 'in',
      );

      const collectionCash = loanPayments.reduce(
        (sum, payment) => sum + Number(payment.collectionAmount || 0),
        0,
      );

      const fineCollected = loanPayments.reduce(
        (sum, payment) => sum + Number(payment.fineAmount || 0),
        0,
      );

      const upfrontInterest = loan.interestUpfront
        ? (loan.loanType === 'IO'
            ? Number(loan.interestAmount || 0)
            : Number(loan.totalInterest ?? loan.interestAmount ?? 0))
        : 0;

      let interestFromPayments = 0;

      if (loan.loanType === 'IO') {
        interestFromPayments = loanPayments.reduce(
          (sum, payment) => sum + Number(payment.interestPaid || 0),
          0,
        );
      } else if (!loan.interestUpfront) {
        const totalInterest = Math.max(
          0,
          Number(loan.totalInterest ?? loan.interestAmount ?? 0),
        );
        const plannedRepayment = Math.max(
          0,
          Number(loan.principal || 0) + totalInterest,
        );
        const interestShare = plannedRepayment > 0
          ? totalInterest / plannedRepayment
          : 0;

        interestFromPayments = Math.min(
          totalInterest,
          collectionCash * interestShare,
        );
      }

      interestEarned += upfrontInterest + interestFromPayments;
      finesCollected += fineCollected;
      documentChargesCollected += loan.documentChargeEnabled
        ? Number(loan.documentChargeAmount || 0)
        : 0;
    });

    const expensesPaid = Number(capitalMetrics.expensesPaid || 0);
    const actualProfit = interestEarned + finesCollected + documentChargesCollected - expensesPaid;
    const totalInvestment = Number(capitalMetrics.totalInvestment || 0);
    const roiPercent = totalInvestment > 0
      ? (actualProfit / totalInvestment) * 100
      : 0;

    return {
      interestEarned,
      finesCollected,
      documentChargesCollected,
      expensesPaid,
      actualProfit,
      roiPercent,
    };
  }, [loans, payments, capitalMetrics.expensesPaid, capitalMetrics.totalInvestment]);

  const metrics = [
    { label: 'Total Investment', value: formatCurrency(capitalMetrics.totalInvestment), note: 'Investment + additional investment', icon: Landmark, tone: 'blue' },
    { label: 'Available Capital', value: formatCurrency(capitalMetrics.availableCapital), note: 'Capital + collections + document charges − loans − expenses − savings', icon: Wallet, tone: capitalMetrics.availableCapital < 0 ? 'red' : 'green' },
    { label: 'Loan Book Outstanding', value: formatCurrency(capitalMetrics.loanBookOutstanding), note: 'Outstanding across active loans', icon: Banknote, tone: 'purple' },
    { label: 'Capital Withdrawn', value: formatCurrency(capitalMetrics.totalWithdrawn), note: 'Partner / investor withdrawals', icon: ArrowUpFromLine, tone: 'orange' },
    {
      label: 'Actual Profit Earned',
      value: formatCurrency(actualProfitMetrics.actualProfit),
      note: `Interest + fines + document charges − expenses · ${actualProfitMetrics.roiPercent.toFixed(2)}% ROI`,
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
        actions={hasPermission('capital.manage') ? <ActionButton icon={Plus} onClick={openAdd}>Add Capital</ActionButton> : null}
      />

      <section className="capital-metrics" aria-label="Capital summary">
        {metrics.map(({ label, value, note, icon: Icon, tone, className = '' }) => (
          <article key={label} className={`capital-metric app-card capital-tone-${tone} ${className}`.trim()}>
            <span className="capital-metric-icon"><Icon size={22} /></span>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="capital-position app-card">
        <div className="capital-position-head">
          <div>
            <span className="module-eyebrow">BUSINESS CASH POSITION</span>
            <h2>How Available Capital Is Calculated</h2>
          </div>
          {capital.length === 0 && hasPermission('capital.manage') && <button onClick={openAdd}>Add your opening investment <ArrowDownToLine size={15} /></button>}
        </div>
        <div className="capital-position-grid">
          <div><span>Net Capital</span><strong>{formatCurrency(capitalMetrics.netCapital)}</strong><small>Investment − withdrawals</small></div>
          <b>+</b>
          <div><span>Collections + Charges</span><strong>{formatCurrency(capitalMetrics.collectionsReceived)}</strong><small>Customer collections + fines + document charges</small></div>
          <b>−</b>
          <div><span>Loans Disbursed</span><strong>{formatCurrency(capitalMetrics.loanDisbursed)}</strong><small>Actual amounts given to customers</small></div>
          <b>−</b>
          <div><span>Expenses</span><strong>{formatCurrency(capitalMetrics.expensesPaid)}</strong><small>Recorded business expenses</small></div>
          <b>−</b>
          <div><span>Savings</span><strong>{formatCurrency(capitalMetrics.savingsTotal || 0)}</strong><small>Owner reserve · not an expense</small></div>
          <b>=</b>
          <div className="capital-position-result"><span>Available Capital</span><strong>{formatCurrency(capitalMetrics.availableCapital)}</strong><small>Current calculated business cash after Savings</small></div>
        </div>
      </section>

      <section className="capital-history app-card">
        <div className="capital-history-head">
          <div>
            <h2>Capital History</h2>
            <p>{capital.length} recorded capital entr{capital.length === 1 ? 'y' : 'ies'}</p>
          </div>
          <div className="capital-history-tools">
            <label className="capital-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search investor, ID or note..." /></label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Capital type filter">
              <option>All</option>
              <option>Investment</option>
              <option>Additional Investment</option>
              <option>Capital Withdrawal</option>
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
                    return (
                      <tr key={item.id}>
                        <td>{formatDate(item.date)}</td>
                        <td><strong>{item.investorName}</strong><small>{item.id}</small></td>
                        <td><span className={`capital-type-chip ${withdrawal ? 'withdrawal' : 'investment'}`}>{withdrawal ? <ArrowUpFromLine size={13} /> : <ArrowDownToLine size={13} />}{item.type}</span></td>
                        <td className={withdrawal ? 'capital-out' : 'capital-in'}>{withdrawal ? '−' : '+'}{formatCurrency(item.amount)}</td>
                        <td>{item.paymentMode}</td>
                        <td>{item.createdBy || '—'}</td>
                        <td className="capital-note-cell">{item.note || '—'}</td>
                        <td>{hasPermission('capital.manage') && <div className="capital-row-actions"><IconButton label="Edit capital entry" onClick={() => openEdit(item)}><Pencil size={16} /></IconButton><IconButton label="Delete capital entry" onClick={() => remove(item)}><Trash2 size={16} /></IconButton></div>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-capital-list">
              {filtered.map((item) => {
                const withdrawal = item.type === 'Capital Withdrawal';
                return (
                  <article className="mobile-capital-card" key={item.id}>
                    <div className="mobile-capital-top">
                      <div><small>{item.id} · {formatDate(item.date)}</small><strong>{item.investorName}</strong></div>
                      <strong className={withdrawal ? 'capital-out' : 'capital-in'}>{withdrawal ? '−' : '+'}{formatCurrency(item.amount)}</strong>
                    </div>
                    <span className={`capital-type-chip ${withdrawal ? 'withdrawal' : 'investment'}`}>{withdrawal ? <ArrowUpFromLine size={13} /> : <ArrowDownToLine size={13} />}{item.type}</span>
                    <div className="mobile-capital-meta"><div><span>Mode</span><strong>{item.paymentMode}</strong></div><div><span>Recorded By</span><strong>{item.createdBy || '—'}</strong></div><div className="wide"><span>Note</span><strong>{item.note || '—'}</strong></div></div>
                    {hasPermission('capital.manage') && <div className="mobile-capital-actions"><ActionButton tone="secondary" icon={Pencil} onClick={() => openEdit(item)}>Edit</ActionButton><ActionButton tone="danger" icon={Trash2} onClick={() => remove(item)}>Delete</ActionButton></div>}
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

      <CapitalModal open={hasPermission('capital.manage') && modalOpen} onClose={() => { if (!saving) { setModalOpen(false); setEditing(null); } }} onSave={save} company={company} editing={editing} saving={saving} />
    </div>
  );
}
