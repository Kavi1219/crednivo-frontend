import { CalendarDays, CircleDollarSign, Landmark, ReceiptText, TriangleAlert, UserRoundCheck, WalletCards, WalletMinimal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CollectionTable from '../../components/dashboard/CollectionTable';
import QuickActions from '../../components/dashboard/QuickActions';
import StatCard from '../../components/dashboard/StatCard';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import { calculateCycleTargets } from '../../utils/collectionTargets';
import './Dashboard.css';

export default function Dashboard() {
  const { metrics, capitalMetrics, collections, loans } = useCrednivo();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const today = toInputDate();

  const collectionProgress = metrics.expected > 0
    ? Math.min(100, Math.max(0, (metrics.collected / metrics.expected) * 100))
    : 0;

  // "Today's Collection" card shows what's STILL owed today, not the static
  // original target — it shrinks live as each customer actually pays.
  const todayRemainingRows = (collections || []).filter((item) => {
    if (item.date !== today) return false;
    return Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)) > 0;
  });
  const todayRemainingAmount = todayRemainingRows.reduce(
    (sum, item) => sum + Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)),
    0,
  );
  const todayRemainingCustomers = new Set(todayRemainingRows.map((item) => item.customerId)).size;

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

  // Standing per-cycle collection capacity — every active loan of that
  // cycle contributes its own periodic amount, regardless of which day
  // each customer's own due date happens to fall on. A loan drops out the
  // moment it closes; a new loan's amount joins in immediately.
  const cycleTargets = calculateCycleTargets(loans);
  const dailyTarget = cycleTargets.daily;
  const weeklyTarget = cycleTargets.weekly;
  const monthlyTarget = cycleTargets.monthly;

  const dashboardStatsToday = [
    {
      title: "Today's Collection",
      value: formatCurrency(todayRemainingAmount),
      note: `${todayRemainingCustomers} Customers Remaining`,
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
      tone: 'danger',
      progress: pendingProgress,
      onDetails: () => navigate('/collection?view=overdue'),
    },
  ];

  const dashboardStatsTarget = [
    {
      title: 'Daily Target',
      value: `${formatCurrency(dailyTarget.amount)} / ${dailyTarget.customerCount}`,
      note: `${dailyTarget.customerCount} daily customers`,
      icon: WalletCards,
      tone: 'blue',
      showProgress: false,
      onDetails: () => navigate('/customers/daily'),
    },
    {
      title: 'Weekly Target',
      value: `${formatCurrency(weeklyTarget.amount)} / ${weeklyTarget.customerCount}`,
      note: `${weeklyTarget.customerCount} weekly customers`,
      icon: WalletCards,
      tone: 'blue',
      showProgress: false,
      onDetails: () => navigate('/customers/weekly'),
    },
    {
      title: 'Monthly Target',
      value: `${formatCurrency(monthlyTarget.amount)} / ${monthlyTarget.customerCount}`,
      note: `${monthlyTarget.customerCount} monthly customers`,
      icon: WalletCards,
      tone: 'blue',
      showProgress: false,
      onDetails: () => navigate('/customers/monthly'),
    },
  ];

  const dashboardStatsBusiness = [
    ...(canViewCapital ? [{
      title: 'Available Capital',
      value: formatCurrency(metrics.availableCapital ?? capitalMetrics.availableCapital),
      note: capitalMetrics.entries ? 'Current business cash' : 'Add opening investment',
      icon: Landmark,
      tone: (metrics.availableCapital ?? capitalMetrics.availableCapital) < 0 ? 'danger' : 'green',
      showProgress: false,
      onDetails: () => navigate('/capital'),
    }] : []),
    {
      title: 'Active Loans',
      value: String(metrics.activeLoans || 0),
      note: 'Total Active Loans',
      icon: UserRoundCheck,
      tone: 'cyan',
      showProgress: false,
      onDetails: () => navigate('/loans?status=Active'),
    },
    {
      title: 'Partial',
      value: formatCurrency(partialAmount),
      note: `From ${partialCustomers} Customer${partialCustomers === 1 ? '' : 's'}`,
      icon: CircleDollarSign,
      tone: 'orange',
      showProgress: false,
      onDetails: () => navigate('/collection?view=upcoming&status=Partial'),
    },
    {
      title: 'Upcoming 7 Days',
      value: formatCurrency(metrics.upcoming7Days),
      note: `From ${metrics.upcomingCustomers || 0} Customers`,
      icon: CalendarDays,
      tone: 'purple',
      showProgress: false,
      onDetails: () => navigate('/collection?view=upcoming'),
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-toolbar">
        <button className="date-button" title="Dashboard date"><CalendarDays size={15} /> {formatDate(today)}</button>
      </div>
      <QuickActions />
      <section className="stats-section" aria-labelledby="stats-today-heading">
        <h2 id="stats-today-heading" className="stats-section-title">Today</h2>
        <div className="stats-grid">
          {dashboardStatsToday.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </section>
      <section className="stats-section" aria-labelledby="stats-business-heading">
        <h2 id="stats-business-heading" className="stats-section-title">Business Overview</h2>
        <div className="stats-grid">
          {dashboardStatsBusiness.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </section>
      <section className="stats-section" aria-labelledby="stats-collection-target-heading">
        <h2 id="stats-collection-target-heading" className="stats-section-title">Collection Target</h2>
        <div className="stats-grid">
          {dashboardStatsTarget.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </section>
      <section className="dashboard-middle"><CollectionTable /></section>
    </div>
  );
}
