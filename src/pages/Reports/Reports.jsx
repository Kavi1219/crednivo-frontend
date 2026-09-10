import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Eye,
  HandCoins,
  Landmark,
  Printer,
  ReceiptText,
  Search,
  TriangleAlert,
  UserPlus,
  UsersRound,
  Wallet,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { downloadCsv, formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Reports.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatDateInputDisplay(dateKey) {
  if (!dateKey) return 'DD-MM-YYYY';
  const [year, month, day] = String(dateKey).split('-');
  if (!year || !month || !day) return 'DD-MM-YYYY';
  return `${day}-${month}-${year}`;
}

function getMonthMeta(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
  return {
    year,
    month,
    days: lastDay,
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
    label,
  };
}

function emptyMonthlyReport(monthKey) {
  const month = getMonthMeta(monthKey);
  return {
    month,
    overallCollected: 0,
    overallExpected: 0,
    overallPending: 0,
    expenseTotal: 0,
    newLoansGiven: 0,
    overdueAmount: 0,
    netCash: 0,
    openingCapital: 0,
    capitalAdded: 0,
    capitalWithdrawn: 0,
    closingCapital: 0,
    availableCapitalAtMonthEnd: 0,
    newCustomers: 0,
    newLoans: 0,
    closedLoans: 0,
    pendingCustomers: 0,
    overdueCustomers: 0,
    cycles: ['Daily', 'Weekly', 'Monthly'].map((cycle) => ({
      cycle,
      expected: 0,
      collected: 0,
      pending: 0,
      customers: 0,
      loans: 0,
      rate: 0,
    })),
    trend: Array.from({ length: month.days }, (_, index) => ({ day: index + 1, amount: 0 })),
  };
}

function mapMonthlyReport(payload, monthKey) {
  const base = emptyMonthlyReport(monthKey);
  if (!payload) return base;

  const cycleRows = Array.isArray(payload.cycles) ? payload.cycles : [];
  const cycles = ['Daily', 'Weekly', 'Monthly'].map((cycle) => {
    const item = cycleRows.find((row) => String(row.cycle || '').toLowerCase() === cycle.toLowerCase()) || {};
    return {
      cycle,
      expected: numberValue(item.expected),
      collected: numberValue(item.collected),
      pending: numberValue(item.pending),
      customers: numberValue(item.customers),
      loans: numberValue(item.loans),
      rate: numberValue(item.collectionPercent),
    };
  });

  const trendByDay = new Map();
  (payload.dailyTrend || []).forEach((item) => {
    const day = Number(String(item.date || '').slice(8, 10));
    if (day >= 1 && day <= base.month.days) trendByDay.set(day, numberValue(item.amount));
  });

  const finance = payload.finance || {};
  const activity = payload.activity || {};
  const recovery = payload.recovery || {};
  const collections = payload.collections || {};

  return {
    ...base,
    cycles,
    overallCollected: numberValue(collections.overall ?? finance.collected),
    overallExpected: numberValue(finance.expected),
    overallPending: numberValue(finance.pending),
    expenseTotal: numberValue(finance.expenses),
    newLoansGiven: numberValue(finance.newLoansGiven),
    overdueAmount: numberValue(finance.overdue),
    netCash: numberValue(finance.netCashFlow),
    openingCapital: numberValue(finance.openingCapital),
    capitalAdded: numberValue(finance.investmentAdded),
    capitalWithdrawn: numberValue(finance.capitalWithdrawn),
    closingCapital: numberValue(finance.closingCapital),
    availableCapitalAtMonthEnd: numberValue(finance.availableBusinessCash),
    newCustomers: numberValue(activity.newCustomers),
    newLoans: numberValue(activity.newLoans),
    closedLoans: numberValue(activity.closedLoans),
    pendingCustomers: numberValue(recovery.pendingCustomers),
    overdueCustomers: numberValue(recovery.overdueCustomers),
    trend: Array.from({ length: base.month.days }, (_, index) => ({
      day: index + 1,
      amount: trendByDay.get(index + 1) || 0,
    })),
  };
}

function inRange(date, fromDate, toDate) {
  if (!date) return false;
  return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
}

function collectionDisplayStatus(item) {
  const due = numberValue(item?.dueAmount);
  const paid = numberValue(item?.paidAmount);
  const date = String(item?.date || '');
  const today = toInputDate();
  if (due > 0 && paid >= due) return 'Paid';
  if (paid > 0) return 'Pending';
  if (date && date < today) return 'Overdue';
  if (date === today) return 'Due Today';
  return 'Upcoming';
}

function getQuickRange(type) {
  const today = new Date();
  const todayKey = toInputDate(today);
  const start = new Date(today);

  if (type === 'today') return { from: todayKey, to: todayKey };

  if (type === 'week') {
    const day = today.getDay() || 7;
    start.setDate(today.getDate() - day + 1);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      from: toInputDate(start),
      to: toInputDate(end),
    };
  }

  const month = getMonthMeta(todayKey.slice(0, 7));
  return { from: month.start, to: month.end };
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

function getSundayWeekRange(dateKey = toInputDate()) {
  const date = new Date(`${dateKey}T00:00:00`);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const from = toInputDate(start);
  return { from, to: addDays(from, 6) };
}

function percentage(part, total) {
  return total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;
}

function signedCurrency(value) {
  const amount = numberValue(value);
  if (amount === 0) return formatCurrency(0);
  return `${amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(amount))}`;
}

function MetricCard({ icon: Icon, label, value, sub, tone = 'blue' }) {
  return (
    <article className={`reports-kpi reports-kpi-${tone}`}>
      <span className="reports-kpi-icon"><Icon size={20} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </article>
  );
}

function EmptyState({ children }) {
  return <div className="reports-empty">{children}</div>;
}

export default function Reports() {
  const {
    company,
    customers = [],
    loans = [],
    collections = [],
    payments = [],
    expenses = [],
    agents = [],
    capitalMetrics,
  } = useCrednivo();
  const customerPhotoById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.photo || ''])),
    [customers],
  );
  const { isOwner, user, hasPermission } = useAuth();
  const navigate = useNavigate();

  const monthDefault = toInputDate().slice(0, 7);
  const [view, setView] = useState('overview');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [cycle, setCycle] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState(monthDefault);
  const [monthlyReport, setMonthlyReport] = useState(() => emptyMonthlyReport(monthDefault));
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState('');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [collectionStatus, setCollectionStatus] = useState('All');
  const [collectionApiReport, setCollectionApiReport] = useState(null);
  const [collectionApiLoading, setCollectionApiLoading] = useState(false);
  const [collectionApiError, setCollectionApiError] = useState('');
  const [selectedOverviewCycle, setSelectedOverviewCycle] = useState('Daily');
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => getSundayWeekRange(toInputDate()).from);

  useEffect(() => {
    if (view !== 'statement') return undefined;
    let active = true;
    const load = async () => {
      const month = getMonthMeta(selectedMonth);
      setMonthlyLoading(true);
      setMonthlyError('');
      try {
        const payload = await apiRequest(`/reports/monthly?year=${month.year}&month=${month.month}`);
        if (active) setMonthlyReport(mapMonthlyReport(payload, selectedMonth));
      } catch (error) {
        if (active) {
          setMonthlyReport(emptyMonthlyReport(selectedMonth));
          setMonthlyError(error?.message || 'Unable to load monthly statement.');
        }
      } finally {
        if (active) setMonthlyLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [selectedMonth, view]);

  useEffect(() => {
    if (view !== 'collection') return undefined;
    let active = true;
    const load = async () => {
      setCollectionApiLoading(true);
      setCollectionApiError('');
      try {
        const payload = await apiRequest(`/reports/collections?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}&cycle=${encodeURIComponent(cycle)}`);
        if (active) setCollectionApiReport(payload || { rows: [] });
      } catch (error) {
        if (active) {
          setCollectionApiReport(null);
          setCollectionApiError(error?.message || 'Unable to load the detailed collection report from the database.');
        }
      } finally {
        if (active) setCollectionApiLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [view, fromDate, toDate, cycle]);

  const loanMap = useMemo(() => Object.fromEntries(loans.map((loan) => [loan.id, loan])), [loans]);

  const filteredCollections = useMemo(() => collections.filter((item) => {
    const matchesDate = inRange(item.date, fromDate, toDate);
    const matchesCycle = cycle === 'All' || item.cycle === cycle;
    return matchesDate && matchesCycle;
  }), [collections, fromDate, toDate, cycle]);

  const filteredPayments = useMemo(() => payments.filter((item) => {
    if (!inRange(item.date, fromDate, toDate)) return false;
    if (cycle === 'All') return true;
    const linkedLoan = loanMap[item.loanId];
    return linkedLoan?.cycle === cycle;
  }), [payments, fromDate, toDate, cycle, loanMap]);

  const filteredExpenses = useMemo(
    () => expenses.filter((item) => inRange(item.date, fromDate, toDate)),
    [expenses, fromDate, toDate],
  );

  const filteredLoans = useMemo(() => loans.filter((loan) => {
    const startDate = loan.startDate || loan.loanDate || '';
    const matchesDate = startDate ? inRange(startDate, fromDate, toDate) : true;
    const matchesCycle = cycle === 'All' || loan.cycle === cycle;
    return matchesDate && matchesCycle;
  }), [loans, fromDate, toDate, cycle]);

  const currentTotalOutstanding = useMemo(() => {
    if (capitalMetrics && Number.isFinite(Number(capitalMetrics.loanBookOutstanding))) {
      return numberValue(capitalMetrics.loanBookOutstanding);
    }
    return loans
      .filter((loan) => String(loan.status || '').toLowerCase() === 'active')
      .reduce((sum, loan) => sum + numberValue(loan.outstanding), 0);
  }, [capitalMetrics, loans]);

  const currentInHandAmount = useMemo(() => {
    if (capitalMetrics && Number.isFinite(Number(capitalMetrics.availableCapital))) {
      return numberValue(capitalMetrics.availableCapital);
    }
    return 0;
  }, [capitalMetrics]);

  const overview = useMemo(() => {
    const expected = filteredCollections.reduce((sum, item) => sum + numberValue(item.dueAmount), 0);

    // Overview "Collected" must represent ACTUAL customer money received in
    // the selected payment-date range, including IO principal repayments and
    // early loan payments. Scheduled recovery remains separate below in
    // Cycle Performance and must continue to follow collection schedule rows.
    const collectionPayments = filteredPayments.filter(
      (item) => item.type === 'Collection' && item.direction === 'in',
    );
    const collected = collectionPayments.reduce(
      (sum, item) => sum + numberValue(item.collectionAmount ?? item.amount),
      0,
    );
    const scheduledCollected = filteredCollections.reduce(
      (sum, item) => sum + numberValue(item.paidAmount),
      0,
    );

    const pending = filteredCollections.reduce(
      (sum, item) => sum + Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount)),
      0,
    );
    const today = toInputDate();
    const overdueRows = filteredCollections.filter((item) => item.date < today && item.status !== 'Paid' && numberValue(item.paidAmount) < numberValue(item.dueAmount));
    const overdue = overdueRows.reduce(
      (sum, item) => sum + Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount)),
      0,
    );
    const incoming = filteredPayments.filter((item) => item.direction === 'in').reduce((sum, item) => sum + numberValue(item.amount), 0);
    const outgoing = filteredPayments.filter((item) => item.direction === 'out').reduce((sum, item) => sum + numberValue(item.amount), 0);
    const loanGiven = filteredPayments
      .filter((item) => item.type === 'New Loan' && item.direction === 'out')
      .reduce((sum, item) => sum + numberValue(item.amount), 0);
    const expenseTotal = filteredExpenses.reduce((sum, item) => sum + numberValue(item.amount), 0);
    const netCash = incoming - outgoing;

    // Recovery percentage belongs to scheduled collection performance only.
    // Principal settlements must not inflate the recovery rate.
    const recovery = expected > 0 ? Math.min(100, (scheduledCollected / expected) * 100) : 0;

    return {
      expected,
      collected,
      scheduledCollected,
      collectionPaymentCount: collectionPayments.length,
      pending,
      overdue,
      incoming,
      outgoing,
      loanGiven,
      expenseTotal,
      netCash,
      recovery,
      overdueRows,
    };
  }, [filteredCollections, filteredPayments, filteredExpenses]);

  // Daily / Weekly / Monthly overview cards are portfolio totals, not payment totals.
  // Example: three active Daily loans with Collection / Cycle values of
  // ₹100 + ₹50 + ₹600 must show Daily Collection = ₹750, regardless of how
  // much has already been received or is pending in the selected report period.
  const overviewRangeCollections = useMemo(() => collections.filter(
    (item) => inRange(item.date, fromDate, toDate),
  ), [collections, fromDate, toDate]);

  const overviewRangeCollectionPayments = useMemo(() => payments.filter((item) => (
    inRange(item.date, fromDate, toDate)
    && item.type === 'Collection'
    && item.direction === 'in'
  )), [payments, fromDate, toDate]);

  const overviewActiveLoans = useMemo(() => loans.filter((loan) => (
    String(loan.status || '').toLowerCase() !== 'closed'
    && numberValue(loan.outstanding) > 0
  )), [loans]);

  const overviewCycleCollections = useMemo(() => ['Daily', 'Weekly', 'Monthly'].map((itemCycle) => {
    const cycleLoans = overviewActiveLoans.filter(
      (loan) => String(loan.cycle || '').toLowerCase() === itemCycle.toLowerCase(),
    );

    const amount = cycleLoans.reduce(
      (sum, loan) => sum + numberValue(loan.collectionAmount),
      0,
    );
    const customerIds = new Set(cycleLoans.map((loan) => loan.customerId).filter(Boolean));

    return {
      cycle: itemCycle,
      amount,
      customerCount: customerIds.size,
      loanCount: cycleLoans.length,
    };
  }), [overviewActiveLoans]);

  const overviewHasDateFilter = Boolean(fromDate || toDate);

  // With no date selected, Overview is a live business snapshot.
  // Once a date is selected, period-sensitive cards use that selected range.
  const overviewPortfolioCollectionAmount = useMemo(
    () => overviewCycleCollections.reduce((sum, item) => sum + numberValue(item.amount), 0),
    [overviewCycleCollections],
  );

  const overviewCurrentPending = useMemo(() => {
    const today = toInputDate();
    return collections
      .filter((item) => String(item.status || '').toLowerCase() !== 'cancelled')
      .filter((item) => String(item.date || '') <= today)
      .reduce(
        (sum, item) => sum + Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount)),
        0,
      );
  }, [collections]);

  const overviewCollectionAmount = overviewHasDateFilter
    ? overview.expected
    : overviewPortfolioCollectionAmount;

  const overviewPendingAmount = overviewHasDateFilter
    ? overview.pending
    : overviewCurrentPending;

  const overviewFineIncome = useMemo(
    () => filteredPayments
      .filter((item) => item.direction === 'in')
      .reduce((sum, item) => sum + numberValue(item.fineAmount), 0),
    [filteredPayments],
  );

  const overviewDocumentChargeIncome = useMemo(
    () => filteredPayments
      .filter((item) => {
        if (item.direction !== 'in') return false;
        const type = String(item.type || '').toLowerCase().replace(/[_-]+/g, ' ');
        const note = String(item.note || '').toLowerCase();
        const reference = String(item.referenceId || item.reference || '').toLowerCase();
        return type.includes('document charge')
          || note.includes('document charge')
          || reference.endsWith('-doc');
      })
      .reduce((sum, item) => sum + numberValue(item.amount), 0),
    [filteredPayments],
  );

  const overviewActiveLoanCount = overviewActiveLoans.length;
  const overviewCustomerCount = customers.length;

  const overviewRangeLabel = !fromDate && !toDate
    ? 'Overall live snapshot'
    : fromDate && toDate
      ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
      : fromDate
        ? `From ${formatDate(fromDate)}`
        : `Up to ${formatDate(toDate)}`;

  const overviewCycleStatusRows = useMemo(() => {
    const today = toInputDate();

    return ['Daily', 'Weekly', 'Monthly'].map((itemCycle) => {
      const cycleKey = itemCycle.toLowerCase();

      const portfolio = overviewCycleCollections.find(
        (item) => String(item.cycle || '').toLowerCase() === cycleKey,
      );

      const scheduleRows = collections.filter((item) => {
        if (String(item.cycle || '').toLowerCase() !== cycleKey) return false;
        if (String(item.status || '').toLowerCase() === 'cancelled') return false;
        if (!overviewHasDateFilter) return true;
        return inRange(item.date, fromDate, toDate);
      });

      const collectedPayments = payments.filter((item) => {
        if (item.type !== 'Collection' || item.direction !== 'in') return false;
        const paymentCycle = item.cycle || loanMap[item.loanId]?.cycle || '';
        if (String(paymentCycle).toLowerCase() !== cycleKey) return false;
        if (!overviewHasDateFilter) return true;
        return inRange(item.date, fromDate, toDate);
      });

      const collectedAmount = collectedPayments.reduce(
        (sum, item) => sum + numberValue(item.collectionAmount ?? item.amount),
        0,
      );

      const upcomingAmount = scheduleRows
        .filter((item) => String(item.date || '') > today)
        .reduce(
          (sum, item) => sum + Math.max(
            0,
            numberValue(item.dueAmount) - numberValue(item.paidAmount),
          ),
          0,
        );

      const pendingAmount = scheduleRows
        .filter((item) => String(item.date || '') <= today)
        .reduce(
          (sum, item) => sum + Math.max(
            0,
            numberValue(item.dueAmount) - numberValue(item.paidAmount),
          ),
          0,
        );

      return {
        cycle: itemCycle,
        overallCollectionAmount: numberValue(portfolio?.amount),
        collectedAmount,
        upcomingAmount,
        pendingAmount,
      };
    });
  }, [
    collections,
    payments,
    loanMap,
    overviewCycleCollections,
    overviewHasDateFilter,
    fromDate,
    toDate,
  ]);

  const overviewCycleCustomerRows = useMemo(() => {
    const selected = String(selectedOverviewCycle || 'Daily').toLowerCase();
    const grouped = new Map();

    const ensureRow = ({ customerId, customerName, loanId, itemCycle }) => {
      const key = `${customerId || 'unknown'}::${loanId || 'unknown'}`;
      if (!grouped.has(key)) {
        const linkedLoan = loanMap[loanId] || {};
        grouped.set(key, {
          key,
          customerId: customerId || linkedLoan.customerId || '',
          customerName: customerName || linkedLoan.customerName || 'Customer',
          loanId: loanId || linkedLoan.id || '',
          cycle: itemCycle || linkedLoan.cycle || selectedOverviewCycle,
          collectionPerCycle: numberValue(linkedLoan.collectionAmount),
          expected: 0,
          received: 0,
          pending: 0,
          outstanding: numberValue(linkedLoan.outstanding),
          hasOverdue: false,
          dueEntries: 0,
          paymentCount: 0,
        });
      }
      return grouped.get(key);
    };

    // Start with every currently active loan in the selected cycle so clicking
    // a card always shows all customers that make up that cycle total.
    overviewActiveLoans
      .filter((loan) => String(loan.cycle || '').toLowerCase() === selected)
      .forEach((loan) => {
        ensureRow({
          customerId: loan.customerId,
          customerName: loan.customerName,
          loanId: loan.id,
          itemCycle: loan.cycle,
        });
      });

    overviewRangeCollections
      .filter((item) => String(item.cycle || '').toLowerCase() === selected)
      .forEach((item) => {
        const row = ensureRow({
          customerId: item.customerId,
          customerName: item.customerName,
          loanId: item.loanId,
          itemCycle: item.cycle,
        });
        const due = numberValue(item.dueAmount);
        const paid = numberValue(item.paidAmount);
        row.expected += due;
        row.pending += Math.max(0, due - paid);
        row.dueEntries += 1;
        if (String(item.date || '') < toInputDate() && paid < due) row.hasOverdue = true;
      });

    overviewRangeCollectionPayments
      .filter((item) => {
        const paymentCycle = item.cycle || loanMap[item.loanId]?.cycle || '';
        return String(paymentCycle).toLowerCase() === selected;
      })
      .forEach((item) => {
        const linkedLoan = loanMap[item.loanId] || {};
        const row = ensureRow({
          customerId: item.customerId || linkedLoan.customerId,
          customerName: item.customerName || linkedLoan.customerName,
          loanId: item.loanId,
          itemCycle: item.cycle || linkedLoan.cycle,
        });
        row.received += numberValue(item.collectionAmount ?? item.amount);
        row.paymentCount += 1;
      });

    return [...grouped.values()]
      .map((row) => ({
        ...row,
        status: row.pending <= 0
          ? (row.expected > 0 ? 'Paid' : 'Received')
          : (row.hasOverdue ? 'Overdue' : 'Pending'),
      }))
      .sort((a, b) => String(a.customerName || '').localeCompare(String(b.customerName || ''))
        || String(a.loanId || '').localeCompare(String(b.loanId || '')));
  }, [selectedOverviewCycle, overviewActiveLoans, overviewRangeCollections, overviewRangeCollectionPayments, loanMap]);

  const selectedOverviewCycleSummary = overviewCycleCollections.find(
    (item) => item.cycle === selectedOverviewCycle,
  ) || overviewCycleCollections[0];

  const weeklyRange = useMemo(
    () => ({ from: weeklyStartDate, to: addDays(weeklyStartDate, 6) }),
    [weeklyStartDate],
  );

  const weeklyReport = useMemo(() => {
    const buildPeriod = (from, to) => {
      const rows = collections.filter((item) => {
        const status = String(item.status || '').toLowerCase();
        return inRange(item.date, from, to) && status !== 'cancelled';
      });

      const cycles = ['Daily', 'Weekly', 'Monthly'].map((itemCycle) => {
        const cycleRows = rows.filter(
          (item) => String(item.cycle || '').toLowerCase() === itemCycle.toLowerCase(),
        );
        const target = cycleRows.reduce((sum, item) => sum + numberValue(item.dueAmount), 0);
        const collected = cycleRows.reduce((sum, item) => {
          const due = numberValue(item.dueAmount);
          return sum + Math.min(due, numberValue(item.paidAmount));
        }, 0);
        const pending = cycleRows.reduce(
          (sum, item) => sum + Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount)),
          0,
        );

        const customerIds = new Set(cycleRows.map((item) => item.customerId).filter(Boolean));
        const pendingCustomerIds = new Set(
          cycleRows
            .filter((item) => numberValue(item.paidAmount) < numberValue(item.dueAmount))
            .map((item) => item.customerId)
            .filter(Boolean),
        );

        return {
          cycle: itemCycle,
          target,
          collected,
          pending,
          achievement: percentage(collected, target),
          customersDue: customerIds.size,
          fullyCollected: Math.max(0, customerIds.size - pendingCustomerIds.size),
          pendingCustomers: pendingCustomerIds.size,
        };
      });

      const pendingMap = new Map();
      rows.forEach((item) => {
        const due = numberValue(item.dueAmount);
        const paid = Math.min(due, numberValue(item.paidAmount));
        const pending = Math.max(0, due - numberValue(item.paidAmount));
        if (pending <= 0) return;

        const key = `${item.customerId || 'unknown'}::${item.loanId || 'unknown'}`;
        const existing = pendingMap.get(key) || {
          key,
          customerId: item.customerId || '',
          customerName: item.customerName || 'Customer',
          loanId: item.loanId || '',
          cycle: item.cycle || '',
          target: 0,
          collected: 0,
          pending: 0,
          oldestDue: item.date || '',
        };
        existing.target += due;
        existing.collected += paid;
        existing.pending += pending;
        if (!existing.oldestDue || String(item.date || '') < existing.oldestDue) existing.oldestDue = item.date || '';
        pendingMap.set(key, existing);
      });

      const target = cycles.reduce((sum, item) => sum + item.target, 0);
      const collected = cycles.reduce((sum, item) => sum + item.collected, 0);
      const pending = cycles.reduce((sum, item) => sum + item.pending, 0);
      const customersDue = new Set(rows.map((item) => item.customerId).filter(Boolean)).size;
      const pendingCustomers = new Set(
        rows
          .filter((item) => numberValue(item.paidAmount) < numberValue(item.dueAmount))
          .map((item) => item.customerId)
          .filter(Boolean),
      ).size;

      return {
        from,
        to,
        cycles,
        target,
        collected,
        pending,
        achievement: percentage(collected, target),
        customersDue,
        pendingCustomers,
        fullyCollected: Math.max(0, customersDue - pendingCustomers),
        pendingRows: [...pendingMap.values()].sort(
          (a, b) => String(a.oldestDue || '').localeCompare(String(b.oldestDue || ''))
            || b.pending - a.pending,
        ),
      };
    };

    const current = buildPeriod(weeklyRange.from, weeklyRange.to);
    const previousFrom = addDays(weeklyRange.from, -7);
    const previous = buildPeriod(previousFrom, addDays(previousFrom, 6));

    return {
      current,
      previous,
      collectionGrowth: current.collected - previous.collected,
      achievementChange: current.achievement - previous.achievement,
      pendingChange: current.pending - previous.pending,
    };
  }, [collections, weeklyRange.from, weeklyRange.to]);

  const weeklyPreparedBy = user?.displayName || user?.name || user?.fullName || (isOwner ? 'Owner' : 'Agent');
  const weeklyBranch = user?.branch || company.branch || 'Current branch';

  const latestCollectionPaymentByLoan = useMemo(() => {
    const map = new Map();
    filteredPayments
      .filter((item) => item.type === 'Collection' && item.loanId)
      .forEach((item) => {
        const current = map.get(item.loanId);
        if (!current || String(item.date || '') >= String(current.date || '')) map.set(item.loanId, item);
      });
    return map;
  }, [filteredPayments]);

  const collectionReportSourceRows = useMemo(() => {
    if (!collectionApiReport || !Array.isArray(collectionApiReport.rows)) return filteredCollections;
    return collectionApiReport.rows.map((item) => ({
      ...item,
      date: item.dueDate || item.date,
    }));
  }, [collectionApiReport, filteredCollections]);

  const collectionReportPaymentRows = useMemo(() => {
    const source = collectionApiReport && Array.isArray(collectionApiReport.payments)
      ? collectionApiReport.payments
      : filteredPayments
        .filter((item) => item.type === 'Collection')
        .map((item) => ({
          paymentId: item.id || item.paymentId,
          paymentDate: item.date,
          customerId: item.customerId,
          customerName: item.customerName,
          loanId: item.loanId,
          cycle: item.cycle,
          collectionAmount: item.collectionAmount ?? item.amount,
          fineAmount: item.fineAmount ?? 0,
          totalReceived: item.amount,
          paymentMode: item.paymentMode,
          note: item.note,
        }));

    const query = collectionSearch.trim().toLowerCase();
    return source
      .map((item) => ({
        ...item,
        paymentDate: item.paymentDate || item.date || '',
        collectionAmount: numberValue(item.collectionAmount),
        fineAmount: numberValue(item.fineAmount),
        totalReceived: numberValue(item.totalReceived ?? item.amount),
      }))
      .filter((item) => !query || `${item.customerName || ''} ${item.customerId || ''} ${item.loanId || ''} ${item.cycle || ''} ${item.paymentMode || ''} ${item.note || ''}`.toLowerCase().includes(query))
      .sort((a, b) => String(b.paymentDate || '').localeCompare(String(a.paymentDate || '')) || String(b.paymentId || '').localeCompare(String(a.paymentId || '')));
  }, [collectionApiReport, filteredPayments, collectionSearch]);

  const collectionReportRows = useMemo(() => {
    const query = collectionSearch.trim().toLowerCase();
    return collectionReportSourceRows
      .map((item) => {
        const status = item.status || collectionDisplayStatus(item);
        const due = numberValue(item.dueAmount);
        const paid = numberValue(item.paidAmount);
        const balance = Math.max(0, numberValue(item.balance ?? (due - paid)));
        const latestPayment = latestCollectionPaymentByLoan.get(item.loanId);
        return {
          ...item,
          status,
          dueAmount: due,
          paidAmount: paid,
          balance,
          fine: numberValue(item.fine),
          latestPaymentDate: item.latestPaymentDate || latestPayment?.date || '',
          paymentMode: item.paymentMode || latestPayment?.paymentMode || '',
        };
      })
      .filter((item) => collectionStatus === 'All' || item.status === collectionStatus)
      .filter((item) => !query || `${item.customerName || ''} ${item.customerId || ''} ${item.loanId || ''} ${item.cycle || ''} ${item.status}`.toLowerCase().includes(query))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(a.customerName || '').localeCompare(String(b.customerName || '')));
  }, [collectionReportSourceRows, collectionSearch, collectionStatus, latestCollectionPaymentByLoan]);

  const collectionReportSummary = useMemo(() => {
    // Expected/pending follow scheduled due dates. Collected/fine follow the actual payment date.
    // This keeps early collections visible in the period they were really received.
    const expected = collectionReportRows.reduce((sum, item) => sum + item.dueAmount, 0);
    const collected = collectionReportPaymentRows.reduce((sum, item) => sum + item.collectionAmount, 0);
    const pending = collectionReportRows.reduce((sum, item) => sum + item.balance, 0);
    const fine = collectionReportPaymentRows.reduce((sum, item) => sum + item.fineAmount, 0);
    const paidEntries = collectionReportPaymentRows.length;
    const overdueEntries = collectionReportRows.filter((item) => item.status === 'Overdue').length;
    const recovery = expected > 0 ? Math.min(100, (collected / expected) * 100) : 0;
    return { expected, collected, pending, fine, paidEntries, overdueEntries, recovery };
  }, [collectionReportRows, collectionReportPaymentRows]);

  const cycleRows = useMemo(() => ['Daily', 'Weekly', 'Monthly'].map((itemCycle) => {
    const rows = filteredCollections.filter((item) => item.cycle === itemCycle);
    const expected = rows.reduce((sum, item) => sum + numberValue(item.dueAmount), 0);
    const collected = rows.reduce((sum, item) => sum + numberValue(item.paidAmount), 0);
    const pending = rows.reduce((sum, item) => sum + Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount)), 0);
    const uniqueCustomers = new Set(rows.map((item) => item.customerId)).size;
    const loansInCycle = filteredLoans.filter((loan) => loan.cycle === itemCycle).length;
    const rate = expected > 0 ? Math.min(100, (collected / expected) * 100) : 0;
    return { cycle: itemCycle, expected, collected, pending, uniqueCustomers, loans: loansInCycle, rate };
  }), [filteredCollections, filteredLoans]);

  const trendRows = useMemo(() => {
    const totals = new Map();
    filteredCollections.forEach((item) => {
      totals.set(item.date, (totals.get(item.date) || 0) + numberValue(item.paidAmount));
    });
    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, amount]) => ({ date, amount }));
  }, [filteredCollections]);
  const trendMax = Math.max(1, ...trendRows.map((item) => item.amount));

  const activeLoans = loans.filter((loan) => loan.status === 'Active' || loan.status === 'Overdue').length;
  const closedLoans = loans.filter((loan) => loan.status === 'Closed').length;
  const periodCustomers = new Set([
    ...filteredCollections.map((item) => item.customerId),
    ...filteredLoans.map((item) => item.customerId),
  ]).size;

  const downloadOverview = () => downloadCsv(
    overviewHasDateFilter
      ? `crednivo-reports-overview-${fromDate || 'start'}-to-${toDate || 'today'}.csv`
      : 'crednivo-reports-overview-overall.csv',
    [
      ['CREDNIVO Reports Overview'],
      ['Company', company.name],
      ['Branch', user?.branch || company.branch || 'All'],
      ['From', fromDate || 'Overall'],
      ['To', toDate || 'Overall'],
      ['Cycle', cycle],
      [],
      ['Summary', 'Value'],
      ['Collection Amount', overviewCollectionAmount],
      ['Collected Amount', overview.collected],
      ...overviewCycleCollections.map((item) => [`${item.cycle} Collection / Cycle Total`, item.amount]),
      ['Scheduled Collection Collected', overview.scheduledCollected],
      ['Pending Amount', overviewPendingAmount],
      ['Overdue', overview.overdue],
      ['Incoming Cash', overview.incoming],
      ['Outgoing Cash', overview.outgoing],
      ['Net Cash Flow', overview.netCash],
      ['Expenses', overview.expenseTotal],
      ['New Loans Given', overview.loanGiven],
      ['Total Outstanding (Current)', currentTotalOutstanding],
      ['In-Hand Amount (Current)', currentInHandAmount],
      ['Active Loans', overviewActiveLoanCount],
      ['Total Customers', overviewCustomerCount],
      ['Overdue Amount', overview.overdue],
      ['New Loans Given', overview.loanGiven],
      ['Expenses', overview.expenseTotal],
      ['Fine Income', overviewFineIncome],
      ['Document Charges Income', overviewDocumentChargeIncome],
      ['Recovery %', `${overview.recovery.toFixed(1)}%`],
      [],
      ['Cycle', 'Expected', 'Collected', 'Pending', 'Customers', 'Loans', 'Recovery %'],
      ...cycleRows.map((item) => [item.cycle, item.expected, item.collected, item.pending, item.uniqueCustomers, item.loans, `${item.rate.toFixed(1)}%`]),
      [],
      ['Recovery Attention', 'Customer', 'Loan', 'Due Date', 'Balance'],
      ...overview.overdueRows.slice(0, 100).map((item) => [item.customerId, item.customerName, item.loanId, item.date, Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount))]),
    ],
  );

  const downloadWeeklyReport = () => downloadCsv(
    `crednivo-weekly-report-${weeklyRange.from}-to-${weeklyRange.to}.csv`,
    [
      ['CREDNIVO Weekly Collection Performance Report'],
      ['Company', company.name],
      ['Branch', weeklyBranch],
      ['Prepared By', weeklyPreparedBy],
      ['From', weeklyRange.from],
      ['To', weeklyRange.to],
      [],
      ['Target / Scheduled Collection'],
      ['Cycle', 'Target'],
      ...weeklyReport.current.cycles.map((item) => [item.cycle, item.target]),
      ['Total Target', weeklyReport.current.target],
      [],
      ['Collection Performance'],
      ['Cycle', 'Target', 'Collected', 'Pending', 'Achievement %'],
      ...weeklyReport.current.cycles.map((item) => [item.cycle, item.target, item.collected, item.pending, `${item.achievement.toFixed(1)}%`]),
      ['Total', weeklyReport.current.target, weeklyReport.current.collected, weeklyReport.current.pending, `${weeklyReport.current.achievement.toFixed(1)}%`],
      [],
      ['Customer Performance'],
      ['Cycle', 'Customers Due', 'Fully Collected', 'Pending Customers'],
      ...weeklyReport.current.cycles.map((item) => [item.cycle, item.customersDue, item.fullyCollected, item.pendingCustomers]),
      ['Total', weeklyReport.current.customersDue, weeklyReport.current.fullyCollected, weeklyReport.current.pendingCustomers],
      [],
      ['Pending Customer Details'],
      ['Customer ID', 'Customer', 'Loan ID', 'Cycle', 'Target', 'Collected', 'Pending', 'Oldest Due'],
      ...weeklyReport.current.pendingRows.map((item) => [
        item.customerId, item.customerName, item.loanId, item.cycle,
        item.target, item.collected, item.pending, item.oldestDue,
      ]),
      [],
      ['Weekly Comparison'],
      ['Metric', 'Last Week', 'This Week', 'Change'],
      ['Target', weeklyReport.previous.target, weeklyReport.current.target, weeklyReport.current.target - weeklyReport.previous.target],
      ['Collected', weeklyReport.previous.collected, weeklyReport.current.collected, weeklyReport.collectionGrowth],
      ['Pending', weeklyReport.previous.pending, weeklyReport.current.pending, weeklyReport.pendingChange],
      ['Achievement %', `${weeklyReport.previous.achievement.toFixed(1)}%`, `${weeklyReport.current.achievement.toFixed(1)}%`, `${weeklyReport.achievementChange >= 0 ? '+' : ''}${weeklyReport.achievementChange.toFixed(1)}%`],
    ],
  );

  const downloadMonthly = () => downloadCsv(
    `crednivo-monthly-statement-${selectedMonth}.csv`,
    [
      ['CREDNIVO Monthly Statement', monthlyReport.month.label],
      [],
      ['Expected', monthlyReport.overallExpected],
      ['Collected', monthlyReport.overallCollected],
      ['Pending', monthlyReport.overallPending],
      ['Overdue', monthlyReport.overdueAmount],
      ['New Loans Given', monthlyReport.newLoansGiven],
      ['Expenses', monthlyReport.expenseTotal],
      ['Net Cash Flow', monthlyReport.netCash],
      ['In-Hand Amount (Month End)', monthlyReport.availableCapitalAtMonthEnd],
      ['Total Outstanding (Current Snapshot)', currentTotalOutstanding],
      [],
      ['Cycle', 'Expected', 'Collected', 'Pending', 'Customers', 'Loans', 'Recovery %'],
      ...monthlyReport.cycles.map((item) => [item.cycle, item.expected, item.collected, item.pending, item.customers, item.loans, `${item.rate.toFixed(1)}%`]),
    ],
  );

  const downloadCollectionReport = () => downloadCsv(
    `crednivo-collection-report-${fromDate}-to-${toDate}.csv`,
    [
      ['CREDNIVO Detailed Collection Report'],
      ['Company', company.name],
      ['Branch', user?.branch || company.branch || 'Current branch'],
      ['From', fromDate],
      ['To', toDate],
      ['Cycle', cycle],
      ['Status', collectionStatus],
      [],
      ['Actual Collection Transactions'],
      ['Payment Date', 'Payment ID', 'Customer ID', 'Customer', 'Loan ID', 'Cycle', 'Collection', 'Fine', 'Total Received', 'Payment Mode', 'Note'],
      ...collectionReportPaymentRows.map((item) => [
        item.paymentDate, item.paymentId, item.customerId, item.customerName, item.loanId, item.cycle,
        item.collectionAmount, item.fineAmount, item.totalReceived, item.paymentMode, item.note,
      ]),
      [],
      ['Scheduled Collections'],
      ['Due Date', 'Customer ID', 'Customer', 'Loan ID', 'Cycle', 'Expected', 'Allocated/Paid', 'Fine on Schedule', 'Balance', 'Status', 'Latest Payment Date', 'Payment Mode'],
      ...collectionReportRows.map((item) => [
        item.date, item.customerId, item.customerName, item.loanId, item.cycle,
        item.dueAmount, item.paidAmount, item.fine, item.balance, item.status,
        item.latestPaymentDate, item.paymentMode,
      ]),
      [],
      ['Summary', 'Value'],
      ['Expected Due in Period', collectionReportSummary.expected],
      ['Collected in Period', collectionReportSummary.collected],
      ['Pending Due in Period', collectionReportSummary.pending],
      ['Fine Collected in Period', collectionReportSummary.fine],
      ['Collection Transactions', collectionReportSummary.paidEntries],
      ['Overdue Schedule Entries', collectionReportSummary.overdueEntries],
      ['Recovery %', `${collectionReportSummary.recovery.toFixed(1)}%`],
    ],
  );

  const exportCurrent = () => downloadOverview();

  const selectReportView = (nextView) => {
    setView(nextView);
    if (nextView === 'daily') setCycle('Daily');
    else if (nextView === 'weekly') setCycle('Weekly');
    else if (nextView === 'monthly') setCycle('Monthly');
    else setCycle('All');
  };



  return (
    <div className="module-page reports-page phase5-reports">
      <ModuleHeader
        eyebrow="Phase 5.1 · Reports"
        title="Reports & Analytics"
        description="Business-wide overview plus a launch-ready detailed collection report from your live CREDNIVO records."
        actions={(
          <>
            <ActionButton tone="secondary" icon={Printer} onClick={() => window.print()}>Print</ActionButton>
            <ActionButton tone="secondary" icon={Download} onClick={exportCurrent}>Download</ActionButton>
          </>
        )}
      />

      <div className="reports-tabs-row">
        <div className="reports-view-tabs" role="tablist" aria-label="Report view">
          <button type="button" className={view === 'overview' ? 'active' : ''} onClick={() => selectReportView('overview')}><BarChart3 size={17} />Overview</button>
          <button type="button" className={view === 'daily' ? 'active' : ''} onClick={() => selectReportView('daily')}><CalendarDays size={17} />Daily</button>
          <button type="button" className={view === 'weekly' ? 'active' : ''} onClick={() => selectReportView('weekly')}><CalendarDays size={17} />Weekly</button>
          <button type="button" className={view === 'monthly' ? 'active' : ''} onClick={() => selectReportView('monthly')}><ReceiptText size={17} />Monthly</button>
        </div>

        <div className="reports-date-range" aria-label="Report date range">
          <div className="reports-date-field">
            <button
              type="button"
              className="reports-date-display"
              aria-label={fromDate ? `From date ${formatDateInputDisplay(fromDate)}` : 'Choose from date'}
              onClick={() => {
                const input = document.getElementById('reports-from-date');
                if (input?.showPicker) input.showPicker();
                else input?.click();
              }}
            >
              <span>{formatDateInputDisplay(fromDate)}</span>
              <CalendarDays size={17} aria-hidden="true" />
            </button>
            <input
              id="reports-from-date"
              className="reports-date-native"
              type="date"
              tabIndex={-1}
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>

          <span>to</span>

          <div className="reports-date-field">
            <button
              type="button"
              className="reports-date-display"
              aria-label={toDate ? `To date ${formatDateInputDisplay(toDate)}` : 'Choose to date'}
              onClick={() => {
                const input = document.getElementById('reports-to-date');
                if (input?.showPicker) input.showPicker();
                else input?.click();
              }}
            >
              <span>{formatDateInputDisplay(toDate)}</span>
              <CalendarDays size={17} aria-hidden="true" />
            </button>
            <input
              id="reports-to-date"
              className="reports-date-native"
              type="date"
              tabIndex={-1}
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
        </div>
      </div>

      {view === 'overview' && (
        <section className="reports-overall-report" aria-label="Overall report summary">
          <div className="reports-overall-report-head">
            <div>
              <span>OVERALL REPORT</span>
              <strong>Business Collection Summary</strong>
            </div>
            <small>{overviewRangeLabel}</small>
          </div>

          <div className="reports-overall-kpi-grid">
            <article className="reports-overall-kpi reports-overall-kpi-inhand">
              <span className="reports-overall-kpi-icon"><Wallet size={21} /></span>
              <div>
                <span>In-Hand Amount</span>
                <strong>{formatCurrency(currentInHandAmount)}</strong>
                <small>Current available business cash</small>
              </div>
            </article>

            <article className="reports-overall-kpi reports-overall-kpi-collection">
              <span className="reports-overall-kpi-icon"><WalletCards size={21} /></span>
              <div>
                <span>Collection Amount</span>
                <strong>{formatCurrency(overviewCollectionAmount)}</strong>
                <small>{overviewHasDateFilter ? 'Scheduled in selected date range' : 'Current collection / cycle total'}</small>
              </div>
            </article>

            <article className="reports-overall-kpi reports-overall-kpi-collected">
              <span className="reports-overall-kpi-icon"><HandCoins size={21} /></span>
              <div>
                <span>Collected Amount</span>
                <strong>{formatCurrency(overview.collected)}</strong>
                <small>{overviewHasDateFilter ? 'Received in selected date range' : 'Total customer collection received'}</small>
              </div>
            </article>

            <article className="reports-overall-kpi reports-overall-kpi-pending">
              <span className="reports-overall-kpi-icon"><TriangleAlert size={21} /></span>
              <div>
                <span>Pending Amount</span>
                <strong>{formatCurrency(overviewPendingAmount)}</strong>
                <small>{overviewHasDateFilter ? 'Pending in selected date range' : 'Current unpaid dues up to today'}</small>
              </div>
            </article>
          </div>

          <div className="reports-overall-secondary-grid" aria-label="Current portfolio status">
            <article className="reports-overall-mini-card">
              <span><Landmark size={18} /></span>
              <div><small>Total Outstanding</small><strong>{formatCurrency(currentTotalOutstanding)}</strong></div>
            </article>
            <article className="reports-overall-mini-card">
              <span><Activity size={18} /></span>
              <div><small>Active Loans</small><strong>{overviewActiveLoanCount}</strong></div>
            </article>
            <article className="reports-overall-mini-card">
              <span><UsersRound size={18} /></span>
              <div><small>Total Customers</small><strong>{overviewCustomerCount}</strong></div>
            </article>
            <article className="reports-overall-mini-card reports-overall-mini-alert">
              <span><TriangleAlert size={18} /></span>
              <div><small>Overdue Amount</small><strong>{formatCurrency(overview.overdue)}</strong></div>
            </article>
          </div>

          <div className="reports-overall-section-heading">
            <div>
              <span>COLLECTION BY CYCLE</span>
              <strong>Current Collection Capacity</strong>
            </div>
            <small>Active loans only</small>
          </div>

          <div className="reports-overall-cycle-grid" aria-label="Collection amount by cycle">
            {overviewCycleCollections.map((item) => {
              const CycleIcon = item.cycle === 'Daily'
                ? CalendarDays
                : item.cycle === 'Weekly'
                  ? WalletCards
                  : ReceiptText;
              const cycleUnit = item.cycle === 'Daily'
                ? 'day'
                : item.cycle === 'Weekly'
                  ? 'week'
                  : 'month';

              return (
                <article
                  key={item.cycle}
                  className={`reports-overall-cycle-card reports-overall-cycle-${item.cycle.toLowerCase()}`}
                >
                  <span className="reports-overall-cycle-icon">
                    <CycleIcon size={19} />
                  </span>
                  <div>
                    <span>{item.cycle} Collection</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                    <small>{item.loanCount} active loan{item.loanCount === 1 ? '' : 's'} · per {cycleUnit}</small>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="reports-overall-section-heading">
            <div>
              <span>BUSINESS ACTIVITY</span>
              <strong>{overviewHasDateFilter ? 'Selected Period Activity' : 'Overall Activity'}</strong>
            </div>
            <small>{overviewRangeLabel}</small>
          </div>

          <div className="reports-overall-activity-grid" aria-label="Business activity summary">
            <article className="reports-overall-activity-card">
              <span className="reports-overall-activity-icon"><UserPlus size={19} /></span>
              <div>
                <small>New Loans Given</small>
                <strong>{formatCurrency(overview.loanGiven)}</strong>
                <span>Loan disbursement amount</span>
              </div>
            </article>

            <article className="reports-overall-activity-card">
              <span className="reports-overall-activity-icon"><ReceiptText size={19} /></span>
              <div>
                <small>Expenses</small>
                <strong>{formatCurrency(overview.expenseTotal)}</strong>
                <span>Recorded business expenses</span>
              </div>
            </article>

            <article className="reports-overall-activity-card">
              <span className="reports-overall-activity-icon"><CircleDollarSign size={19} /></span>
              <div>
                <small>Fine Income</small>
                <strong>{formatCurrency(overviewFineIncome)}</strong>
                <span>Fine amount actually received</span>
              </div>
            </article>

            <article className="reports-overall-activity-card">
              <span className="reports-overall-activity-icon"><ReceiptText size={19} /></span>
              <div>
                <small>Document Charges Income</small>
                <strong>{formatCurrency(overviewDocumentChargeIncome)}</strong>
                <span>Document charges recorded as income</span>
              </div>
            </article>
          </div>

          <div className="reports-overall-section-heading reports-cycle-status-heading">
            <div>
              <span>COLLECTION STATUS</span>
              <strong>Daily / Weekly / Monthly Summary</strong>
            </div>
            <small>{overviewRangeLabel}</small>
          </div>

          <div className="reports-cycle-status-table-wrap">
            <table className="reports-cycle-status-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Overall Collection Amount</th>
                  <th>Collected Amount</th>
                  <th>Upcoming Amount</th>
                  <th>Pending Amount</th>
                </tr>
              </thead>
              <tbody>
                {overviewCycleStatusRows.map((row) => (
                  <tr key={row.cycle}>
                    <td>
                      <span className={`reports-cycle-status-badge reports-cycle-status-${row.cycle.toLowerCase()}`}>
                        {row.cycle}
                      </span>
                    </td>
                    <td><strong>{formatCurrency(row.overallCollectionAmount)}</strong></td>
                    <td className="reports-cycle-status-collected">{formatCurrency(row.collectedAmount)}</td>
                    <td className="reports-cycle-status-upcoming">{formatCurrency(row.upcomingAmount)}</td>
                    <td className="reports-cycle-status-pending">{formatCurrency(row.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{formatCurrency(overviewCycleStatusRows.reduce((sum, row) => sum + row.overallCollectionAmount, 0))}</td>
                  <td>{formatCurrency(overviewCycleStatusRows.reduce((sum, row) => sum + row.collectedAmount, 0))}</td>
                  <td>{formatCurrency(overviewCycleStatusRows.reduce((sum, row) => sum + row.upcomingAmount, 0))}</td>
                  <td>{formatCurrency(overviewCycleStatusRows.reduce((sum, row) => sum + row.pendingAmount, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
