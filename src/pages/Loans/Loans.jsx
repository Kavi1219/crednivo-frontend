import { CalendarDays, ChevronDown, HandCoins, MoreHorizontal, Plus, Search, SlidersHorizontal, WalletCards, Users, CheckCircle2, IndianRupee } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import SummaryCard from '../../components/common/SummaryCard';
import { PageBackButton } from '../../components/GlobalBackButton';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, toInputDate } from '../../utils/finance';
import { getRiskTier } from '../../utils/collectionTargets';
import './Loans.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';

const RISK_META = {
  'Very Good': { dot: 'green' },
  Good: { dot: 'green' },
  Normal: { dot: 'orange' },
  Risky: { dot: 'red' },
};

export default function Loans() {
  const { customers, loans, collections } = useCrednivo();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const initialStatus = ['All', 'Active', 'Closed'].includes(requestedStatus) ? requestedStatus : 'All';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [cycleFilter, setCycleFilter] = useState('All');
  const [riskFilter, setRiskFilter] = useState('All');
  const today = toInputDate();

  const customerPhotoById = useMemo(
    () => Object.fromEntries((customers || []).map((c) => [String(c.id), c.photo || ''])),
    [customers],
  );
  const customerMobileById = useMemo(
    () => Object.fromEntries((customers || []).map((c) => [String(c.id), c.mobile || ''])),
    [customers],
  );

  // Risk tier per LOAN (not per customer) — how many of THIS loan's own
  // installments are currently unpaid and due.
  const loanRiskTier = useMemo(() => {
    const counts = new Map();
    (collections || []).forEach((item) => {
      if (String(item.status || '').toLowerCase() === 'cancelled') return;
      const dueDate = String(item.date || '').slice(0, 10);
      if (!dueDate || dueDate > today) return;
      const balance = Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0));
      if (balance <= 0) return;
      const key = String(item.loanId || '');
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const tiers = new Map();
    (loans || []).forEach((loan) => tiers.set(loan.id, getRiskTier(counts.get(String(loan.id)) || 0)));
    return tiers;
  }, [collections, loans, today]);

  const statusLoans = useMemo(() => loans.filter((loan) => {
    if (status === 'Active' && loan.status === 'Closed') return false;
    if (status === 'Closed' && loan.status !== 'Closed') return false;
    if (cycleFilter !== 'All' && loan.cycle !== cycleFilter) return false;
    if (riskFilter !== 'All' && loanRiskTier.get(loan.id) !== riskFilter) return false;
    return true;
  }), [loans, status, cycleFilter, riskFilter, loanRiskTier]);

  const filtered = useMemo(() => statusLoans.filter((loan) => {
    const q = search.toLowerCase().trim();
    const mobile = customerMobileById[String(loan.customerId)] || '';
    return !q || `${loan.id} ${loan.customerId} ${loan.customerName} ${mobile}`.toLowerCase().includes(q);
  }), [statusLoans, search, customerMobileById]);

  // Real month-over-month trend — loans as they stood at the end of last
  // month vs. right now. Not fabricated: computed straight from startDate.
  const trendOf = (predicate) => {
    const now = predicate(loans);
    const asOfLastMonth = new Date();
    asOfLastMonth.setDate(1);
    asOfLastMonth.setDate(0); // last day of previous month
    const cutoff = toInputDate(asOfLastMonth);
    const then = predicate(loans.filter((l) => String(l.startDate || '').slice(0, 10) <= cutoff));
    if (then <= 0) return null;
    return Math.round(((now - then) / then) * 100);
  };

  const totalLoans = loans.length;
  const activeLoans = loans.filter((l) => l.status !== 'Closed').length;
  const closedLoans = loans.filter((l) => l.status === 'Closed').length;
  const totalDisbursed = loans.reduce((sum, l) => sum + Number(l.disbursedAmount ?? l.principal ?? 0), 0);

  const totalTrend = trendOf((list) => list.length);
  const activeTrend = trendOf((list) => list.filter((l) => l.status !== 'Closed').length);
  const closedTrend = trendOf((list) => list.filter((l) => l.status === 'Closed').length);
  const disbursedTrend = trendOf((list) => list.reduce((sum, l) => sum + Number(l.disbursedAmount ?? l.principal ?? 0), 0));

  return <div className="module-page loans-page">
    <ModuleHeader actions={
      <div className="page-actions-row">
        <PageBackButton />
        {hasPermission('loans.create') && <ActionButton icon={Plus} onClick={()=>navigate('/loans/create')}>Create Loan</ActionButton>}
      </div>
    } />

    <section className="stats-section loan-summary-stats">
      <div className="loan-summary-grid">
        <SummaryCard title="Total Loans" value={String(totalLoans)} note="All loans created" icon={WalletCards} tone="blue" trend={totalTrend} />
        <SummaryCard title="Active Loans" value={String(activeLoans)} note="Currently running" icon={Users} tone="green" trend={activeTrend} />
        <SummaryCard title="Closed Loans" value={String(closedLoans)} note="Fully repaid or closed" icon={CheckCircle2} tone="orange" trend={closedTrend} />
        <SummaryCard title="Total Disbursed" value={formatCurrency(totalDisbursed)} note="Amount given out" icon={IndianRupee} tone="purple" trend={disbursedTrend} />
      </div>
    </section>

    <section className="module-card">
      <div className="loan-filter-row">
        <label className="module-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customer name or mobile..."/></label>
        <div className="loan-select-wrap">
          <select value={cycleFilter} onChange={(e) => setCycleFilter(e.target.value)}>
            <option value="All">All Cycle</option>
            <option value="Daily">Daily</option>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
          <ChevronDown size={14} />
        </div>
        <div className="loan-select-wrap">
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Very Good">Very Good</option>
            <option value="Good">Good</option>
            <option value="Normal">Normal</option>
            <option value="Risky">Risky</option>
          </select>
          <ChevronDown size={14} />
        </div>
        <button type="button" className="loan-filter-icon-btn" title="More filters"><SlidersHorizontal size={16} /></button>
      </div>

      <div className="module-table-wrap desktop-data-table">
        <table className="module-table loan-status-table">
          <thead><tr><th>Customer</th><th>Phone Number</th><th>Cycle</th><th>Loan Amount</th><th>Outstanding</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{filtered.map(loan => {
            const tier = loanRiskTier.get(loan.id) || 'Very Good';
            return (
              <tr key={loan.id}>
                <td>
                  <div className="loan-customer-identity">
                    <CustomerAvatar className="loan-customer-avatar" photo={customerPhotoById[String(loan.customerId)]} name={loan.customerName}/>
                    <div><CustomerProfileLink customerId={loan.customerId}>{loan.customerName}</CustomerProfileLink><small className="table-sub">{loan.id}</small></div>
                  </div>
                </td>
                <td>{customerMobileById[String(loan.customerId)] || '—'}</td>
                <td><span className="soft-chip blue">{loan.cycle}</span></td>
                <td>{formatCurrency(loan.principal)}</td>
                <td><strong>{formatCurrency(loan.outstanding)}</strong></td>
                <td><span className="loan-status-cell"><span className={`loan-status-dot ${RISK_META[tier].dot}`} />{tier}</span></td>
                <td>
                  <div className="loan-row-actions loan-icon-actions">
                    <button
                      type="button"
                      className="loan-icon-action schedule"
                      onClick={() => navigate(`/collection?view=all&q=${encodeURIComponent(loan.customerId)}&focus=search`)}
                      aria-label={`View schedule for ${loan.customerName}`}
                      title="View schedule"
                    >
                      <CalendarDays size={16} />
                    </button>
                    <button
                      type="button"
                      className="loan-icon-action collect"
                      onClick={() => loan.status !== 'Closed' && navigate(`/collection?q=${encodeURIComponent(loan.customerId)}&focus=search`)}
                      disabled={loan.status === 'Closed'}
                      aria-label={loan.status === 'Closed' ? `${loan.customerName} loan closed` : `Collect from ${loan.customerName}`}
                      title={loan.status === 'Closed' ? 'Loan closed' : `Collect from ${loan.customerName}`}
                    >
                      <HandCoins size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      <div className="mobile-data-list">{filtered.map(loan=>{
        const tier = loanRiskTier.get(loan.id) || 'Very Good';
        return (
          <article className="mobile-data-card" key={loan.id}>
            <div className="mobile-data-top">
              <div className="loan-customer-identity"><CustomerAvatar className="loan-customer-avatar" photo={customerPhotoById[String(loan.customerId)]} name={loan.customerName}/><div><strong><CustomerProfileLink customerId={loan.customerId}>{loan.customerName}</CustomerProfileLink></strong><small className="table-sub">{loan.id}</small></div></div>
              <IconButton size="sm" label="View customer" onClick={()=>navigate(`/customers/${loan.customerId}`)}><MoreHorizontal size={16}/></IconButton>
            </div>
            <div className="mobile-data-meta">
              <div><span>Phone</span><strong>{customerMobileById[String(loan.customerId)] || '—'}</strong></div>
              <div><span>Cycle</span><strong>{loan.cycle}</strong></div>
              <div><span>Loan Amount</span><strong>{formatCurrency(loan.principal)}</strong></div>
              <div><span>Outstanding</span><strong>{formatCurrency(loan.outstanding)}</strong></div>
              <div><span>Status</span><strong className="loan-status-cell"><span className={`loan-status-dot ${RISK_META[tier].dot}`} />{tier}</strong></div>
            </div>
            <button type="button" className="loan-collect-btn loan-collect-btn-mobile" onClick={() => navigate(`/collection?q=${encodeURIComponent(loan.customerId)}&focus=search`)}>Collect</button>
          </article>
        );
      })}</div>
    </section>
  </div>;
}
