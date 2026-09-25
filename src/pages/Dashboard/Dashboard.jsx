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
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import { calculateCycleTargets } from '../../utils/collectionTargets';
import growthBanner from '../../assets/crednivo-growth-banner.jpg';
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

function formatHeroDate(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function monthBounds(dateString, offset = 0) {
  const [year, month] = String(dateString).split('-').map(Number);
  const start = new Date(year, month - 1 + offset, 1);
  const end = new Date(year, month + offset, 0);
  const toKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: toKey(start), end: toKey(end) };
}

function calculateCollectionRate(rows, startDate, endDate) {
  const scoped = (rows || []).filter((item) => {
    if (!item?.date || item.date < startDate || item.date > endDate) return false;
    const status = String(item.status || '').trim().toLowerCase();
    return status !== 'cancelled' && status !== 'canceled';
  });
  const due = scoped.reduce((sum, item) => sum + Math.max(0, Number(item.dueAmount || 0)), 0);
  const paid = scoped.reduce((sum, item) => sum + Math.max(0, Number(item.paidAmount || 0)), 0);
  if (due <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((paid / due) * 100)));
}

function HomeMetricCard({ title, value, note, trend, trendLabel, icon: Icon, tone = 'blue', onClick, variant = 'default' }) {
  return (
    <button
      type="button"
      className={`home-metric-card tone-${tone} ${variant === 'compact' ? 'is-compact' : ''}`}
      onClick={onClick}
      aria-label={`${title}: ${value}. ${note}.`}
    >
      <span className="home-metric-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
      {variant === 'compact' ? (
        <>
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
        </>
      ) : (
        <>
          <div className="home-metric-body">
            <span className="home-metric-icon"><Icon size={18} strokeWidth={2.1} /></span>
            <div className="home-metric-copy">
              <p>{title}</p>
              <strong>{value}</strong>
              <div className="home-metric-trend-row">
                {trend !== null && trend !== undefined && (
                  <span className={`home-metric-trend ${trend < 0 ? 'is-down' : 'is-up'}`}>
                    {trend < 0 ? '↓' : '↑'} {Math.abs(Number(trend))}%
                  </span>
                )}
                <small>{trendLabel || note}</small>
              </div>
            </div>
          </div>
          <span className="home-metric-graphic" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </>
      )}
    </button>
  );
}

export default function Dashboard() {
  const { metrics, capitalMetrics, collections, loans, expenses, payments, company } = useCrednivo();
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const today = toInputDate();
  const currentWeekDay = (() => {
    const [year, month, day] = today.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', { weekday: 'long' });
  })();

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

  // Real day-over-day comparisons — computed the same way for both days so
  // the comparison is apples-to-apples, not mixed with a backend aggregate.
  const yesterday = subtractDays(today, 1);
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

  // Real month-over-month comparisons — same "as of end of last month"
  // cutoff pattern already used on the Loans page.
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
    (list) => list.filter((l) => l.status !== 'Closed').length,
  );
  const totalExpensesTrend = monthTrend(
    totalExpenses,
    expenses || [],
    (list) => list.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );

  const canViewCapital = hasPermission('capital.view');

  const cycleTargets = calculateCycleTargets(loans);
  const dailyTarget = cycleTargets.daily;
  const weeklyTarget = cycleTargets.weekly;
  const monthlyTarget = cycleTargets.monthly;

  const dashboardStatsToday = [
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

  const dashboardStatsBusiness = [
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

  const dashboardStatsTarget = [
    {
      title: 'Daily Target',
      value: `${formatCurrency(dailyTarget.amount)} / ${dailyTarget.customerCount}`,
      note: `${dailyTarget.customerCount} daily customers`,
      trend: null,
      trendLabel: `${dailyTarget.customerCount} daily customers`,
      icon: WalletCards,
      tone: 'blue',
      onClick: () => navigate('/customers/daily'),
    },
    {
      title: 'Weekly Target',
      value: `${formatCurrency(weeklyTarget.amount)} / ${weeklyTarget.customerCount}`,
      note: `${weeklyTarget.customerCount} weekly customers`,
      trend: null,
      trendLabel: `${weeklyTarget.customerCount} weekly customers`,
      icon: WalletCards,
      tone: 'green',
      onClick: () => navigate('/customers/weekly'),
    },
    {
      title: 'Monthly Target',
      value: `${formatCurrency(monthlyTarget.amount)} / ${monthlyTarget.customerCount}`,
      note: `${monthlyTarget.customerCount} monthly customers`,
      trend: null,
      trendLabel: `${monthlyTarget.customerCount} monthly customers`,
      icon: WalletCards,
      tone: 'purple',
      onClick: () => navigate('/customers/monthly'),
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
  const currentMonth = monthBounds(today, 0);
  const previousMonth = monthBounds(today, -1);
  const currentMonthCollectionRate = calculateCollectionRate(collections, currentMonth.start, today);
  const previousMonthCollectionRate = calculateCollectionRate(collections, previousMonth.start, previousMonth.end);

  return (
    <div className="dashboard-page dashboard-premium-page dashboard-exact-page">
      <section className="dashboard-hero dashboard-hero-exact app-card">
        <div className="dashboard-hero-copy">
          <h2>Welcome Back!</h2>
          <p>Here&apos;s today&apos;s finance overview</p>
          <div className="dashboard-hero-date"><CalendarDays size={15} /><span>{formatHeroDate(today)}</span></div>
          <button type="button" className="dashboard-hero-chip dashboard-month-compare" onClick={() => navigate('/reports')}>
            <TrendingUp size={18} className="month-compare-icon" />
            <span className="month-compare-copy">
              <strong>Keep growing</strong>
              <small>Monthly collection performance</small>
            </span>
            <span className="month-compare-stats">
              <span className="month-compare-item">
                <small>Previous Month</small>
                <strong>{previousMonthCollectionRate}%</strong>
              </span>
              <span className="month-compare-divider" aria-hidden="true" />
              <span className="month-compare-item current">
                <small>Current Month</small>
                <strong>{currentMonthCollectionRate}%</strong>
              </span>
            </span>
            <ArrowRight size={16} className="month-compare-arrow" />
          </button>
        </div>

        <div className="dashboard-hero-visual exact-hero-visual" aria-hidden="true">
          <div className="exact-hero-floor"></div>
          <div className="exact-hero-rupee">₹</div>
          <div className="exact-hero-plant">
            <span></span><span></span><span></span>
          </div>
          <div className="exact-hero-graph-panel">
            <div className="exact-bars"><span></span><span></span><span></span><span></span></div>
            <div className="exact-arrow"></div>
          </div>
          <div className="exact-hero-mini-card exact-mini-bars"></div>
          <div className="exact-hero-mini-card exact-mini-coins"><span></span><span></span><span></span></div>
          <div className="exact-hero-note">Stronger<br />Businesses<br />Brighter Tomorrows</div>
        </div>
      </section>

      <div className="dashboard-today-layout">
        <section className="stats-section dashboard-section-shell exact-shell dashboard-today-section" aria-labelledby="stats-today-heading">
          <div className="section-shell-head exact-head">
            <div>
              <h2 id="stats-today-heading" className="stats-section-title">Today&apos;s Collection</h2>
              <p>Your collection activity for today</p>
            </div>
            <button type="button" className="section-chip-button">{currentWeekDay}</button>
          </div>
          <div className="home-metric-grid metric-grid-three">
            {dashboardStatsToday.map((stat) => <HomeMetricCard key={stat.title} {...stat} variant="compact" />)}
          </div>
        </section>

        <div className="dashboard-quick-side">
          <QuickActions />
        </div>
      </div>

      <section className="stats-section dashboard-section-shell exact-shell" aria-labelledby="stats-business-heading">
        <div className="section-shell-head exact-head">
          <div>
            <h2 id="stats-business-heading" className="stats-section-title">Business Overview</h2>
            <p>Key metrics for your lending business</p>
          </div>
        </div>
        <div className="home-metric-grid metric-grid-four">
          {dashboardStatsBusiness.map((stat) => <HomeMetricCard key={stat.title} {...stat} variant="compact" />)}
        </div>
      </section>

      <section className="stats-section dashboard-section-shell exact-shell" aria-labelledby="stats-collection-target-heading">
        <div className="section-shell-head exact-head">
          <div>
            <h2 id="stats-collection-target-heading" className="stats-section-title">Collection Target</h2>
            <p>Cycle wise standing collection target</p>
          </div>
        </div>
        <div className="home-metric-grid metric-grid-three">
          {dashboardStatsTarget.map((stat) => <HomeMetricCard key={stat.title} {...stat} variant="compact" />)}
        </div>
      </section>

      <section className="dashboard-middle"><CollectionTable /></section>


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
              <p>Simple readable list</p>
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

      <div className="dashboard-growth-banner">
        <img src={growthBanner} alt="Grow your lending business with Crednivo" loading="lazy" />
      </div>
    </div>
  );
}
