import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight, BarChart3, CircleDollarSign, ClipboardList, Gauge,
  HandCoins, Landmark, PiggyBank, ReceiptText, Settings, Users, UserRound, WalletCards
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCrednivo } from '../../context/CrednivoContext';
import { listWork } from '../../services/work';
import { calculatePendingDueCounts, getRiskTier } from '../../utils/collectionTargets';
import { toInputDate } from '../../utils/finance';
import Tooltip from '../common/Tooltip';
import CrednivoMark from '../brand/CrednivoMark';
import './Sidebar.css';

const simpleItems = [
  { label: 'Collection', path: '/collection', icon: HandCoins, permission: 'collections.view' },
  { label: 'Work', path: '/work', icon: ClipboardList, always: true, badgeKey: 'work' },
  { label: 'History', path: '/payments', icon: WalletCards, permission: 'payments.view' },
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
  const { collections } = useCrednivo();
  const visibleItems = simpleItems.filter((item) => item.always || (item.ownerOnly ? isOwner : hasPermission(item.permission)));

  // Real, live counts for the sidebar badges — not placeholder numbers.
  const [pendingWorkCount, setPendingWorkCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await listWork();
        const pending = (Array.isArray(list) ? list : []).filter(
          (item) => item.status === 'ASSIGNED' || item.status === 'STARTED',
        ).length;
        if (!cancelled) setPendingWorkCount(pending);
      } catch { /* keep last known count */ }
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const riskyCustomerCount = (() => {
    const today = toInputDate();
    const counts = calculatePendingDueCounts(collections, today);
    let risky = 0;
    counts.forEach((count) => { if (getRiskTier(count) === 'Risky') risky += 1; });
    return risky;
  })();

  const badgeValues = { work: pendingWorkCount, customers: riskyCustomerCount };

  return (
    <aside className="sidebar desktop-sidebar">
      <button className="brand" onClick={() => navigate('/overview')} aria-label="CREDNIVO Overview">
        <span className="brand-mark"><CrednivoMark size={40} /></span>
        <span className="brand-copy"><strong>CREDNIVO</strong></span>
      </button>

      <nav className="side-nav" aria-label="Main navigation">
        {hasPermission('overview.view') && (
          <NavLink className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} to="/overview" end>
            <NavIcon label="Home"><Gauge size={19} /></NavIcon><span>Home</span>
          </NavLink>
        )}

        {hasPermission('customers.view') && (
          <NavLink className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} to="/customers">
            <NavIcon label="Customers"><UserRound size={19} /></NavIcon><span>Customers</span>
            {riskyCustomerCount > 0 && <span className="side-badge">{riskyCustomerCount > 99 ? '99+' : riskyCustomerCount}</span>}
          </NavLink>
        )}

        {hasPermission('loans.view') && (
          <NavLink className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} to="/loans">
            <NavIcon label="Loans"><CircleDollarSign size={19} /></NavIcon><span>Loans</span>
          </NavLink>
        )}

        {visibleItems.map(({ label, path, icon: Icon, badgeKey }) => {
          const badgeValue = badgeKey ? badgeValues[badgeKey] : 0;
          return (
            <NavLink key={path} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} to={path}>
              <NavIcon label={label}><Icon size={19} /></NavIcon><span>{label}</span>
              {badgeValue > 0 && <span className="side-badge">{badgeValue > 99 ? '99+' : badgeValue}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <a className="sidebar-visit-site" href="https://crednivo.in" target="_blank" rel="noreferrer">
          <ArrowUpRight size={15} /> Visit Site
        </a>
      </div>
    </aside>
  );
}
