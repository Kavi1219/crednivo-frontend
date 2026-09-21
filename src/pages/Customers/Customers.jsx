import { Eye, Search, UserPlus, UsersRound, WalletCards, CalendarDays, BadgeIndianRupee } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import StatCard from '../../components/dashboard/StatCard';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatIndianMobile, normalizeIndianMobile } from '../../utils/finance';
import './Customers.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';

function routeCycle(pathname) {
  if (pathname.includes('/daily')) return 'Daily';
  if (pathname.includes('/weekly')) return 'Weekly';
  if (pathname.includes('/monthly')) return 'Monthly';
  return 'All';
}

export default function Customers() {
  const { customers, loans } = useCrednivo();
  const { hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const cycle = routeCycle(location.pathname);

  const customerSummaries = useMemo(() => Object.fromEntries(customers.map((customer) => {
    const activeLoans = loans.filter((loan) => loan.customerId === customer.id && loan.status !== 'Closed' && Number(loan.outstanding) > 0);
    const totalOutstanding = activeLoans.reduce((sum, loan) => sum + (Number(loan.outstanding) || 0), 0);
    const collectionByCycle = activeLoans.reduce((summary, loan) => {
      const loanCycle = loan.cycle || 'Other';
      summary[loanCycle] = (summary[loanCycle] || 0) + (Number(loan.collectionAmount) || 0);
      return summary;
    }, {});
    const cycles = Object.keys(collectionByCycle);
    const nextDueDate = activeLoans.map((loan) => loan.nextDueDate).filter(Boolean).sort()[0] || customer.nextDueDate;
    const status = activeLoans.some((loan) => loan.status === 'Overdue') ? 'Overdue' : activeLoans.length ? 'Active' : customer.status;
    return [customer.id, { activeLoans, totalOutstanding, collectionByCycle, cycles, nextDueDate, status }];
  })), [customers, loans]);

  const cycleCustomers = useMemo(() => customers.filter((customer) => {
    if (cycle === 'All') return true;
    return customerSummaries[customer.id]?.cycles.includes(cycle);
  }), [customers, cycle, customerSummaries]);

  const filtered = useMemo(() => cycleCustomers.filter((customer) => {
    const q = search.trim().toLowerCase();
    const phoneQuery = normalizeIndianMobile(search);
    const textMatch = !q || `${customer.id} ${customer.name} ${customer.mobile} ${customer.area}`.toLowerCase().includes(q);
    const phoneMatch = phoneQuery.length >= 3 && normalizeIndianMobile(customer.mobile).includes(phoneQuery);
    return textMatch || phoneMatch;
  }), [cycleCustomers, search]);

  // Search only filters the customer list. The summary stays fixed for the
  // selected cycle so searching one customer never changes the top cards.
  const outstanding = cycleCustomers.reduce((sum, item) => sum + (customerSummaries[item.id]?.totalOutstanding || 0), 0);
  const active = cycleCustomers.filter((item) => (customerSummaries[item.id]?.activeLoans.length || 0) > 0).length;

  const cycleUnit = (loanCycle) => loanCycle === 'Daily' ? 'day' : loanCycle === 'Weekly' ? 'week' : loanCycle === 'Monthly' ? 'month' : loanCycle.toLowerCase();

  const collectionText = (customer) => {
    const summary = customerSummaries[customer.id];
    if (!summary) return '—';
    const parts = Object.entries(summary.collectionByCycle);
    if (!parts.length) return '—';
    return parts.map(([loanCycle, amount]) => `${formatCurrency(amount)}/${cycleUnit(loanCycle)}`).join(' + ');
  };

  return (
    <div className="module-page customers-page">
      <ModuleHeader
        eyebrow="Customer Management"
        title={cycle === 'All' ? 'Customers' : `${cycle} Customers`}
        description="View customer profiles, active loan cycles, outstanding balances and upcoming collections."
        actions={hasPermission('customers.add') ? <ActionButton icon={UserPlus} onClick={() => navigate('/customers/new')}>New Customer</ActionButton> : null}
      />

      <section className="stats-section">
        <div className="stats-grid">
          <StatCard title="Total Customers" value={String(cycleCustomers.length)} note="All registered customers" icon={UsersRound} tone="blue" showProgress={false} />
          <StatCard title="Active Customers" value={String(active)} note="Currently active" icon={WalletCards} tone="green" showProgress={false} />
          <StatCard title="Outstanding" value={formatCurrency(outstanding)} note="Total pending amount" icon={BadgeIndianRupee} tone="orange" showProgress={false} />
          <StatCard title="Cycle" value={cycle} note="Selected filter" icon={CalendarDays} tone="purple" showProgress={false} />
        </div>
      </section>

      <section className="module-card">
        <div className="module-toolbar">
          <label className="module-search"><Search size={16}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, ID, mobile or area..." /></label>
          <div className="module-toolbar-group">
            {['All', 'Daily', 'Weekly', 'Monthly'].map((item) => (
              <button key={item} className={`filter-chip ${cycle === item ? 'active' : ''}`} onClick={() => navigate(item === 'All' ? '/customers' : `/customers/${item.toLowerCase()}`)}>{item}</button>
            ))}
          </div>
        </div>

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table">
            <thead><tr><th>Customer</th><th>Cycle</th><th>Active Loan</th><th>Collection</th><th>Outstanding</th><th>Next Due</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{filtered.map((customer) => (
              <tr key={customer.id}>
                <td><div className="row-title"><CustomerAvatar className="row-avatar" photo={customer.photo} name={customer.name} /><div><strong><CustomerProfileLink customerId={customer.id}>{customer.name}</CustomerProfileLink></strong><small>{customer.id} · {formatIndianMobile(customer.mobile)}</small></div></div></td>
                <td><span className="soft-chip blue">{customerSummaries[customer.id]?.cycles.join(' + ') || customer.cycle || '—'}</span></td>
                <td>{customerSummaries[customer.id]?.activeLoans.length || 0} active</td>
                <td>{collectionText(customer)}</td>
                <td><strong>{formatCurrency(customerSummaries[customer.id]?.totalOutstanding || 0)}</strong></td>
                <td>{formatDate(customerSummaries[customer.id]?.nextDueDate)}</td>
                <td><span className={`soft-chip ${customerSummaries[customer.id]?.status === 'Overdue' ? 'red' : customerSummaries[customer.id]?.status === 'Closed' ? 'gray' : customerSummaries[customer.id]?.status === 'Setup Pending' ? 'orange' : 'green'}`}>{customerSummaries[customer.id]?.status || customer.status}</span></td>
                <td><IconButton size="sm" label={`View ${customer.name}`} onClick={() => navigate(`/customers/${customer.id}`)}><Eye size={16}/></IconButton></td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        <div className="mobile-data-list">
          {filtered.map((customer) => (
            <article className="mobile-data-card" key={customer.id}>
              <div className="mobile-data-top"><div className="row-title"><CustomerAvatar className="row-avatar" photo={customer.photo} name={customer.name} /><div><strong><CustomerProfileLink customerId={customer.id}>{customer.name}</CustomerProfileLink></strong><small>{customer.id} · {formatIndianMobile(customer.mobile)}</small></div></div><IconButton size="sm" label={`View ${customer.name}`} onClick={() => navigate(`/customers/${customer.id}`)}><Eye size={16}/></IconButton></div>
              <div className="mobile-data-meta"><div><span>Cycle</span><strong>{customerSummaries[customer.id]?.cycles.join(' + ') || customer.cycle || '—'}</strong></div><div><span>Collection</span><strong>{collectionText(customer)}</strong></div><div><span>Outstanding</span><strong>{formatCurrency(customerSummaries[customer.id]?.totalOutstanding || 0)}</strong></div><div><span>Status</span><strong>{customerSummaries[customer.id]?.status || customer.status}</strong></div></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
