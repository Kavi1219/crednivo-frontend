import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, ChevronDown, CircleDollarSign, FileText, Gauge,
  HandCoins, Landmark, LogOut, PiggyBank, ReceiptText, Settings, Users, UserRound, WalletCards
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCrednivo } from '../../context/CrednivoContext';
import Tooltip from '../common/Tooltip';
import './Sidebar.css';
import crednivoApprovedMark from '../../assets/brand/crednivo-approved-mark.png';

const simpleItems = [
  { label: 'Collection', path: '/collection', icon: HandCoins, permission: 'collections.view' },
  { label: 'Payments', path: '/payments', icon: WalletCards, permission: 'payments.view' },
  { label: 'Capital', path: '/capital', icon: Landmark, permission: 'capital.view' },
  { label: 'Savings', path: '/savings', icon: PiggyBank, ownerOnly: true },
  { label: 'Expenses', path: '/expenses', icon: ReceiptText, permission: 'expenses.view' },
  { label: 'Reports', path: '/reports', icon: BarChart3, permission: 'reports.full' },
  { label: 'Agents', path: '/agents', icon: Users, ownerOnly: true },
  { label: 'Documents', path: '/documents', icon: FileText, permission: 'documents.view' },
  { label: 'Settings', path: '/settings', icon: Settings, always: true },
];

function NavIcon({ label, children }) {
  return <Tooltip label={label} side="right">{children}</Tooltip>;
}

export default function Sidebar() {
  const [customersOpen, setCustomersOpen] = useState(false);
  const [loansOpen, setLoansOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isOwner, hasPermission } = useAuth();
  const { loans } = useCrednivo();
  const activeLoanCount = loans.filter((loan) => loan.status !== 'Closed').length;
  const closedLoanCount = loans.filter((loan) => loan.status === 'Closed').length;
  const visibleItems = simpleItems.filter((item) => item.always || (item.ownerOnly ? isOwner : hasPermission(item.permission)));

  const loanSubnavClass = (target) => {
    if (target === 'create') return location.pathname === '/loans/create' ? 'active' : '';
    if (location.pathname !== '/loans') return '';
    const currentStatus = new URLSearchParams(location.search).get('status');
    if (target === 'all') return !currentStatus || currentStatus === 'All' ? 'active' : '';
    return currentStatus === target ? 'active' : '';
  };

  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };

  return (
    <aside className="sidebar desktop-sidebar">
      <button className="brand" onClick={() => navigate('/')} aria-label="CREDNIVO Overview">
        <span className="brand-mark brand-mark-approved"><img src={crednivoApprovedMark} alt="" /></span>
        <span className="brand-copy"><strong>CREDNIVO</strong><small>Finance Management Platform</small></span>
      </button>

      <nav className="side-nav" aria-label="Main navigation">
        {hasPermission('overview.view') && <NavLink className={({isActive}) => `side-link ${isActive ? 'active' : ''}`} to="/" end>
          <NavIcon label="Overview"><Gauge size={20} /></NavIcon><span>Overview</span>
        </NavLink>}

        {hasPermission('customers.view') && <div className="side-group">
          <button className="side-link side-parent" onClick={() => setCustomersOpen(v => !v)} aria-expanded={customersOpen}>
            <NavIcon label="Customers"><UserRound size={20} /></NavIcon><span>Customers</span><ChevronDown size={15} className={customersOpen ? 'chevron open' : 'chevron'} />
          </button>
          <div className={`subnav ${customersOpen ? 'open' : ''}`}>
            <NavLink to="/customers">All Customers</NavLink><NavLink to="/customers/daily">Daily</NavLink><NavLink to="/customers/weekly">Weekly</NavLink><NavLink to="/customers/monthly">Monthly</NavLink>
          </div>
        </div>}

        {hasPermission('loans.view') && <div className="side-group">
          <button className="side-link side-parent" onClick={() => setLoansOpen(v => !v)} aria-expanded={loansOpen}>
            <NavIcon label="Loans"><CircleDollarSign size={20} /></NavIcon><span>Loans</span><ChevronDown size={15} className={loansOpen ? 'chevron open' : 'chevron'} />
          </button>
          <div className={`subnav ${loansOpen ? 'open' : ''}`}>
            <NavLink className={()=>loanSubnavClass('all')} to="/loans">
              <span>All Loans</span>
            </NavLink>
            {hasPermission('loans.create') && <NavLink className={()=>loanSubnavClass('create')} to="/loans/create">
              <span>Create Loan</span>
            </NavLink>}
            <NavLink className={()=>loanSubnavClass('Active')} to="/loans?status=Active">
              <span>Active Loans</span><small className="subnav-count">{activeLoanCount}</small>
            </NavLink>
            <NavLink className={()=>loanSubnavClass('Closed')} to="/loans?status=Closed">
              <span>Closed Loans</span><small className="subnav-count">{closedLoanCount}</small>
            </NavLink>
          </div>
        </div>}

        {visibleItems.map(({ label, path, icon: Icon }) => (
          <NavLink key={path} className={({isActive}) => `side-link ${isActive ? 'active' : ''}`} to={path}>
            <NavIcon label={label}><Icon size={20} /></NavIcon><span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <button className="logout-button" onClick={signOut} title={`Signed in as ${user?.displayName || ''}`}>
        <LogOut size={19} /><span>Logout</span>
      </button>
    </aside>
  );
}
