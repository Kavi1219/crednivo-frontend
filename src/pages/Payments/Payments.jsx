import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  HandCoins,
  Landmark,
  PiggyBank,
  ReceiptText,
  RotateCcw,
  Search,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DownloadMenu from '../../components/common/DownloadMenu';
import { useAuth } from '../../context/AuthContext';
import { exportHistoryPdf, exportHistoryXlsx } from '../../utils/historyExport';
import SummaryCard from '../../components/common/SummaryCard';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Payments.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';

export default function Payments() {
  const { customers, payments, savings, capital, company } = useCrednivo();
  const { user } = useAuth();
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
  const datesActive = Boolean(fromDate || toDate);

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

  const detailsOf = (item) => (item.loanType === 'IO' && item.type === 'Collection'
    ? `Interest ${formatCurrency(item.interestPaid)} · Principal ${formatCurrency(item.principalPaid)}${Number(item.fineAmount) > 0 ? ` · Fine ${formatCurrency(item.fineAmount)}` : ''}`
    : item.note);

  const exportArgs = () => ({
    company,
    generatedBy: user?.displayName || company?.owner || 'Admin',
    fromDate,
    toDate,
    filter,
    rows: filtered,
    totals: { incoming, outgoing },
    details: detailsOf,
  });

  return (
    <div className="module-page payments-page">
      <section className="stats-section history-summary-section">
        <div className="stats-grid history-summary-grid">
          <SummaryCard title="Total Incoming" value={formatCurrency(incoming)} note="Collections received" icon={ArrowDownLeft} tone="green" />
          <SummaryCard title="Total Outgoing" value={formatCurrency(outgoing)} note="Loans & expenses paid" icon={ArrowUpRight} tone="red" />
          <SummaryCard title="Net Cash Flow" value={formatCurrency(incoming - outgoing)} note="Incoming minus outgoing" icon={WalletCards} tone="blue" />
          <SummaryCard title="Transactions" value={String(dateFiltered.length)} note="In current date range" icon={HandCoins} tone="purple" />
        </div>
      </section>

      <section className="module-card payment-history-card">
        <div className="payment-history-head">
          <div className="payment-history-brand">
            <div>
              <h2>History</h2>
            </div>
          </div>
          <div className="payment-export-actions">
            <div className={`history-date-range ${datesActive ? 'active' : ''}`} role="group" aria-label="Date range">
              <CalendarDays size={15} />
              <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} aria-label="From date" />
              <span className="history-date-sep">to</span>
              <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} aria-label="To date" />
            </div>
            <button type="button" className="history-date-chip" onClick={showToday}>Today</button>
            {datesActive && (
              <button type="button" className="history-date-clear" onClick={resetDates} aria-label="Clear dates" title="Clear dates">
                <RotateCcw size={15} />
              </button>
            )}
            <DownloadMenu
              onPdf={() => exportHistoryPdf(exportArgs())}
              onXlsx={() => exportHistoryXlsx(exportArgs())}
              xlsxNote="Excel history report"
            />
          </div>
        </div>

        <div className="module-toolbar history-filter-row">
          <label className="module-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history..." />
          </label>
          <div className="history-quick-select">
            <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Transaction type">
              <option value="All">All Transactions</option>
              {['Collection', 'Document Charge', 'New Loan', 'Expense', 'Capital', 'Savings'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <ChevronDown size={14} />
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
                  <td>{detailsOf(item)}</td>
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
