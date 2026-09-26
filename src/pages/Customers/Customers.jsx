import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  UserPlus,
  UsersRound,
  X,
  WalletCards,
  BadgeIndianRupee,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { goActualBack } from '../../components/GlobalBackButton';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { exportCustomersListPdf, exportCustomersListXlsx } from '../../utils/customersExport';
import { formatCurrency, formatIndianMobile, normalizeIndianMobile } from '../../utils/finance';
import './Customers.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';

function routeCycle(pathname) {
  if (pathname.includes('/daily')) return 'Daily';
  if (pathname.includes('/weekly')) return 'Weekly';
  if (pathname.includes('/monthly')) return 'Monthly';
  return 'All';
}


function CustomerSummaryCard({ title, value, note, icon: Icon, tone = 'blue' }) {
  return (
    <div className={`customer-home-card tone-${tone}`} aria-label={`${title}: ${value}. ${note}.`}>
      <span className="customer-home-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
      <span className="customer-home-icon"><Icon size={18} strokeWidth={2.1} /></span>
      <div className="customer-home-copy">
        <strong>{value}</strong>
        <p>{title}</p>
        <small>{note}</small>
      </div>
      <span className="customer-home-graphic" aria-hidden="true"><span></span><span></span><span></span></span>
      <span className="customer-home-orb" aria-hidden="true"></span>
    </div>
  );
}

function handleCardKeyDown(event, onOpen) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onOpen();
  }
}

export default function Customers() {
  const { customers, loans, company } = useCrednivo();
  const { hasPermission, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const cycle = routeCycle(location.pathname);
  const downloadMenuRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!downloadMenuRef.current?.contains(event.target)) setDownloadOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const customerSummaries = useMemo(() => Object.fromEntries(customers.map((customer) => {
    const allCustomerLoans = loans.filter((loan) => loan.customerId === customer.id);
    const activeLoans = allCustomerLoans.filter((loan) => loan.status !== 'Closed' && Number(loan.outstanding) > 0);
    const closedLoans = allCustomerLoans.filter((loan) => loan.status === 'Closed' || Number(loan.outstanding) <= 0);
    const totalOutstanding = activeLoans.reduce((sum, loan) => sum + (Number(loan.outstanding) || 0), 0);
    const collectionByCycle = activeLoans.reduce((summary, loan) => {
      const loanCycle = loan.cycle || 'Other';
      summary[loanCycle] = (summary[loanCycle] || 0) + (Number(loan.collectionAmount) || 0);
      return summary;
    }, {});
    const cycles = Object.keys(collectionByCycle);
    const nextDueDate = activeLoans.map((loan) => loan.nextDueDate).filter(Boolean).sort()[0] || customer.nextDueDate;
    const status = activeLoans.some((loan) => loan.status === 'Overdue') ? 'Overdue' : activeLoans.length ? 'Active' : customer.status;
    return [customer.id, {
      activeLoans,
      closedLoans,
      totalOutstanding,
      collectionByCycle,
      cycles,
      nextDueDate,
      status,
    }];
  })), [customers, loans]);

  const cycleCustomers = useMemo(() => customers.filter((customer) => {
    if (cycle === 'All') return true;
    return customerSummaries[customer.id]?.cycles.includes(cycle);
  }), [customers, cycle, customerSummaries]);

  const filtered = useMemo(() => cycleCustomers.filter((customer) => {
    const q = search.trim().toLowerCase();
    const phoneQuery = normalizeIndianMobile(search);
    const textMatch = !q || `${customer.id} ${customer.name} ${customer.mobile} ${customer.area} ${customer.jaminName || ''} ${customer.jaminMobile || ''}`.toLowerCase().includes(q);
    const phoneMatch = phoneQuery.length >= 3 && (
      normalizeIndianMobile(customer.mobile).includes(phoneQuery)
      || normalizeIndianMobile(customer.jaminMobile).includes(phoneQuery)
    );
    return textMatch || phoneMatch;
  }), [cycleCustomers, search]);

  const outstanding = cycleCustomers.reduce((sum, item) => sum + (customerSummaries[item.id]?.totalOutstanding || 0), 0);
  const active = cycleCustomers.filter((item) => (customerSummaries[item.id]?.activeLoans.length || 0) > 0).length;

  const exportRows = useMemo(() => filtered.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: formatIndianMobile(customer.mobile),
    witnessName: customer.jaminName || '—',
    witnessPhone: customer.jaminMobile ? formatIndianMobile(customer.jaminMobile) : '—',
    cycle: customerSummaries[customer.id]?.cycles.join(' + ') || customer.cycle || '—',
    activeLoans: customerSummaries[customer.id]?.activeLoans.length || 0,
    closedLoans: customerSummaries[customer.id]?.closedLoans.length || 0,
    outstanding: customerSummaries[customer.id]?.totalOutstanding || 0,
  })), [filtered, customerSummaries]);

  const downloadCustomers = async (format) => {
    setDownloadOpen(false);
    const payload = {
      cycle,
      generatedBy: user?.displayName || company?.owner || 'Admin',
      company: {
        name: company?.name || user?.companyName || 'Company',
        branch: company?.branch || user?.branch || 'Main Branch',
        logo: company?.logo || '',
      },
      rows: exportRows,
    };

    if (format === 'pdf') {
      await exportCustomersListPdf(payload);
      return;
    }
    await exportCustomersListXlsx(payload);
  };

  const openCustomer = (customerId) => navigate(`/customers/${customerId}`);

  const headerActions = (
    <div className="customers-page-actions">
      <button
        type="button"
        className="customers-back-button"
        onClick={() => goActualBack(navigate, location)}
      >
        <ArrowLeft size={16} /> Back
      </button>
      {hasPermission('customers.add') && (
        <ActionButton icon={UserPlus} onClick={() => navigate('/customers/new')}>New Customer</ActionButton>
      )}
      <div className="collection-download-menu customer-download-menu" ref={downloadMenuRef}>
        <button
          type="button"
          className="collection-download-button"
          onClick={() => setDownloadOpen((open) => !open)}
          aria-expanded={downloadOpen}
        >
          <Download size={15} /> Download <ChevronDown size={13} className={downloadOpen ? 'open' : ''} />
        </button>
        {downloadOpen && (
          <div className="collection-download-popdown">
            <button type="button" onClick={() => downloadCustomers('excel')}>
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button type="button" onClick={() => downloadCustomers('pdf')}>
              <FileText size={14} /> PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="module-page customers-page">
      <ModuleHeader actions={headerActions} />

      <section className="stats-section customer-home-stats">
        <div className="customer-home-grid">
          <CustomerSummaryCard title="Total Customers" value={String(cycleCustomers.length)} note="All registered customers" icon={UsersRound} tone="blue" />
          <CustomerSummaryCard title="Active Customers" value={String(active)} note="Currently active" icon={WalletCards} tone="green" />
          <CustomerSummaryCard title="Outstanding" value={formatCurrency(outstanding)} note="Total pending amount" icon={BadgeIndianRupee} tone="orange" />
        </div>
      </section>

      <section className="module-card">
        <div className="module-toolbar">
          <label className="module-search customer-list-search">
            <Search size={16}/>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, ID, mobile or witness..." />
            {search && (
              <button
                type="button"
                className="customer-search-clear"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSearch('');
                }}
                aria-label="Clear customer search"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <div className="module-toolbar-group customers-toolbar-group">
            {['All', 'Daily', 'Weekly', 'Monthly'].map((item) => (
              <button key={item} className={`filter-chip ${cycle === item ? 'active' : ''}`} onClick={() => navigate(item === 'All' ? '/customers' : `/customers/${item.toLowerCase()}`)}>{item}</button>
            ))}
          </div>
        </div>

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table customers-table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Witness</th><th>Cycle</th><th>Active Loan</th><th>Closed Loan</th><th>Outstanding</th></tr></thead>
            <tbody>{filtered.map((customer) => {
              const summary = customerSummaries[customer.id] || {};
              return (
                <tr
                  key={customer.id}
                  className="customer-table-row"
                  onClick={() => openCustomer(customer.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, () => openCustomer(customer.id))}
                  tabIndex={0}
                  role="button"
                >
                  <td>
                    <div className="row-title">
                      <CustomerAvatar className="row-avatar" photo={customer.photo} name={customer.name} />
                      <div>
                        <strong><CustomerProfileLink customerId={customer.id}>{customer.name}</CustomerProfileLink></strong>
                        <small>{customer.id}</small>
                      </div>
                    </div>
                  </td>
                  <td><strong>{formatIndianMobile(customer.mobile)}</strong></td>
                  <td>
                    <div className="customer-witness-cell">
                      <strong>{customer.jaminName || '—'}</strong>
                      <small>{customer.jaminMobile ? formatIndianMobile(customer.jaminMobile) : '—'}</small>
                    </div>
                  </td>
                  <td><span className="soft-chip blue">{summary.cycles?.join(' + ') || customer.cycle || '—'}</span></td>
                  <td>{summary.activeLoans?.length || 0}</td>
                  <td>{summary.closedLoans?.length || 0}</td>
                  <td><strong>{formatCurrency(summary.totalOutstanding || 0)}</strong></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>

        <div className="mobile-data-list customers-mobile-list">
          {filtered.map((customer) => {
            const summary = customerSummaries[customer.id] || {};
            return (
              <article
                className="mobile-data-card customer-mobile-card"
                key={customer.id}
                onClick={() => openCustomer(customer.id)}
                onKeyDown={(event) => handleCardKeyDown(event, () => openCustomer(customer.id))}
                tabIndex={0}
                role="button"
              >
                <div className="mobile-data-top">
                  <div className="row-title">
                    <CustomerAvatar className="row-avatar" photo={customer.photo} name={customer.name} />
                    <div>
                      <strong><CustomerProfileLink customerId={customer.id}>{customer.name}</CustomerProfileLink></strong>
                      <small>{customer.id}</small>
                    </div>
                  </div>
                </div>
                <div className="mobile-data-meta customer-mobile-meta">
                  <div><span>Phone</span><strong>{formatIndianMobile(customer.mobile)}</strong></div>
                  <div><span>Witness</span><strong>{customer.jaminName || '—'}</strong><small>{customer.jaminMobile ? formatIndianMobile(customer.jaminMobile) : '—'}</small></div>
                  <div><span>Cycle</span><strong>{summary.cycles?.join(' + ') || customer.cycle || '—'}</strong></div>
                  <div><span>Active Loan</span><strong>{summary.activeLoans?.length || 0}</strong></div>
                  <div><span>Closed Loan</span><strong>{summary.closedLoans?.length || 0}</strong></div>
                  <div><span>Outstanding</span><strong>{formatCurrency(summary.totalOutstanding || 0)}</strong></div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
