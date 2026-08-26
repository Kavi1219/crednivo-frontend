import { BarChart3, HandCoins, History, Landmark, ReceiptText, UserPlus, Users, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './QuickActions.css';

const actions = [
  ['Add Customer', '/customers/new', UserPlus, 'blue', 'customers.add'],
  ['Create Loan', '/loans/create', WalletCards, 'green', 'loans.create'],
  ['Add Collection', '/collection', HandCoins, 'purple', 'collections.collect'],
  ['Add Expense', '/expenses', ReceiptText, 'orange', 'expenses.add'],
  ['Add Capital', '/capital?add=1', Landmark, 'indigo', 'capital.manage'],
  ['View Reports', '/reports', BarChart3, 'cyan', 'reports.full'],
  ['Payment History', '/payments', History, 'pink', 'payments.view'],
  ['Agent Management', '/agents', Users, 'amber', null, true],
];

export default function QuickActions() {
  const navigate = useNavigate();
  const { isOwner, hasPermission } = useAuth();
  const visible = actions.filter(([, , , , permission, ownerOnly]) => ownerOnly ? isOwner : hasPermission(permission));
  return (
    <section className="quick-card app-card">
      <h2>Quick Actions</h2>
      <div className="quick-grid">
        {visible.map(([label, path, Icon, tone]) => <button key={label} onClick={() => navigate(path)} className="quick-action" title={label}><span className={`quick-icon ${tone}`}><Icon size={18} /></span><span>{label}</span></button>)}
      </div>
    </section>
  );
}
