import { Eye, Plus, Search, WalletCards, IndianRupee, BadgeIndianRupee, Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/finance';
import './Loans.css';

export default function Loans() {
  const { loans } = useCrednivo();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const initialStatus = ['All', 'Active', 'Closed', 'Overdue'].includes(requestedStatus)
    ? requestedStatus
    : 'All';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const statusLoans = useMemo(() => loans.filter((loan) => {
    if (status === 'All') return true;
    if (status === 'Active') return loan.status !== 'Closed';
    return loan.status === status;
  }), [loans, status]);
  const filtered = useMemo(() => statusLoans.filter((loan) => {
    const q = search.toLowerCase().trim();
    return !q || `${loan.id} ${loan.customerId} ${loan.customerName} ${loan.cycle}`.toLowerCase().includes(q);
  }), [statusLoans, search]);
  // Search only filters the table; summary cards remain fixed for the selected status.
  const principal = statusLoans.reduce((sum, item) => sum + item.principal, 0);
  const outstanding = statusLoans.reduce((sum, item) => sum + item.outstanding, 0);
  return <div className="module-page loans-page">
    <ModuleHeader eyebrow="Loan Management" title={status === 'All' ? 'All Loans' : `${status} Loans`} description="Track every loan, its cycle, repayment plan, balance and current status." actions={hasPermission('loans.create') ? <ActionButton icon={Plus} onClick={()=>navigate('/loans/create')}>Create Loan</ActionButton> : null} />
    <section className="metric-strip">
      <article className="mini-metric module-card"><span className="mini-metric-icon"><WalletCards size={20}/></span><div><span>Total Loans</span><strong>{statusLoans.length}</strong></div></article>
      <article className="mini-metric module-card"><span className="mini-metric-icon"><IndianRupee size={20}/></span><div><span>Principal</span><strong>{formatCurrency(principal)}</strong></div></article>
      <article className="mini-metric module-card"><span className="mini-metric-icon"><BadgeIndianRupee size={20}/></span><div><span>Outstanding</span><strong>{formatCurrency(outstanding)}</strong></div></article>
      <article className="mini-metric module-card"><span className="mini-metric-icon"><Activity size={20}/></span><div><span>Active</span><strong>{statusLoans.filter(item=>item.status!=='Closed').length}</strong></div></article>
    </section>
    <section className="module-card">
      <div className="module-toolbar"><label className="module-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search loan, customer or ID..."/></label><div className="module-toolbar-group">{['All','Active','Overdue','Closed'].map(item=><button key={item} className={`filter-chip ${status===item?'active':''}`} onClick={()=>setStatus(item)}>{item}</button>)}</div></div>
      <div className="module-table-wrap desktop-data-table"><table className="module-table"><thead><tr><th>Loan</th><th>Customer</th><th>Cycle</th><th>Type</th><th>Principal</th><th>Collection</th><th>Outstanding</th><th>Next Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(loan=><tr key={loan.id}><td><strong>{loan.id}</strong></td><td><CustomerProfileLink customerId={loan.customerId}>{loan.customerName}</CustomerProfileLink><small className="table-sub">{loan.customerId}</small></td><td><span className="soft-chip blue">{loan.cycle}</span></td><td>{loan.loanType}</td><td>{formatCurrency(loan.principal)}</td><td>{formatCurrency(loan.collectionAmount)}</td><td><strong>{formatCurrency(loan.outstanding)}</strong></td><td>{formatDate(loan.nextDueDate)}</td><td><span className={`soft-chip ${loan.status==='Closed'?'gray':loan.status==='Overdue'?'red':'green'}`}>{loan.status}</span></td><td><IconButton size="sm" label={`View ${loan.customerName}`} onClick={()=>navigate(`/customers/${loan.customerId}`)}><Eye size={16}/></IconButton></td></tr>)}</tbody></table></div>
      <div className="mobile-data-list">{filtered.map(loan=><article className="mobile-data-card" key={loan.id}><div className="mobile-data-top"><div><strong><CustomerProfileLink customerId={loan.customerId}>{loan.customerName}</CustomerProfileLink></strong><small className="table-sub">{loan.id}</small></div><IconButton size="sm" label="View customer" onClick={()=>navigate(`/customers/${loan.customerId}`)}><Eye size={16}/></IconButton></div><div className="mobile-data-meta"><div><span>Cycle</span><strong>{loan.cycle} · {loan.loanType}</strong></div><div><span>Collection</span><strong>{formatCurrency(loan.collectionAmount)}</strong></div><div><span>Outstanding</span><strong>{formatCurrency(loan.outstanding)}</strong></div><div><span>Status</span><strong>{loan.status}</strong></div></div></article>)}</div>
    </section>
  </div>;
}
