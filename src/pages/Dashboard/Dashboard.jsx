import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Landmark,
  ReceiptText,
  TrendingUp,
  UserRoundCheck,
  WalletCards,
  WalletMinimal,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CollectionTable from '../../components/dashboard/CollectionTable';
import QuickActions from '../../components/dashboard/QuickActions';
import StatCard from '../../components/dashboard/StatCard';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import { calculateCycleTargets } from '../../utils/collectionTargets';
import './Dashboard.css';

const TREND_DAYS = 7;

function subtractDays(dateString, days) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDayShort(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { weekday: 'short' });
}

export default function Dashboard() {
  const { metrics, capitalMetrics, collections, loans, expenses, payments, company } = useCrednivo();
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const today = toInputDate();

  const collectionProgress = metrics.expected > 0
    ? Math.min(100, Math.max(0, (metrics.collected / metrics.expected) * 100))
    : 0;

  const todayRemainingRows = (collections || []).filter((item) => {
    if (item.date !== today) return false;
    return Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)) > 0;
  });
  const todayRemainingAmount = todayRemainingRows.reduce(
    (sum, item) => sum + Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)),
    0,
  );
  const todayRemainingCustomers = new Set(todayRemainingRows.map((item) => item.customerId)).size;

  const canViewCapital = hasPermission('capital.view');
  const totalExpenses = (expenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const cycleTargets = calculateCycleTargets(loans);
  const dailyTarget = cycleTargets.daily;
  const weeklyTarget = cycleTargets.weekly;
  const monthlyTarget = cycleTargets.monthly;

  const dashboardStatsToday = [
    {
      title: "Today's Collection",
      value: formatCurrency(todayRemainingAmount),
      note: `${todayRemainingCustomers} customers remaining`,
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
      note: 'Currently active',
      icon: UserRoundCheck,
      tone: 'cyan',
      showProgress: false,
      onDetails: () => navigate('/loans?status=Active'),
    },
    {
      title: 'Pending Amount',
      value: formatCurrency(metrics.pendingOverdue),
      note: `${formatCurrency(metrics.pending)} due today · ${formatCurrency(metrics.overdue)} overdue`,
      icon: CircleDollarSign,
      tone: 'orange',
      showProgress: false,
      onDetails: () => navigate('/collection?view=overdue'),
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      note: 'All recorded expenses',
      icon: ReceiptText,
      tone: 'pink',
      showProgress: false,
      onDetails: () => navigate('/expenses'),
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

  const trendData = useMemo(() => {
    const days = Array.from({ length: TREND_DAYS }, (_, index) => subtractDays(today, TREND_DAYS - 1 - index));
    return days.map((date) => {
      const value = (payments || [])
        .filter((item) => item.date === date && item.direction === 'in' && (item.type === 'Collection' || item.type === 'Document Charge'))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return {
        date,
        label: formatDayShort(date),
        value,
      };
    });
  }, [payments, today]);

  const trendMax = Math.max(...trendData.map((item) => item.value), 1);

  const recentCollections = useMemo(() => {
    return [...(payments || [])]
      .filter((item) => item.direction === 'in' && (item.type === 'Collection' || item.type === 'Document Charge'))
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCompare !== 0) return dateCompare;
        return Number(b.amount || 0) - Number(a.amount || 0);
      })
      .slice(0, 5);
  }, [payments]);

  const recentExpenses = useMemo(() => {
    return [...(expenses || [])]
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCompare !== 0) return dateCompare;
        return Number(b.amount || 0) - Number(a.amount || 0);
      })
      .slice(0, 5);
  }, [expenses]);

  const welcomeName = user?.displayName || user?.name || company?.owner || 'Owner';

  return (
    <div className="dashboard-page dashboard-premium-page">
      <div className="dashboard-toolbar">
        <button className="date-button" title="Dashboard date"><CalendarDays size={15} /> {formatDate(today)}</button>
      </div>

      <section className="dashboard-hero app-card">
        <div className="dashboard-hero-copy">
          <span className="dashboard-hero-kicker">CREDNIVO HOME</span>
          <h2>Welcome Back, {welcomeName.split(' ')[0]}!</h2>
          <p>Here&apos;s today&apos;s finance overview for {company?.name || 'your business'}.</p>
          <button type="button" className="dashboard-hero-chip" onClick={() => navigate('/collection')}>
            <TrendingUp size={18} />
            <span>
              <strong>Keep growing!</strong>
              <small>Your collections are moving forward today.</small>
            </span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="dashboard-hero-visual" aria-hidden="true">
          <div className="hero-floating hero-rupee">₹</div>
          <div className="hero-floating hero-bars"></div>
          <div className="hero-card hero-chart-card">
            <div className="hero-chart-line"></div>
            <div className="hero-chart-bars">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div className="hero-coin-stack"><span></span><span></span><span></span></div>
          <div className="hero-note">Stronger Businesses<br />Brighter Tomorrows</div>
        </div>
      </section>

      <QuickActions />

      <section className="stats-section dashboard-section-shell" aria-labelledby="stats-today-heading">
        <div className="section-shell-head">
          <div>
            <h2 id="stats-today-heading" className="stats-section-title">Today&apos;s Collection</h2>
            <p>Your collection activity for today</p>
          </div>
        </div>
        <div className="stats-grid">
          {dashboardStatsToday.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </section>

      <section className="stats-section dashboard-section-shell" aria-labelledby="stats-business-heading">
        <div className="section-shell-head">
          <div>
            <h2 id="stats-business-heading" className="stats-section-title">Business Overview</h2>
            <p>Key metrics for your lending business</p>
          </div>
        </div>
        <div className="stats-grid">
          {dashboardStatsBusiness.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </section>

      <section className="stats-section dashboard-section-shell" aria-labelledby="stats-collection-target-heading">
        <div className="section-shell-head">
          <div>
            <h2 id="stats-collection-target-heading" className="stats-section-title">Collection Target</h2>
            <p>Cycle wise standing collection target</p>
          </div>
        </div>
        <div className="stats-grid">
          {dashboardStatsTarget.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </section>

      <section className="dashboard-insights-grid">
        <article className="dashboard-insight-card app-card">
          <div className="dashboard-insight-head">
            <div>
              <h3>Collection Trend</h3>
              <p>Last 7 days</p>
            </div>
          </div>
          <div className="trend-chart">
            {trendData.map((item) => (
              <div key={item.date} className="trend-bar-item">
                <div className="trend-bar-wrap">
                  <div
                    className="trend-bar"
                    style={{ height: `${Math.max(8, Math.round((item.value / trendMax) * 100))}%` }}
                    title={`${item.label}: ${formatCurrency(item.value)}`}
                  />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="trend-highlight">
            <strong>{formatCurrency(trendData.reduce((sum, item) => sum + item.value, 0))}</strong>
            <small>Total collected in the last 7 days</small>
          </div>
        </article>

        <article className="dashboard-insight-card app-card">
          <div className="dashboard-insight-head">
            <div>
              <h3>Recent Collections</h3>
              <p>Latest received payments</p>
            </div>
            <button type="button" className="insight-link" onClick={() => navigate('/payments?filter=Collection')}>View all</button>
          </div>
          <div className="insight-list">
            {recentCollections.length ? recentCollections.map((item, index) => (
              <div key={`${item.id || item.date}-${index}`} className="insight-row">
                <div className="insight-avatar">{String(item.customerName || item.type || 'C').slice(0, 2).toUpperCase()}</div>
                <div className="insight-row-copy">
                  <strong>{item.customerName || item.type || 'Collection'}</strong>
                  <span>{formatDate(item.date)}{item.loanId ? ` · ${item.loanId}` : ''}</span>
                </div>
                <div className="insight-row-value success">{formatCurrency(item.amount || 0)}</div>
              </div>
            )) : <div className="empty-mini-state">No recent collections yet.</div>}
          </div>
        </article>

        <article className="dashboard-insight-card app-card">
          <div className="dashboard-insight-head">
            <div>
              <h3>Expense Snapshot</h3>
              <p>No pie chart — simple readable list</p>
            </div>
            <button type="button" className="insight-link" onClick={() => navigate('/expenses')}>View details</button>
          </div>
          <div className="expense-snapshot-total">
            <strong>{formatCurrency(totalExpenses)}</strong>
            <small>Total recorded expenses</small>
          </div>
          <div className="insight-list compact">
            {recentExpenses.length ? recentExpenses.map((item, index) => (
              <div key={`${item.id || item.date}-${index}`} className="insight-row compact">
                <div className="insight-row-copy">
                  <strong>{item.title || item.category || item.note || 'Expense'}</strong>
                  <span>{formatDate(item.date)}</span>
                </div>
                <div className="insight-row-value danger">{formatCurrency(item.amount || 0)}</div>
              </div>
            )) : <div className="empty-mini-state">No expenses recorded yet.</div>}
          </div>
        </article>
      </section>

      <section className="dashboard-middle"><CollectionTable /></section>
    </div>
  );
}
