import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3, CircleDollarSign, Gauge,
  HandCoins, Landmark, PiggyBank, ReceiptText, Settings, Users, UserRound, WalletCards
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Tooltip from '../common/Tooltip';
import CrednivoMark from '../brand/CrednivoMark';
import './Sidebar.css';

const simpleItems = [
  { label: 'Collection', path: '/collection', icon: HandCoins, permission: 'collections.view' },
  { label: 'Payments', path: '/payments', icon: WalletCards, permission: 'payments.view' },
  { label: 'Capital', path: '/capital', icon: Landmark, permission: 'capital.view' },
  { label: 'Savings', path: '/savings', icon: PiggyBank, ownerOnly: true },
  { label: 'Expenses', path: '/expenses', icon: ReceiptText, permission: 'expenses.view' },
  { label: 'Reports', path: '/reports', icon: BarChart3, permission: 'reports.full' },
  { label: 'Agents', path: '/agents', icon: Users, ownerOnly: true },
  { label: 'Settings', path: '/settings', icon: Settings, always: true },
];

function NavIcon({ label, children }) {
  return <Tooltip label={label} side="right">{children}</Tooltip>;
}

export default function Sidebar() {
  const navigate = useNavigate();
  const { isOwner, hasPermission } = useAuth();
  const visibleItems = simpleItems.filter((item) => item.always || (item.ownerOnly ? isOwner : hasPermission(item.permission)));

  return (
    <aside className="sidebar desktop-sidebar">
      <button className="brand" onClick={() => navigate('/')} aria-label="CREDNIVO Overview">
        <span className="brand-mark"><CrednivoMark size={48} /></span>
        <span className="brand-copy"><strong>CREDNIVO</strong><small>Finance Management Platform</small></span>
      </button>

      <nav className="side-nav" aria-label="Main navigation">
        {hasPermission('overview.view') && <NavLink className={({isActive}) => `side-link ${isActive ? 'active' : ''}`} to="/" end>
          <NavIcon label="Overview"><Gauge size={20} /></NavIcon><span>Overview</span>
        </NavLink>}

        {hasPermission('customers.view') && (
          <NavLink className={({isActive}) => `side-link ${isActive ? 'active' : ''}`} to="/customers">
            <NavIcon label="Customers"><UserRound size={20} /></NavIcon><span>Customers</span>
          </NavLink>
        )}

        {hasPermission('loans.view') && (
          <NavLink className={({isActive}) => `side-link ${isActive ? 'active' : ''}`} to="/loans">
            <NavIcon label="Loans"><CircleDollarSign size={20} /></NavIcon><span>Loans</span>
          </NavLink>
        )}

        {visibleItems.map(({ label, path, icon: Icon }) => (
          <NavLink key={path} className={({isActive}) => `side-link ${isActive ? 'active' : ''}`} to={path}>
            <NavIcon label={label}><Icon size={20} /></NavIcon><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
