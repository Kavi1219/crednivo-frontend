import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart3, CircleDollarSign, FileText, Landmark, LogOut, PiggyBank, ReceiptText, Settings, Users, WalletCards, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './MobileDrawer.css';
import crednivoApprovedMark from '../../assets/brand/crednivo-approved-mark.png';

const items = [
  ['Customers', '/customers', Users, 'customers.view'],
  ['Loans', '/loans', CircleDollarSign, 'loans.view'],
  ['Payments', '/payments', WalletCards, 'payments.view'],
  ['Expenses', '/expenses', ReceiptText, 'expenses.view'],
  ['Documents', '/documents', FileText, 'documents.view'],
  ['Capital', '/capital', Landmark, 'capital.view'],
  ['Savings', '/savings', PiggyBank, null, true],
  ['Reports', '/reports', BarChart3, 'reports.full'],
  ['Agents', '/agents', Users, null, true],
  ['Settings', '/settings', Settings, null, false, true],
];

export default function MobileDrawer({ open, onClose }) {
  const { isOwner, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const visible = items.filter(([, , , permission, ownerOnly, always]) => always || (ownerOnly ? isOwner : hasPermission(permission)));
  const signOut = async () => { onClose(); await logout(); navigate('/login', { replace: true }); };
  return (
    <>
      <button className={`drawer-overlay ${open ? 'show' : ''}`} onClick={onClose} aria-label="Close menu overlay" />
      <aside className={`mobile-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <div className="drawer-brand"><span className="drawer-brand-mark drawer-brand-mark-approved"><img src={crednivoApprovedMark} alt="" /></span><span className="drawer-brand-copy"><strong>CREDNIVO</strong><small>Finance Management Platform</small></span></div>
          <button onClick={onClose} aria-label="Close menu"><X size={22} /></button>
        </div>
        <nav>{visible.map(([label, path, Icon]) => <NavLink key={path} to={path} onClick={onClose}><Icon size={19} />{label}</NavLink>)}</nav>
        <button className="drawer-logout" onClick={signOut}><LogOut size={18} /> Logout</button>
      </aside>
    </>
  );
}
