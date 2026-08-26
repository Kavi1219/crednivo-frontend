import { CalendarDays, CircleDollarSign, Landmark, ReceiptText, TriangleAlert, UserRoundCheck, WalletCards, WalletMinimal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CollectionSummary from '../../components/dashboard/CollectionSummary';
import CollectionTable from '../../components/dashboard/CollectionTable';
import QuickActions from '../../components/dashboard/QuickActions';
import StatCard from '../../components/dashboard/StatCard';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Dashboard.css';

export default function Dashboard() {
  const { metrics, capitalMetrics, collections } = useCrednivo();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const today = toInputDate();

  const collectionProgress = metrics.expected > 0
    ? Math.min(100, Math.max(0, (metrics.collected / metrics.expected) * 100))
    : 0;

  const recoveryBase = Math.max(0, Number(metrics.expected) + Number(metrics.overdue));
  const pendingProgress = recoveryBase > 0
    ? Math.min(100, Math.max(0, (Number(metrics.pendingOverdue) / recoveryBase) * 100))
    : 0;

  const canViewCapital = hasPermission('capital.view');

  const partialRows = (collections || []).filter((item) => {
    const due = Number(item.dueAmount || 0);
    const paid = Number(item.paidAmount || 0);
    return item.date > today && paid > 0 && paid < due;
  });
  const partialAmount = partialRows.reduce(
    (sum, item) => sum + Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)),
    0,
  );
  const partialCustomers = new Set(partialRows.map((item) => item.customerId)).size;

  const dashboardStats = [
    ...(canViewCapital ? [{
      title: 'Available Capital',
      value: formatCurrency(metrics.availableCapital ?? capitalMetrics.availableCapital),
      note: capitalMetrics.entries ? 'Current business cash' : 'Add opening investment',
      icon: Landmark,
      tone: (metrics.availableCapital ?? capitalMetrics.availableCapital) < 0 ? 'orange' : 'green',
      progress: 0,
      onDetails: () => navigate('/capital'),
    }] : []),
    {
      title: 'Active Loans',
      value: String(metrics.activeLoans || 0),
      note: 'Total Active Loans',
      icon: UserRoundCheck,
      tone: 'indigo',
      progress: 0,
      onDetails: () => navigate('/loans?status=Active'),
    },
    {
      title: "Today's Collection",
      value: formatCurrency(metrics.expected),
      note: `From ${metrics.dueCustomers || 0} Customers`,
      icon: WalletCards,
      tone: 'blue',
      progress: collectionProgress,
      onDetails: () => navigate('/collection?view=today'),
    },
    {
      title: 'Collected Today',
      value: formatCurrency(metrics.collected),
      note: 'Actual collections received',
      icon: WalletMinimal,
      tone: 'green',
      progress: collectionProgress,
      onDetails: () => navigate('/payments?filter=Collection&today=1'),
    },
    {
      title: "Today's Expenses",
      value: formatCurrency(metrics.todayExpenses),
      note: 'Business expenses',
      icon: ReceiptText,
      tone: 'pink',
      progress: 0,
      onDetails: () => navigate('/expenses'),
    },
    {
      title: 'Pending / Overdue',
      value: formatCurrency(metrics.pendingOverdue),
      note: `${formatCurrency(metrics.pending)} due today · ${formatCurrency(metrics.overdue)} overdue`,
      icon: TriangleAlert,
      tone: 'orange',
      progress: pendingProgress,
      onDetails: () => navigate('/collection?view=overdue'),
    },
    {
      title: 'Partial',
      value: formatCurrency(partialAmount),
      note: `From ${partialCustomers} Customer${partialCustomers === 1 ? '' : 's'}`,
      icon: CircleDollarSign,
      tone: 'blue',
      progress: 0,
      onDetails: () => navigate('/collection?view=upcoming&status=Partial'),
    },
    {
      title: 'Upcoming 7 Days',
      value: formatCurrency(metrics.upcoming7Days),
      note: `From ${metrics.upcomingCustomers || 0} Customers`,
      icon: CalendarDays,
      tone: 'purple',
      progress: 0,
      onDetails: () => navigate('/collection?view=upcoming'),
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-toolbar">
        <button className="date-button" title="Dashboard date"><CalendarDays size={15} /> {formatDate(today)}</button>
      </div>
      <QuickActions />
      <section className="stats-grid" aria-label="Overview">
        {dashboardStats.map((stat) => <StatCard key={stat.title} {...stat} />)}
      </section>
      <section className="dashboard-middle"><CollectionTable /><CollectionSummary /></section>
    </div>
  );
}
