import {
  ArrowRight,
  CircleDollarSign,
  Landmark,
  ReceiptText,
  UserRoundCheck,
  WalletCards,
  WalletMinimal,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CollectionSummary from '../../components/dashboard/CollectionSummary';
import CollectionTable from '../../components/dashboard/CollectionTable';
import QuickActions from '../../components/dashboard/QuickActions';
import RiskyOverdueCustomers from '../../components/dashboard/RiskyOverdueCustomers';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, toInputDate } from '../../utils/finance';
import { calculateCycleTargets } from '../../utils/collectionTargets';
import './Dashboard.css';

function subtractDays(dateString, days) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatHeroDay(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { weekday: 'long' });
}

function formatHeroDate(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function HomeMetricCard({ title, value, note, trend, trendLabel, icon: Icon, tone = 'blue', onClick }) {
  return (
    <button
      type="button"
      className={`home-metric-card is-compact tone-${tone}`}
      onClick={onClick}
      aria-label={`${title}: ${value}. ${note}.`}
    >
      <span className="home-metric-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
      <div className="home-metric-compact-head">
        <span className="home-metric-icon"><Icon size={18} strokeWidth={2.1} /></span>
      </div>
      <div className="home-metric-compact-copy">
        <strong>{value}</strong>
        <p>{title}</p>
        <div className="home-metric-trend-row compact">
          {trend !== null && trend !== undefined && (
            <span className={`home-metric-trend ${trend < 0 ? 'is-down' : 'is-up'}`}>
              {trend < 0 ? '↓' : '↑'} {Math.abs(Number(trend))}%
            </span>
          )}
          <small>{trendLabel || note}</small>
        </div>
      </div>
      <span className="home-metric-graphic compact" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span className="home-metric-orb" aria-hidden="true"></span>
    </button>
  );
}

function DashboardSection({ id, title, subtitle, columns, children, className = '' }) {
  return (
    <section className={`stats-section dashboard-section-shell exact-shell dashboard-reference-section ${className}`.trim()} aria-labelledby={id}>
      <div className="section-shell-head exact-head">
        <div>
          <h2 id={id} className="stats-section-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className={`home-metric-grid ${columns}`}>{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { metrics, capitalMetrics, collections, loans, expenses, payments, company } = useCrednivo();
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const today = toInputDate();
  const yesterday = subtractDays(today, 1);

  const todayRemainingRows = (collections || []).filter((item) => {
    if (item.date !== today) return false;
    return Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)) > 0;
  });
  const todayRemainingAmount = todayRemainingRows.reduce(
    (sum, item) => sum + Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)),
    0,
  );
  const todayRemainingCustomers = new Set(todayRemainingRows.map((item) => item.customerId)).size;
  const totalExpenses = (expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const collectedOn = (dateKey) => (payments || [])
    .filter((item) => item.date === dateKey && item.direction === 'in' && (item.type === 'Collection' || item.type === 'Document Charge'))
    .reduce((sum, item) => sum + Number(item.collectionAmount ?? item.amount ?? 0), 0);
  const expensesOn = (dateKey) => (expenses || [])
    .filter((item) => item.date === dateKey)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const dueOn = (dateKey) => (collections || [])
    .filter((item) => item.date === dateKey && String(item.status || '').toLowerCase() !== 'cancelled')
    .reduce((sum, item) => sum + Number(item.dueAmount || 0), 0);

  const dayTrend = (todayValue, yesterdayValue) => {
    if (yesterdayValue <= 0) return null;
    return Math.round(((todayValue - yesterdayValue) / yesterdayValue) * 100);
  };

  const collectedTodayAmount = collectedOn(today);
  const collectedTrend = dayTrend(collectedTodayAmount, collectedOn(yesterday));
  const expensesTrend = dayTrend(expensesOn(today), expensesOn(yesterday));
  const dueTodayTrend = dayTrend(dueOn(today), dueOn(yesterday));

  const lastMonthCutoffDate = new Date();
  lastMonthCutoffDate.setDate(1);
  lastMonthCutoffDate.setDate(0);
  const lastMonthCutoff = toInputDate(lastMonthCutoffDate);
  const monthTrend = (currentValue, list, predicate) => {
    const asOfLastMonth = predicate(list.filter((item) => String(item.date || item.startDate || '').slice(0, 10) <= lastMonthCutoff));
    if (asOfLastMonth <= 0) return null;
    return Math.round(((currentValue - asOfLastMonth) / asOfLastMonth) * 100);
  };

  const activeLoansTrend = monthTrend(
    metrics.activeLoans || 0,
    loans || [],
    (list) => list.filter((loan) => loan.status !== 'Closed').length,
  );
  const totalExpensesTrend = monthTrend(
    totalExpenses,
    expenses || [],
    (list) => list.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );

  const cycleTargets = calculateCycleTargets(loans);
  const dailyTarget = cycleTargets.daily;
  const weeklyTarget = cycleTargets.weekly;
  const monthlyTarget = cycleTargets.monthly;
  const canViewCapital = hasPermission('capital.view');

  const todayStats = [
    {
      title: "Today's Collection",
      value: formatCurrency(todayRemainingAmount),
      note: `${todayRemainingCustomers} customers pending today`,
      trend: dueTodayTrend,
      trendLabel: 'vs yesterday',
      icon: WalletCards,
      tone: 'green',
      onClick: () => navigate('/collection?view=today'),
    },
    {
      title: 'Collected Today',
      value: formatCurrency(collectedTodayAmount),
      note: 'Actual collections received',
      trend: collectedTrend,
      trendLabel: 'vs yesterday',
      icon: WalletMinimal,
      tone: 'blue',
      onClick: () => navigate('/payments?filter=Collection&today=1'),
    },
    {
      title: "Today's Expenses",
      value: formatCurrency(metrics.todayExpenses),
      note: 'Business expenses',
      trend: expensesTrend,
      trendLabel: 'vs yesterday',
      icon: ReceiptText,
      tone: 'pink',
      onClick: () => navigate('/expenses'),
    },
  ];

  const overviewStats = [
    ...(canViewCapital ? [{
      title: 'Available Capital',
      value: formatCurrency(metrics.availableCapital ?? capitalMetrics.availableCapital),
      note: capitalMetrics.entries ? 'Cash available for lending' : 'Add opening investment',
      trend: null,
      trendLabel: 'Current business cash',
      icon: Landmark,
      tone: 'purple',
      onClick: () => navigate('/capital'),
    }] : []),
    {
      title: 'Active Loans',
      value: String(metrics.activeLoans || 0),
      note: 'Currently active loans',
      trend: activeLoansTrend,
      trendLabel: 'vs last month',
      icon: UserRoundCheck,
      tone: 'blue',
      onClick: () => navigate('/loans?status=Active'),
    },
    {
      title: 'Pending Amount',
      value: formatCurrency(metrics.pendingOverdue),
      note: `${formatCurrency(metrics.pending)} due today · ${formatCurrency(metrics.overdue)} overdue`,
      trend: null,
      trendLabel: `${formatCurrency(metrics.pending)} due today`,
      icon: CircleDollarSign,
      tone: 'orange',
      onClick: () => navigate('/collection?view=overdue'),
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      note: 'All recorded expenses',
      trend: totalExpensesTrend,
      trendLabel: 'vs last month',
      icon: ReceiptText,
      tone: 'red',
      onClick: () => navigate('/expenses'),
    },
  ];

  const targetStats = [
    {
      title: 'Daily Target',
      value: `${formatCurrency(dailyTarget.amount)} / ${dailyTarget.customerCount}`,
      note: `${dailyTarget.customerCount} daily customers`,
      icon: WalletCards,
      tone: 'blue',
      onClick: () => navigate('/customers/daily'),
    },
    {
      title: 'Weekly Target',
      value: `${formatCurrency(weeklyTarget.amount)} / ${weeklyTarget.customerCount}`,
      note: `${weeklyTarget.customerCount} weekly customers`,
      icon: WalletCards,
      tone: 'green',
      onClick: () => navigate('/customers/weekly'),
    },
    {
      title: 'Monthly Target',
      value: `${formatCurrency(monthlyTarget.amount)} / ${monthlyTarget.customerCount}`,
      note: `${monthlyTarget.customerCount} monthly customers`,
      icon: WalletCards,
      tone: 'purple',
      onClick: () => navigate('/customers/monthly'),
    },
  ];

  const welcomeName = user?.displayName || user?.name || company?.owner || 'Owner';

  return (
    <div className="dashboard-page dashboard-reference-page">
      <section className="dashboard-reference-hero app-card">
        <div className="dashboard-reference-welcome">
          <span className="dashboard-reference-kicker">WELCOME</span>
          <h2>Welcome, {welcomeName}</h2>
          <p>Your finance overview at a glance.</p>
        </div>

        <div className="dashboard-reference-date" aria-label={`${formatHeroDay(today)}, ${formatHeroDate(today)}`}>
          <span>{formatHeroDay(today)}</span>
          <strong>{formatHeroDate(today)}</strong>
        </div>

      </section>

      <div className="dashboard-reference-board">
        <main className="dashboard-reference-main">
          <DashboardSection
            id="stats-today-heading"
            title="Today's Collection"
            subtitle="Your collection activity for today"
            columns="metric-grid-three"
            className="dashboard-reference-today"
          >
            {todayStats.map((stat) => <HomeMetricCard key={stat.title} {...stat} />)}
          </DashboardSection>

          <DashboardSection
            id="stats-overview-heading"
            title="Overview"
            subtitle="Key metrics for your lending business"
            columns="metric-grid-four"
            className="dashboard-reference-overview"
          >
            {overviewStats.map((stat) => <HomeMetricCard key={stat.title} {...stat} />)}
          </DashboardSection>

          <DashboardSection
            id="stats-collection-target-heading"
            title="Collection Target"
            subtitle="Cycle-wise standing collection target"
            columns="metric-grid-three"
            className="dashboard-reference-target"
          >
            {targetStats.map((stat) => <HomeMetricCard key={stat.title} {...stat} />)}
          </DashboardSection>

          <div className="dashboard-reference-lower-grid">
            <section className="dashboard-reference-collection-list" aria-label="Today's collection list">
              <CollectionTable />
            </section>
            <CollectionSummary />
          </div>
        </main>

        <aside className="dashboard-reference-side" aria-label="Home quick access and risky overdue customers">
          <div className="dashboard-reference-quick" aria-label="Quick actions">
            <QuickActions />
          </div>
          <RiskyOverdueCustomers />
        </aside>
      </div>
    </div>
  );
}
