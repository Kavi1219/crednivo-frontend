import { BarChart3, HandCoins, History, ReceiptText, UserPlus, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AddExpenseModal from '../expenses/AddExpenseModal';
import './QuickActions.css';

const actions = [
  ['Add Customer', '/customers/new', UserPlus, 'blue', 'customers.add'],
  ['Create Loan', '/loans/create', WalletCards, 'cyan', 'loans.create'],
  ['Add Collection', '/collection?focus=search', HandCoins, 'green', 'collections.collect'],
  ['Add Expense', null, ReceiptText, 'pink', 'expenses.add'],
  ['Payment History', '/payments', History, 'orange', 'payments.view'],
  ['View Reports', '/reports', BarChart3, 'purple', 'reports.full'],
];

export default function QuickActions() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const visible = actions.filter(([, , , , permission]) => hasPermission(permission));

  const handleClick = (label, path) => {
    if (label === 'Add Expense') { setExpenseOpen(true); return; }
    navigate(path);
  };

  return (
    <section className="quick-card app-card">
      <h2>Quick Actions</h2>
      <div className="quick-grid">
        {visible.map(([label, path, Icon, tone]) => (
          <button key={label} onClick={() => handleClick(label, path)} className="quick-action" title={label}>
            <span className={`quick-icon ${tone}`}><Icon size={18} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <AddExpenseModal open={expenseOpen} onClose={() => setExpenseOpen(false)} />
    </section>
  );
}
