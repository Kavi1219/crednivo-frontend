import { FileDown, HandCoins, Home, ReceiptText, UserPlus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './MobileBottomNav.css';

const navItems = [
  { label: 'Home', to: '/', icon: Home, permission: 'overview.view' },
  { label: 'Expenses', to: '/expenses', icon: ReceiptText, permission: 'expenses.view' },
  { label: 'New Customer', to: '/customers/new', icon: UserPlus, primary: true, permission: 'customers.add' },
  { label: 'Collections', to: '/collection', icon: HandCoins, permission: 'collections.view' },
  { label: 'Report', to: '/today-report', icon: FileDown, permission: 'todayReport.view' },
];

export default function MobileBottomNav() {
  const { hasPermission } = useAuth();
  const visible = navItems.filter((item) => hasPermission(item.permission));
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile quick navigation">
      {visible.map(({ label, to, icon: Icon, primary }) => (
        <NavLink key={to} to={to} aria-label={label === 'Report' ? "Today's report" : label}
          className={({isActive}) => `${primary ? 'mobile-nav-primary' : 'mobile-nav-item'} ${isActive ? 'active' : ''}`}>
          {primary ? <><span className="primary-icon"><Icon size={26} strokeWidth={2.25} /></span><span>Customer</span></> : <><Icon size={22} strokeWidth={2} /><span>{label}</span></>}
        </NavLink>
      ))}
    </nav>
  );
}
