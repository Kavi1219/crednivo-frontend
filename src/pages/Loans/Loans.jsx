import { CalendarClock, ChevronDown, MoreHorizontal, Plus, Search, SlidersHorizontal, WalletCards, Users, CheckCircle2, IndianRupee } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
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
    <ModuleHeader eyebrow="Loan Management" title="Loans" description="Track every loan, its cycle, repayment plan, balance and current status." actions={hasPermission('loans.create') ? <ActionButton icon={Plus} onClick={()=>navigate('/loans/create')}>Create Loan</ActionButton> : null} />

    <div className="loan-stat-grid">
      <article className="loan-stat-card">
        <span className="loan-stat-icon blue"><WalletCards size={20} /></span>
        <div className="loan-stat-copy">
          <span>Total Loans</span>
          <strong>{totalLoans}</strong>
          {totalTrend !== null && <em className={totalTrend >= 0 ? 'up' : 'down'}>{totalTrend >= 0 ? '↗' : '↘'} {Math.abs(totalTrend)}%</em>}
        </div>
      </article>
      <article className="loan-stat-card">
        <span className="loan-stat-icon green"><Users size={20} /></span>
        <div className="loan-stat-copy">
          <span>Active Loans</span>
          <strong>{activeLoans}</strong>
          {activeTrend !== null && <em className={activeTrend >= 0 ? 'up' : 'down'}>{activeTrend >= 0 ? '↗' : '↘'} {Math.abs(activeTrend)}%</em>}
        </div>
      </article>
      <article className="loan-stat-card">
        <span className="loan-stat-icon orange"><CheckCircle2 size={20} /></span>
        <div className="loan-stat-copy">
          <span>Closed Loans</span>
          <strong>{closedLoans}</strong>
          {closedTrend !== null && <em className={closedTrend >= 0 ? 'up' : 'down'}>{closedTrend >= 0 ? '↗' : '↘'} {Math.abs(closedTrend)}%</em>}
        </div>
      </article>
      <article className="loan-stat-card">
        <span className="loan-stat-icon purple"><IndianRupee size={20} /></span>
        <div className="loan-stat-copy">
          <span>Total Disbursed</span>
          <strong>{formatCurrency(totalDisbursed)}</strong>
          {disbursedTrend !== null && <em className={disbursedTrend >= 0 ? 'up' : 'down'}>{disbursedTrend >= 0 ? '↗' : '↘'} {Math.abs(disbursedTrend)}%</em>}
        </div>
      </article>
    </div>

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
        {hasPermission('loans.create') && <ActionButton icon={Plus} onClick={()=>navigate('/loans/create')}>Create Loan</ActionButton>}
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
                  <div className="loan-row-actions">
                    <button type="button" className="loan-collect-btn" onClick={() => navigate(`/collection?q=${encodeURIComponent(loan.customerId)}&focus=search`)}>Collect</button>
                    <IconButton size="sm" label="View schedule" onClick={() => navigate(`/collection?q=${encodeURIComponent(loan.customerId)}&focus=search`)}><CalendarClock size={16}/></IconButton>
                    <IconButton size="sm" label={`View ${loan.customerName}`} onClick={()=>navigate(`/customers/${loan.customerId}`)}><MoreHorizontal size={16}/></IconButton>
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
