import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  HandCoins,
  Landmark,
  PiggyBank,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import StatCard from '../../components/dashboard/StatCard';
import ModuleHeader from '../../components/common/ModuleHeader';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { downloadCsv, formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Payments.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';

export default function Payments() {
  const { customers, payments, savings, capital } = useCrednivo();
  const [searchParams] = useSearchParams();
  const requestedFilter = searchParams.get('filter');
  const todayRequested = searchParams.get('today') === '1';
  const initialFilter = ['All', 'Collection', 'Document Charge', 'New Loan', 'Expense', 'Capital', 'Savings'].includes(requestedFilter)
    ? requestedFilter
    : 'All';
  const initialDate = todayRequested ? toInputDate() : '';

  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(initialDate);
  const [toDate, setToDate] = useState(initialDate);

  const customerPhotoById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.photo || ''])),
    [customers],
  );

  // Capital and Savings don't come from the payments ledger at all, so they
  // were previously invisible here. Normalized into the same shape so they
  // sort, filter and export alongside every other transaction.
  const capitalTransactions = useMemo(() => (capital || []).map((item) => ({
    id: `capital-${item.id}`,
    date: item.date,
    type: 'Capital',
    customerName: item.investorName || 'Capital',
    customerId: '—',
    loanId: '',
    paymentMode: item.paymentMode || '',
    note: item.note || item.type || '',
    direction: item.type === 'Capital Withdrawal' ? 'out' : 'in',
    amount: Number(item.amount) || 0,
  })), [capital]);

  const savingsTransactions = useMemo(() => (savings || []).map((item) => ({
    id: `saving-${item.id}`,
    date: item.date,
    type: 'Savings',
    customerName: 'Savings',
    customerId: '—',
    loanId: '',
    paymentMode: '',
    note: item.note || '',
    direction: 'out',
    amount: Number(item.amount) || 0,
  })), [savings]);

  const allTransactions = useMemo(
    () => [...payments, ...capitalTransactions, ...savingsTransactions],
    [payments, capitalTransactions, savingsTransactions],
  );

  const dateFiltered = useMemo(() => allTransactions.filter((item) => {
    if (fromDate && item.date < fromDate) return false;
    if (toDate && item.date > toDate) return false;
    return true;
  }), [allTransactions, fromDate, toDate]);

  // Search and type filters only change the history list. They do not change
  // the cash-flow cards above. Date range intentionally controls both.
  const filtered = useMemo(() => dateFiltered.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesType = filter === 'All' || item.type === filter;
    const matchesSearch = !q || `${item.customerName} ${item.customerId} ${item.loanId || ''} ${item.note} ${item.type} ${item.paymentMode || ''}`.toLowerCase().includes(q);
    return matchesType && matchesSearch;
  }), [dateFiltered, filter, search]);

  const incoming = dateFiltered.filter((item) => item.direction === 'in').reduce((sum, item) => sum + item.amount, 0);
  const outgoing = dateFiltered.filter((item) => item.direction === 'out').reduce((sum, item) => sum + item.amount, 0);

  const resetDates = () => {
    setFromDate('');
    setToDate('');
  };

  const showToday = () => {
    const today = toInputDate();
    setFromDate(today);
    setToDate(today);
  };

  const download = () => downloadCsv(
    `crednivo-history-${fromDate || 'start'}-to-${toDate || 'latest'}.csv`,
    [
      ['Date', 'Transaction', 'Customer / Purpose', 'Reference', 'Loan', 'Mode', 'Interest', 'Principal', 'Fine', 'Note', 'Direction', 'Amount'],
      ...filtered.map((item) => [
        item.date,
        item.type,
        item.customerName,
        item.customerId,
        item.loanId || '',
        item.paymentMode || '',
        item.interestPaid || 0,
        item.principalPaid || 0,
        item.fineAmount || 0,
        item.note,
        item.direction === 'in' ? 'Incoming' : 'Outgoing',
        item.amount,
      ]),
    ],
  );

  return (
    <div className="module-page payments-page">
      <ModuleHeader
        eyebrow="Cash Flow"
        title="History"
        description="A single transaction history for collections, loans, expenses, capital and savings."
      />

      <section className="stats-section">
        <div className="stats-grid">
          <StatCard title="Total Incoming" value={formatCurrency(incoming)} note="" icon={ArrowDownLeft} tone="green" showProgress={false} />
          <StatCard title="Total Outgoing" value={formatCurrency(outgoing)} note="" icon={ArrowUpRight} tone="danger" showProgress={false} />
          <StatCard title="Net Cash Flow" value={formatCurrency(incoming - outgoing)} note="" icon={WalletCards} tone="blue" showProgress={false} />
          <StatCard title="Transactions" value={String(dateFiltered.length)} note="" icon={HandCoins} tone="purple" showProgress={false} />
        </div>
      </section>

      <section className="module-card payment-history-card">
        <div className="payment-history-head">
          <div className="payment-history-brand">
            <div>
              <h2>History</h2>
              <span>Choose a date range, then print or download the matching history.</span>
            </div>
          </div>
          <div className="payment-export-actions">
            <ActionButton tone="secondary" icon={Printer} onClick={() => window.print()}>Print / PDF</ActionButton>
            <ActionButton icon={Download} onClick={download}>Download CSV</ActionButton>
          </div>
        </div>

        <div className="payment-date-toolbar">
          <div className="payment-date-field">
            <CalendarDays size={16} />
            <label>
              <span>From Date</span>
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
          </div>
          <div className="payment-date-field">
            <CalendarDays size={16} />
            <label>
              <span>To Date</span>
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>
          <div className="payment-date-quick-actions">
            <ActionButton tone="secondary" icon={CalendarDays} onClick={showToday}>Today</ActionButton>
            <ActionButton tone="secondary" icon={RotateCcw} onClick={resetDates}>Clear Dates</ActionButton>
          </div>
        </div>

        <div className="module-toolbar payment-list-toolbar">
          <label className="module-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history..." />
          </label>
          <div className="module-toolbar-group">
            {['All', 'Collection', 'Document Charge', 'New Loan', 'Expense', 'Capital', 'Savings'].map((item) => (
              <button key={item} className={`filter-chip ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
        </div>

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table">
            <thead><tr><th>Date</th><th>Transaction</th><th>Customer / Purpose</th><th>Reference</th><th>Mode</th><th>Details</th><th>Amount</th></tr></thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td>
                    <div className="payment-type-cell">
                      <span className={`payment-type-icon ${item.type === 'Collection' ? 'green' : item.type === 'Expense' ? 'orange' : item.type === 'Savings' ? 'purple' : 'blue'}`}>
                        {item.type === 'Collection' ? <HandCoins size={16} /> : item.type === 'Expense' ? <ReceiptText size={16} /> : item.type === 'Savings' ? <PiggyBank size={16} /> : <Landmark size={16} />}
                      </span>
                      <span>{item.type}</span>
                    </div>
                  </td>
                  <td><div className="payment-customer-identity"><CustomerAvatar className="payment-customer-avatar" photo={customerPhotoById[String(item.customerId)]} name={item.customerName}/><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></div></td>
                  <td>{item.loanId || item.customerId}</td>
                  <td>{item.paymentMode || '—'}</td>
                  <td>{item.loanType === 'IO' && item.type === 'Collection' ? `Interest ${formatCurrency(item.interestPaid)} · Principal ${formatCurrency(item.principalPaid)}${Number(item.fineAmount) > 0 ? ` · Fine ${formatCurrency(item.fineAmount)}` : ''}` : item.note}</td>
                  <td className={item.direction === 'in' ? 'money-in' : 'money-out'}>{item.direction === 'in' ? '+' : '−'} {formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-data-list">
          {filtered.map((item) => (
            <article className="mobile-data-card" key={item.id}>
              <div className="mobile-data-top">
                <div className="payment-customer-identity"><CustomerAvatar className="payment-customer-avatar" photo={customerPhotoById[String(item.customerId)]} name={item.customerName}/><div><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong><small className="table-sub">{formatDate(item.date)} · {item.type}</small></div></div>
                <strong className={item.direction === 'in' ? 'money-in' : 'money-out'}>{item.direction === 'in' ? '+' : '−'} {formatCurrency(item.amount)}</strong>
              </div>
              <div className="mobile-data-meta">
                <div><span>Reference</span><strong>{item.loanId || item.customerId}</strong></div>
                <div><span>Mode</span><strong>{item.paymentMode || '—'}</strong></div>
                <div><span>Details</span><strong>{item.loanType === 'IO' && item.type === 'Collection' ? `Interest ${formatCurrency(item.interestPaid)} · Principal ${formatCurrency(item.principalPaid)}` : item.note}</strong></div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
