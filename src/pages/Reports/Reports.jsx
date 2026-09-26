import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileDown,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Landmark,
  PiggyBank,
  Printer,
  ReceiptText,
  Search,
  TriangleAlert,
  UserPlus,
  UsersRound,
  Wallet,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { PageBackButton } from '../../components/GlobalBackButton';
import ReportActivityBoard from './ReportActivityBoard';
import DownloadMenu from '../../components/common/DownloadMenu';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Reports.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';
import {
  exportReportDoc,
  exportReportExcel,
  exportReportPdf,
} from '../../utils/reportExport';

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
    savings = [],
    agents = [],
    capitalMetrics,
  } = useCrednivo();
  const customerPhotoById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.photo || ''])),
    [customers],
  );
  const { isOwner, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const requestedActivityPage = String(searchParams.get('activity') || '').toLowerCase();
  const activityPage = ['loans', 'expenses', 'fine', 'documents', 'savings'].includes(requestedActivityPage)
    ? requestedActivityPage
    : null;

  const requestedCapacityPage = String(searchParams.get('capacity') || '').toLowerCase();
  const capacityPage = ['daily', 'weekly', 'monthly'].includes(requestedCapacityPage)
    ? requestedCapacityPage
    : null;
  const capacityCycle = capacityPage
    ? `${capacityPage.charAt(0).toUpperCase()}${capacityPage.slice(1)}`
    : null;

  const initialFromDate = String(searchParams.get('from') || '');
  const initialToDate = String(searchParams.get('to') || '');

  const monthDefault = toInputDate().slice(0, 7);
  const [view, setView] = useState('overview');
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
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
  const [selectedOverviewCycle, setSelectedOverviewCycle] = useState(capacityCycle || 'Daily');
  const [weeklyStartDate, setWeeklyStartDate] = useState(() => getSundayWeekRange(toInputDate()).from);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [pendingRiskFilter, setPendingRiskFilter] = useState('normal');
  const [overviewPendingRiskFilter, setOverviewPendingRiskFilter] = useState('normal');

  useEffect(() => {
    if (capacityCycle) setSelectedOverviewCycle(capacityCycle);
  }, [capacityCycle]);

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

  const overviewSavingsEntries = useMemo(
    () => savings.filter((item) => inRange(item.date, fromDate, toDate)),
    [savings, fromDate, toDate],
  );

  const overviewSavingsAmount = useMemo(
    () => overviewSavingsEntries.reduce((sum, item) => sum + numberValue(item.amount), 0),
    [overviewSavingsEntries],
  );

  const overviewActivityRows = useMemo(() => {
    const rows = [];

    filteredPayments.forEach((item) => {
      const type = String(item.type || '').toLowerCase().replace(/[_-]+/g, ' ');
      const note = String(item.note || '').toLowerCase();
      const reference = String(item.referenceId || item.reference || '');
      const referenceLower = reference.toLowerCase();
      const date = item.date || item.paymentDate || item.createdAt || '';

      if (type === 'loan given' && item.direction === 'out') {
        rows.push({
          key: `loan-${item.id || reference || rows.length}`,
          date,
          type: 'New Loan',
          reference: item.loanId || reference || '—',
          description: item.customerName || item.note || 'Loan disbursement',
          amount: numberValue(item.amount),
          direction: 'out',
        });
      }

      if (numberValue(item.fineAmount) > 0 && item.direction === 'in') {
        rows.push({
          key: `fine-${item.id || reference || rows.length}`,
          date,
          type: 'Fine Income',
          reference: item.loanId || reference || '—',
          description: item.customerName || item.note || 'Fine received',
          amount: numberValue(item.fineAmount),
          direction: 'in',
        });
      }

      const isDocumentCharge = item.direction === 'in'
        && (
          type.includes('document charge')
          || note.includes('document charge')
          || referenceLower.endsWith('-doc')
        );

      if (isDocumentCharge) {
        rows.push({
          key: `document-${item.id || reference || rows.length}`,
          date,
          type: 'Document Charge',
          reference: item.loanId || reference || '—',
          description: item.customerName || item.note || 'Document charge income',
          amount: numberValue(item.amount),
          direction: 'in',
        });
      }
    });

    filteredExpenses.forEach((item) => {
      rows.push({
        key: `expense-${item.id || item.referenceId || rows.length}`,
        date: item.date || item.expenseDate || item.createdAt || '',
        type: 'Expense',
        reference: item.referenceId || item.id || '—',
        description: item.description || item.category || item.note || 'Business expense',
        amount: numberValue(item.amount),
        direction: 'out',
      });
    });

    if (isOwner) {
      overviewSavingsEntries.forEach((item) => {
        rows.push({
          key: `saving-${item.id || item.referenceId || rows.length}`,
          date: item.date || item.createdAt || '',
          type: 'Savings',
          reference: item.referenceId || item.id || '—',
          description: item.note || item.description || 'Moved to Savings',
          amount: numberValue(item.amount),
          direction: 'saving',
        });
      });
    }

    return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [filteredPayments, filteredExpenses, overviewSavingsEntries, isOwner]);

  const overviewActiveLoanCount = overviewActiveLoans.length;
  const overviewCustomerCount = customers.length;
  const overviewActiveCustomerCount = useMemo(
    () => new Set(
      overviewActiveLoans
        .map((loan) => loan.customerId)
        .filter((customerId) => customerId !== null && customerId !== undefined && String(customerId).trim() !== '')
        .map((customerId) => String(customerId)),
    ).size,
    [overviewActiveLoans],
  );

  const loanPrincipalAmount = (loan) => numberValue(
    loan?.principal
      ?? loan?.loanAmount
      ?? loan?.amount
      ?? loan?.requiredAmount
      ?? 0
  );

  const overviewTotalPortfolioAmount = useMemo(
    () => (loans || []).reduce((sum, loan) => sum + loanPrincipalAmount(loan), 0),
    [loans],
  );

  const overviewClosedLoans = useMemo(
    () => (loans || []).filter((loan) => {
      const status = String(loan.status || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
      return status === 'closed'
        || status === 'preclosed'
        || status === 'pre-closed'
        || Boolean(loan.closedDate || loan.closedAt || loan.preclosedAt);
    }),
    [loans],
  );

  const overviewClosedLoanAmount = useMemo(
    () => overviewClosedLoans.reduce((sum, loan) => sum + loanPrincipalAmount(loan), 0),
    [overviewClosedLoans],
  );

  const overviewNewOpeningLoans = useMemo(() => {
    const today = toInputDate();
    const currentMonth = getMonthMeta(today.slice(0, 7));
    const openingFrom = overviewHasDateFilter ? fromDate : currentMonth.start;
    const openingTo = overviewHasDateFilter ? toDate : currentMonth.end;

    return (loans || []).filter((loan) => {
      const openingDate = String(
        loan.disbursedDate
          || loan.disbursed_date
          || loan.startDate
          || loan.loanDate
          || loan.createdAt
          || ''
      ).slice(0, 10);

      return openingDate ? inRange(openingDate, openingFrom, openingTo) : false;
    });
  }, [loans, overviewHasDateFilter, fromDate, toDate]);

  const overviewNewOpeningAmount = useMemo(
    () => overviewNewOpeningLoans.reduce((sum, loan) => sum + loanPrincipalAmount(loan), 0),
    [overviewNewOpeningLoans],
  );

  const overviewRangeLabel = !fromDate && !toDate
    ? 'Overall live snapshot'
    : fromDate && toDate
      ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
      : fromDate
        ? `From ${formatDate(fromDate)}`
        : `Up to ${formatDate(toDate)}`;

  const overviewNewOpeningLabel = overviewHasDateFilter
    ? overviewRangeLabel
    : 'This month';

  const customerById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer])),
    [customers],
  );

  const newLoanDetailRows = useMemo(() => {
    return (loans || [])
      .map((loan) => {
        const loanDate = String(
          loan.disbursedDate
            || loan.disbursed_date
            || loan.startDate
            || loan.loanDate
            || loan.createdAt
            || ''
        ).slice(0, 10);

        if (overviewHasDateFilter && !inRange(loanDate, fromDate, toDate)) return null;

        const customer = customerById[String(loan.customerId)] || {};
        const principal = numberValue(
          loan.principal
            ?? loan.loanAmount
            ?? loan.amount
            ?? loan.requiredAmount
            ?? 0
        );
        const givenAmount = numberValue(
          loan.disbursedAmount
            ?? loan.disbursed_amount
            ?? loan.givenAmount
            ?? loan.amountGiven
            ?? principal
        );

        return {
          key: `loan-${loan.id || loan.loanId || Math.random()}`,
          date: loanDate,
          customerDbId: loan.customerId || customer.id || '',
          customerId: customer.customerId || loan.customerCode || loan.customerId || '—',
          customerName: loan.customerName || customer.name || 'Customer',
          loanId: loan.loanId || loan.id || '—',
          cycle: loan.cycle || '—',
          loanAmount: principal,
          givenAmount,
          status: loan.status || 'Active',
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [loans, customerById, overviewHasDateFilter, fromDate, toDate]);

  const expenseDetailRows = useMemo(
    () => (filteredExpenses || [])
      .map((item, index) => ({
        key: `expense-${item.id || item.referenceId || index}`,
        date: String(item.date || item.expenseDate || item.createdAt || '').slice(0, 10),
        category: item.category || item.expenseType || 'Expense',
        description: item.description || item.note || item.purpose || '—',
        amount: numberValue(item.amount),
        createdBy: item.createdByName || item.creatorName || item.createdBy || item.userName || '—',
      }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [filteredExpenses],
  );

  const fineDetailRows = useMemo(
    () => (filteredPayments || [])
      .filter((item) => item.direction === 'in' && numberValue(item.fineAmount) > 0)
      .map((item, index) => {
        const linkedLoan = loanMap[item.loanId] || {};
        const customer = customerById[String(item.customerId || linkedLoan.customerId)] || {};
        return {
          key: `fine-${item.id || item.referenceId || index}`,
          date: String(item.date || item.paymentDate || item.createdAt || '').slice(0, 10),
          customerDbId: item.customerId || linkedLoan.customerId || customer.id || '',
          customerId: customer.customerId || item.customerCode || item.customerId || linkedLoan.customerId || '—',
          customerName: item.customerName || linkedLoan.customerName || customer.name || 'Customer',
          loanId: item.loanId || linkedLoan.loanId || linkedLoan.id || '—',
          amount: numberValue(item.fineAmount),
          paymentMode: item.paymentMode || item.mode || '—',
        };
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [filteredPayments, loanMap, customerById],
  );

  const documentChargeDetailRows = useMemo(
    () => (filteredPayments || [])
      .filter((item) => {
        if (item.direction !== 'in') return false;
        const type = String(item.type || '').toLowerCase().replace(/[_-]+/g, ' ');
        const note = String(item.note || '').toLowerCase();
        const reference = String(item.referenceId || item.reference || '').toLowerCase();
        return type.includes('document charge')
          || note.includes('document charge')
          || reference.endsWith('-doc');
      })
      .map((item, index) => {
        const linkedLoan = loanMap[item.loanId] || {};
        const customer = customerById[String(item.customerId || linkedLoan.customerId)] || {};
        return {
          key: `doc-${item.id || item.referenceId || index}`,
          date: String(item.date || item.paymentDate || item.createdAt || '').slice(0, 10),
          customerDbId: item.customerId || linkedLoan.customerId || customer.id || '',
          customerId: customer.customerId || item.customerCode || item.customerId || linkedLoan.customerId || '—',
          customerName: item.customerName || linkedLoan.customerName || customer.name || 'Customer',
          loanId: item.loanId || linkedLoan.loanId || linkedLoan.id || '—',
          amount: numberValue(item.amount),
          reference: item.referenceId || item.reference || '—',
        };
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [filteredPayments, loanMap, customerById],
  );

  const savingsDetailRows = useMemo(
    () => (overviewSavingsEntries || [])
      .map((item, index) => ({
        key: `saving-${item.id || item.referenceId || index}`,
        date: String(item.date || item.createdAt || '').slice(0, 10),
        amount: numberValue(item.amount),
        description: item.note || item.description || item.purpose || 'Savings',
        createdBy: item.createdByName || item.creatorName || item.createdBy || item.userName || '—',
      }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [overviewSavingsEntries],
  );

  const activityTotals = useMemo(() => ({
    loans: {
      count: newLoanDetailRows.length,
      loanAmount: newLoanDetailRows.reduce((sum, row) => sum + numberValue(row.loanAmount), 0),
      givenAmount: newLoanDetailRows.reduce((sum, row) => sum + numberValue(row.givenAmount), 0),
    },
    expenses: {
      count: expenseDetailRows.length,
      amount: expenseDetailRows.reduce((sum, row) => sum + numberValue(row.amount), 0),
    },
    fine: {
      count: fineDetailRows.length,
      amount: fineDetailRows.reduce((sum, row) => sum + numberValue(row.amount), 0),
    },
    documents: {
      count: documentChargeDetailRows.length,
      amount: documentChargeDetailRows.reduce((sum, row) => sum + numberValue(row.amount), 0),
    },
    savings: {
      count: savingsDetailRows.length,
      amount: savingsDetailRows.reduce((sum, row) => sum + numberValue(row.amount), 0),
    },
  }), [
    newLoanDetailRows,
    expenseDetailRows,
    fineDetailRows,
    documentChargeDetailRows,
    savingsDetailRows,
  ]);

  // Same records as filteredPayments/filteredExpenses/overviewSavingsEntries,
  // but only bounded by toDate (no fromDate lower bound). Used to compute a
  // true opening balance for historical statements by summing everything
  // that happened before the selected range, instead of defaulting to 0.
  const paymentsUpToRange = useMemo(() => payments.filter((item) => {
    const date = item.date || item.paymentDate || item.createdAt || '';
    if (!inRange(date, null, toDate)) return false;
    if (cycle === 'All') return true;
    const linkedLoan = loanMap[item.loanId];
    return linkedLoan?.cycle === cycle;
  }), [payments, toDate, cycle, loanMap]);

  const expensesUpToRange = useMemo(
    () => expenses.filter((item) => inRange(item.date, null, toDate)),
    [expenses, toDate],
  );

  const savingsUpToRange = useMemo(
    () => savings.filter((item) => inRange(item.date, null, toDate)),
    [savings, toDate],
  );

  const overviewBankStatement = useMemo(() => {
    const statementRows = [];

    const pushStatementRow = ({
      date,
      particulars,
      reference = '—',
      credit = 0,
      debit = 0,
      sourceOrder = 0,
    }) => {
      const dateKey = String(date || '').slice(0, 10);
      const creditAmount = Math.max(0, numberValue(credit));
      const debitAmount = Math.max(0, numberValue(debit));

      if (!dateKey || (creditAmount <= 0 && debitAmount <= 0)) return;

      statementRows.push({
        key: `${dateKey}-${reference}-${particulars}-${statementRows.length}`,
        date: dateKey,
        particulars: particulars || 'Transaction',
        reference: reference || '—',
        credit: creditAmount,
        debit: debitAmount,
        sourceOrder,
      });
    };

    paymentsUpToRange.forEach((item, paymentIndex) => {
      const rawType = String(item.type || '').trim();
      const type = rawType.toLowerCase().replace(/[_-]+/g, ' ');
      const direction = String(item.direction || '').toLowerCase();
      const note = String(item.note || '').toLowerCase();
      const reference = String(
        item.referenceId
          || item.reference
          || item.loanId
          || item.id
          || '—',
      );
      const referenceLower = reference.toLowerCase();
      const customerName = item.customerName || item.name || '';
      const date = item.date || item.paymentDate || item.createdAt || '';
      const amount = Math.max(0, numberValue(item.amount));
      const fineAmount = Math.max(0, numberValue(item.fineAmount));

      const isDocumentCharge = direction === 'in'
        && (
          type.includes('document charge')
          || note.includes('document charge')
          || referenceLower.endsWith('-doc')
        );

      if (isDocumentCharge) {
        pushStatementRow({
          date,
          particulars: customerName
            ? `Document Charge - ${customerName}`
            : 'Document Charge',
          reference,
          credit: amount,
          sourceOrder: paymentIndex,
        });
        return;
      }

      if (direction === 'in' && type === 'collection') {
        const hasCollectionAmount = item.collectionAmount !== null
          && item.collectionAmount !== undefined
          && item.collectionAmount !== '';

        // Some payment payloads store the fine inside the total amount.
        // Prefer collectionAmount when available; otherwise remove fine from
        // the gross amount so the fine is not counted twice.
        const collectionAmount = Math.max(
          0,
          hasCollectionAmount
            ? numberValue(item.collectionAmount)
            : amount - fineAmount,
        );

        if (collectionAmount > 0) {
          pushStatementRow({
            date,
            particulars: customerName
              ? `Collection - ${customerName}`
              : 'Collection',
            reference: item.loanId || reference,
            credit: collectionAmount,
            sourceOrder: paymentIndex,
          });
        }

        if (fineAmount > 0) {
          pushStatementRow({
            date,
            particulars: customerName
              ? `Fine Income - ${customerName}`
              : 'Fine Income',
            reference: item.loanId || reference,
            credit: fineAmount,
            sourceOrder: paymentIndex + 0.1,
          });
        }
        return;
      }

      if (direction === 'in') {
        const isFineOnly = type.includes('fine') || fineAmount > 0;
        pushStatementRow({
          date,
          particulars: isFineOnly
            ? (customerName ? `Fine Income - ${customerName}` : 'Fine Income')
            : (customerName ? `${rawType || 'Income'} - ${customerName}` : rawType || 'Income'),
          reference: item.loanId || reference,
          credit: isFineOnly && fineAmount > 0 ? fineAmount : amount,
          sourceOrder: paymentIndex,
        });
        return;
      }

      if (direction === 'out') {
        // Every Expense creates a mirrored Payment ledger row (type "Expense")
        // purely for internal linking. The real amount is already added below
        // from expensesUpToRange — counting this mirror too would double it.
        if (type === 'expense') return;

        const isLoan = type === 'new loan' || type.includes('loan given');
        pushStatementRow({
          date,
          particulars: isLoan
            ? (customerName ? `Loan Disbursement - ${customerName}` : 'Loan Disbursement')
            : rawType || 'Payment Out',
          reference: item.loanId || reference,
          debit: amount,
          sourceOrder: paymentIndex,
        });
      }
    });

    expensesUpToRange.forEach((item, expenseIndex) => {
      pushStatementRow({
        date: item.date || item.expenseDate || item.createdAt || '',
        particulars: item.description
          || item.purpose
          || item.category
          || item.expenseType
          || 'Expense',
        reference: item.referenceId || item.id || '—',
        debit: item.amount,
        sourceOrder: 100000 + expenseIndex,
      });
    });

    if (isOwner) {
      savingsUpToRange.forEach((item, savingIndex) => {
        pushStatementRow({
          date: item.date || item.createdAt || '',
          particulars: item.note || item.description || item.purpose || 'Savings',
          reference: item.referenceId || item.id || '—',
          debit: item.amount,
          sourceOrder: 200000 + savingIndex,
        });
      });
    }

    statementRows.sort((a, b) => {
      const byDate = String(a.date).localeCompare(String(b.date));
      if (byDate !== 0) return byDate;
      return numberValue(a.sourceOrder) - numberValue(b.sourceOrder);
    });

    // statementRows spans everything up to toDate (no fromDate lower bound —
    // see paymentsUpToRange/expensesUpToRange/savingsUpToRange above). Split
    // it here: rows before the selected range only feed the opening balance,
    // rows inside the range are what the statement actually displays.
    const preRangeRows = fromDate
      ? statementRows.filter((row) => row.date < fromDate)
      : [];
    const inRangeRows = fromDate
      ? statementRows.filter((row) => row.date >= fromDate)
      : statementRows;

    const totalCredit = inRangeRows.reduce((sum, row) => sum + row.credit, 0);
    const totalDebit = inRangeRows.reduce((sum, row) => sum + row.debit, 0);
    const netMovement = totalCredit - totalDebit;
    const priorNetMovement = preRangeRows.reduce((sum, row) => sum + row.credit - row.debit, 0);

    // When the report includes the current date, we can anchor the statement's
    // closing balance to live Available Capital and back-calculate its opening.
    // Historical ranges instead take the real running balance carried forward
    // from every transaction before the selected period — i.e. last month's
    // closing balance becomes this period's opening balance — rather than
    // starting from zero.
    const today = toInputDate();
    const liveBalanceAnchored = !toDate || String(toDate) >= today;
    const openingBalance = liveBalanceAnchored
      ? currentInHandAmount - netMovement
      : priorNetMovement;

    let runningBalance = openingBalance;
    const rowsWithBalance = inRangeRows.map((row) => {
      runningBalance += row.credit - row.debit;
      return {
        ...row,
        creditDisplay: row.credit > 0 ? row.credit : null,
        debitDisplay: row.debit > 0 ? row.debit : null,
        balance: runningBalance,
      };
    });

    const monthMap = new Map();

    rowsWithBalance.forEach((row) => {
      const monthKey = String(row.date).slice(0, 7);
      if (!monthKey) return;

      if (!monthMap.has(monthKey)) {
        const month = getMonthMeta(monthKey);
        monthMap.set(monthKey, {
          key: monthKey,
          label: month.label,
          openingBalance: null,
          closingBalance: null,
          totalCredit: 0,
          totalDebit: 0,
          rows: [],
        });
      }

      const month = monthMap.get(monthKey);

      if (month.openingBalance === null) {
        month.openingBalance = row.balance - row.credit + row.debit;
      }

      month.totalCredit += row.credit;
      month.totalDebit += row.debit;
      month.closingBalance = row.balance;
      month.rows.push(row);
    });

    const months = [...monthMap.values()];

    return {
      liveBalanceAnchored,
      openingBalance,
      closingBalance: rowsWithBalance.length
        ? rowsWithBalance[rowsWithBalance.length - 1].balance
        : openingBalance,
      totalCredit,
      totalDebit,
      netMovement,
      transactionCount: rowsWithBalance.length,
      balanceLabel: liveBalanceAnchored ? 'Balance' : 'Period Balance',
      months,
      rows: rowsWithBalance,
    };
  }, [
    paymentsUpToRange,
    expensesUpToRange,
    savingsUpToRange,
    isOwner,
    currentInHandAmount,
    fromDate,
    toDate,
  ]);

  // Daily cash book matching the uploaded template: Principal / Profit /
  // Interest (late fine) / Other Income / Expense / Lending Amount / Savings,
  // with a running "In Hand Amount" per calendar day, grouped by month with
  // an opening balance carried forward exactly like overviewBankStatement.
  const cashBookStatement = useMemo(() => {
    const dayMap = new Map();
    const ensureDay = (dateKey) => {
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, {
          date: dateKey, principal: 0, profit: 0, interest: 0, otherIncome: 0,
          expense: 0, lending: 0, savings: 0,
        });
      }
      return dayMap.get(dateKey);
    };

    paymentsUpToRange.forEach((item) => {
      const dateKey = String(item.date || item.paymentDate || item.createdAt || '').slice(0, 10);
      if (!dateKey) return;
      const type = String(item.type || '').trim().toLowerCase();
      const direction = String(item.direction || '').toLowerCase();
      const day = ensureDay(dateKey);

      if (type === 'collection' && direction === 'in') {
        day.principal += Math.max(0, numberValue(item.principalPaid));
        day.profit += Math.max(0, numberValue(item.interestPaid));
        day.interest += Math.max(0, numberValue(item.fineAmount));
        return;
      }
      if (type === 'document charge' && direction === 'in') {
        day.otherIncome += Math.max(0, numberValue(item.amount));
        return;
      }
      // Every Expense creates a mirrored Payment ledger row purely for
      // internal linking — the real amount is added below from
      // expensesUpToRange, so counting this mirror too would double it.
      if (type === 'expense') return;
      if (type === 'new loan' && direction === 'out') {
        day.lending += Math.max(0, numberValue(item.amount));
        return;
      }
      // Defensive fallback for any payment type outside the known set.
      if (direction === 'in') day.otherIncome += Math.max(0, numberValue(item.amount));
      else if (direction === 'out') day.lending += Math.max(0, numberValue(item.amount));
    });

    expensesUpToRange.forEach((item) => {
      const dateKey = String(item.date || '').slice(0, 10);
      if (!dateKey) return;
      ensureDay(dateKey).expense += Math.max(0, numberValue(item.amount));
    });

    if (isOwner) {
      savingsUpToRange.forEach((item) => {
        const dateKey = String(item.date || item.createdAt || '').slice(0, 10);
        if (!dateKey) return;
        ensureDay(dateKey).savings += Math.max(0, numberValue(item.amount));
      });
    }

    const dayNet = (day) => day.principal + day.profit + day.interest + day.otherIncome
      - day.expense - day.lending - day.savings;

    const activeDays = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const preRangeDays = fromDate ? activeDays.filter((d) => d.date < fromDate) : [];
    const inRangeActiveDays = fromDate ? activeDays.filter((d) => d.date >= fromDate) : activeDays;
    const priorNetMovement = preRangeDays.reduce((sum, d) => sum + dayNet(d), 0);
    const inRangeNetMovement = inRangeActiveDays.reduce((sum, d) => sum + dayNet(d), 0);

    const today = toInputDate();
    const liveBalanceAnchored = !toDate || String(toDate) >= today;
    const openingBalance = liveBalanceAnchored
      ? currentInHandAmount - inRangeNetMovement
      : priorNetMovement;

    // Every calendar day in the selected range gets a row (even with all
    // zeros), matching the template, which lists every day of the month —
    // not just days with activity — so it can be tallied day by day.
    const rangeStart = fromDate || activeDays[0]?.date || today;
    const rangeEnd = toDate || today;
    const dateRows = [];
    if (rangeStart && rangeEnd && rangeStart <= rangeEnd) {
      const cursor = new Date(`${rangeStart}T00:00:00`);
      const endDate = new Date(`${rangeEnd}T00:00:00`);
      let guard = 0;
      while (cursor <= endDate && guard < 3660) {
        dateRows.push(toInputDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
      }
    }

    let runningBalance = openingBalance;
    const rows = dateRows.map((dateKey, index) => {
      const day = dayMap.get(dateKey) || {
        principal: 0, profit: 0, interest: 0, otherIncome: 0, expense: 0, lending: 0, savings: 0,
      };
      runningBalance += dayNet(day);
      return {
        sNo: index + 1,
        date: dateKey,
        principal: day.principal,
        profit: day.profit,
        interest: day.interest,
        otherIncome: day.otherIncome,
        expense: day.expense,
        lending: day.lending,
        savings: day.savings,
        inHandAmount: runningBalance,
        remarks: index === 0 ? 'TALLY' : '',
      };
    });

    const monthMap = new Map();
    rows.forEach((row) => {
      const monthKey = row.date.slice(0, 7);
      if (!monthMap.has(monthKey)) {
        const meta = getMonthMeta(monthKey);
        monthMap.set(monthKey, {
          key: monthKey,
          label: meta.label,
          openingBalance: null,
          closingBalance: null,
          totalPrincipal: 0,
          totalProfit: 0,
          totalInterest: 0,
          totalOtherIncome: 0,
          totalExpense: 0,
          totalLending: 0,
          totalSavings: 0,
          rows: [],
        });
      }
      const month = monthMap.get(monthKey);
      if (month.openingBalance === null) {
        month.openingBalance = row.inHandAmount - row.principal - row.profit - row.interest
          - row.otherIncome + row.expense + row.lending + row.savings;
      }
      month.totalPrincipal += row.principal;
      month.totalProfit += row.profit;
      month.totalInterest += row.interest;
      month.totalOtherIncome += row.otherIncome;
      month.totalExpense += row.expense;
      month.totalLending += row.lending;
      month.totalSavings += row.savings;
      month.closingBalance = row.inHandAmount;
      month.rows.push(row);
    });

    return {
      liveBalanceAnchored,
      openingBalance,
      closingBalance: rows.length ? rows[rows.length - 1].inHandAmount : openingBalance,
      balanceLabel: liveBalanceAnchored ? 'In Hand Amount' : 'Period In Hand Amount',
      months: [...monthMap.values()],
      rows,
    };
  }, [
    paymentsUpToRange,
    expensesUpToRange,
    savingsUpToRange,
    isOwner,
    currentInHandAmount,
    fromDate,
    toDate,
  ]);

  const cashBookSections = useMemo(() => {
    const summaryRows = cashBookStatement.months.map((month) => ({
      month: month.label,
      openingBalance: month.openingBalance,
      totalPrincipal: month.totalPrincipal,
      totalProfit: month.totalProfit,
      totalInterest: month.totalInterest,
      totalOtherIncome: month.totalOtherIncome,
      totalExpense: month.totalExpense,
      totalLending: month.totalLending,
      totalSavings: month.totalSavings,
      closingBalance: month.closingBalance,
    }));

    const dailyColumns = [
      { key: 'sNo', label: 'S.No', type: 'number' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'principal', label: 'Principal', type: 'currency' },
      { key: 'profit', label: 'Profit', type: 'currency' },
      { key: 'interest', label: 'Interest', type: 'currency' },
      { key: 'otherIncome', label: 'Other Income', type: 'currency' },
      { key: 'expense', label: 'Expense', type: 'currency' },
      { key: 'lending', label: 'Lending Amount', type: 'currency' },
      { key: 'savings', label: 'Savings', type: 'currency' },
      { key: 'inHandAmount', label: cashBookStatement.balanceLabel, type: 'currency' },
      { key: 'remarks', label: 'Remarks' },
    ];

    const monthSections = cashBookStatement.months.flatMap((month) => ([
      {
        title: `${month.label} Summary`,
        metrics: [
          { label: 'Opening Balance', value: month.openingBalance, type: 'currency' },
          { label: 'Principal', value: month.totalPrincipal, type: 'currency' },
          { label: 'Profit', value: month.totalProfit, type: 'currency' },
          { label: 'Interest', value: month.totalInterest, type: 'currency' },
          { label: 'Other Income', value: month.totalOtherIncome, type: 'currency' },
          { label: 'Expense', value: month.totalExpense, type: 'currency' },
          { label: 'Lending Amount', value: month.totalLending, type: 'currency' },
          { label: 'Savings', value: month.totalSavings, type: 'currency' },
          { label: 'Closing Balance', value: month.closingBalance, type: 'currency' },
        ],
      },
      {
        title: `${month.label} Cash Book`,
        columns: dailyColumns,
        rows: month.rows,
      },
    ]));

    return [
      {
        title: 'Cash Book Summary',
        metrics: [
          { label: 'Opening Balance', value: cashBookStatement.openingBalance, type: 'currency' },
          { label: 'Closing Balance', value: cashBookStatement.closingBalance, type: 'currency' },
        ],
      },
      {
        title: 'Monthly Summary',
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'openingBalance', label: 'Opening Balance', type: 'currency' },
          { key: 'totalPrincipal', label: 'Principal', type: 'currency' },
          { key: 'totalProfit', label: 'Profit', type: 'currency' },
          { key: 'totalInterest', label: 'Interest', type: 'currency' },
          { key: 'totalOtherIncome', label: 'Other Income', type: 'currency' },
          { key: 'totalExpense', label: 'Expense', type: 'currency' },
          { key: 'totalLending', label: 'Lending Amount', type: 'currency' },
          { key: 'totalSavings', label: 'Savings', type: 'currency' },
          { key: 'closingBalance', label: 'Closing Balance', type: 'currency' },
        ],
        rows: summaryRows,
      },
      ...monthSections,
    ];
  }, [cashBookStatement]);

  const overviewStatementSections = useMemo(() => {
    const summaryRows = overviewBankStatement.months.map((month) => ({
      month: month.label,
      openingBalance: month.openingBalance,
      totalCredit: month.totalCredit,
      totalDebit: month.totalDebit,
      closingBalance: month.closingBalance,
      entries: month.rows.length,
    }));

    const monthSections = overviewBankStatement.months.flatMap((month) => ([
      {
        title: `${month.label} Summary`,
        metrics: [
          { label: 'Opening Balance', value: month.openingBalance, type: 'currency' },
          { label: 'Total Credits', value: month.totalCredit, type: 'currency' },
          { label: 'Total Debits', value: month.totalDebit, type: 'currency' },
          { label: 'Closing Balance', value: month.closingBalance, type: 'currency' },
          { label: 'Transactions', value: month.rows.length, type: 'number' },
        ],
      },
      {
        title: `${month.label} Statement`,
        columns: [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'particulars', label: 'Particulars' },
          { key: 'reference', label: 'Reference' },
          { key: 'creditDisplay', label: 'Credit', type: 'currency' },
          { key: 'debitDisplay', label: 'Debit', type: 'currency' },
          { key: 'balance', label: overviewBankStatement.balanceLabel, type: 'currency' },
        ],
        rows: month.rows,
      },
    ]));

    return [
      {
        title: 'Statement Summary',
        metrics: [
          { label: 'Opening Balance', value: overviewBankStatement.openingBalance, type: 'currency' },
          { label: 'Total Credits', value: overviewBankStatement.totalCredit, type: 'currency' },
          { label: 'Total Debits', value: overviewBankStatement.totalDebit, type: 'currency' },
          { label: 'Net Movement', value: overviewBankStatement.netMovement, type: 'currency' },
          { label: 'Closing Balance', value: overviewBankStatement.closingBalance, type: 'currency' },
          { label: 'Transactions', value: overviewBankStatement.transactionCount, type: 'number' },
        ],
      },
      {
        title: 'Monthly Summary',
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'openingBalance', label: 'Opening Balance', type: 'currency' },
          { key: 'totalCredit', label: 'Credits', type: 'currency' },
          { key: 'totalDebit', label: 'Debits', type: 'currency' },
          { key: 'closingBalance', label: 'Closing Balance', type: 'currency' },
          { key: 'entries', label: 'Entries', type: 'number' },
        ],
        rows: summaryRows,
      },
      ...monthSections,
    ];
  }, [overviewBankStatement]);

  const overviewCycleStatusRows = useMemo(() => {
    const today = toInputDate();

    return ['Daily', 'Weekly', 'Monthly'].map((itemCycle) => {
      const cycleKey = itemCycle.toLowerCase();

      // "Loan Amount" means the original/principal loan amount, not the
      // disbursed/given amount after upfront interest is deducted.
      // Example: principal ₹20,000 - upfront interest ₹3,000 = ₹17,000 given,
      // but this report must show Loan Amount = ₹20,000.
      // Loan Amount in this table must include ACTIVE LOANS ONLY.
      // Closed/preclosed/fully settled loans are excluded by overviewActiveLoans.
      const cycleLoans = overviewActiveLoans.filter(
        (loan) => String(loan.cycle || '').toLowerCase() === cycleKey,
      );

      const loanAmount = cycleLoans.reduce(
        (sum, loan) => sum + numberValue(
          loan.principal
            ?? loan.loanAmount
            ?? loan.amount
            ?? loan.requiredAmount
            ?? 0
        ),
        0,
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
        loanAmount,
        collectedAmount,
        upcomingAmount,
        pendingAmount,
      };
    });
  }, [
    collections,
    payments,
    loanMap,
    overviewActiveLoans,
    overviewHasDateFilter,
    fromDate,
    toDate,
  ]);



  const overviewPerformanceReport = useMemo(() => {
    const today = toInputDate();
    const hasDateFilter = Boolean(fromDate || toDate);

    const isClosedLoan = (loan) => {
      const status = String(loan?.status || '')
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-');

      return status === 'closed'
        || status === 'preclosed'
        || status === 'pre-closed'
        || Boolean(loan?.closedDate || loan?.closedAt || loan?.preclosedAt)
        || (loan?.outstanding !== null
          && loan?.outstanding !== undefined
          && numberValue(loan.outstanding) <= 0);
    };

    const loanIdentity = (loan) => [
      loan?.id,
      loan?.loanId,
      loan?.loanCode,
      loan?.code,
      loan?.loanDbId,
      loan?.dbLoanId,
    ]
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      .map((value) => String(value));

    const allLoanLookup = new Map();
    (loans || []).forEach((loan) => {
      loanIdentity(loan).forEach((key) => allLoanLookup.set(key, loan));
    });

    const linkedLoanFor = (item) => {
      const keys = [
        item?.loanId,
        item?.loanCode,
        item?.loanDbId,
        item?.dbLoanId,
        item?.loan?.id,
        item?.loan?.loanId,
      ]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
        .map((value) => String(value));

      for (const key of keys) {
        const match = allLoanLookup.get(key);
        if (match) return match;
      }
      return {};
    };

    const activeLoans = (loans || []).filter((loan) => !isClosedLoan(loan));
    const closedLoans = (loans || []).filter((loan) => isClosedLoan(loan));

    const totalPerformanceLoans = activeLoans.length + closedLoans.length;
    const activePercent = totalPerformanceLoans
      ? (activeLoans.length / totalPerformanceLoans) * 100
      : 0;
    const closedPercent = totalPerformanceLoans
      ? 100 - activePercent
      : 0;

    const pendingScheduleRows = (collections || []).filter((item) => {
      if (String(item.status || '').toLowerCase() === 'cancelled') return false;

      const dueDate = String(item.date || '').slice(0, 10);
      if (!dueDate || dueDate > today) return false;
      if (hasDateFilter && !inRange(dueDate, fromDate, toDate)) return false;

      return Math.max(
        0,
        numberValue(item.dueAmount) - numberValue(item.paidAmount),
      ) > 0;
    });

    const pendingByCustomer = new Map();

    pendingScheduleRows.forEach((item) => {
      const linkedLoan = linkedLoanFor(item);
      const customerKey = String(item.customerId || linkedLoan.customerId || item.customerName || 'unknown');
      const customer = customerById[String(item.customerId || linkedLoan.customerId)] || {};
      const dueDate = String(item.date || '').slice(0, 10);
      const balance = Math.max(
        0,
        numberValue(item.dueAmount) - numberValue(item.paidAmount),
      );
      const loanId = item.loanId || linkedLoan.loanId || linkedLoan.id || '';
      const itemCycle = item.cycle || linkedLoan.cycle || '—';

      if (!pendingByCustomer.has(customerKey)) {
        pendingByCustomer.set(customerKey, {
          key: customerKey,
          customerDbId: item.customerId || linkedLoan.customerId || customer.id || '',
          customerId: customer.customerId || item.customerCode || item.customerId || linkedLoan.customerId || '—',
          customerName: item.customerName || linkedLoan.customerName || customer.name || 'Customer',
          loanIds: new Set(),
          cycles: new Set(),
          pendingDueCount: 0,
          pendingAmount: 0,
          oldestDue: dueDate,
          finePaid: false,
        });
      }

      const row = pendingByCustomer.get(customerKey);
      if (loanId) row.loanIds.add(String(loanId));
      if (itemCycle) row.cycles.add(String(itemCycle));
      row.pendingDueCount += 1;
      row.pendingAmount += balance;
      if (!row.oldestDue || (dueDate && dueDate < row.oldestDue)) row.oldestDue = dueDate;
    });

    const finePayments = (payments || []).filter((item) => {
      if (String(item.direction || '').toLowerCase() !== 'in') return false;

      const paymentType = String(item.type || '').toLowerCase();
      const fineAmount = numberValue(
        item.fineAmount
          ?? (paymentType.includes('fine') ? item.amount : 0),
      );

      if (fineAmount <= 0) return false;

      const paymentDate = String(item.date || item.paymentDate || item.createdAt || '').slice(0, 10);
      return hasDateFilter ? inRange(paymentDate, fromDate, toDate) : true;
    });

    const pendingCustomers = [...pendingByCustomer.values()]
      .map((row) => {
        const matchingFinePayments = finePayments.filter((payment) => {
          const linkedLoan = linkedLoanFor(payment);
          const paymentCustomerId = String(payment.customerId || linkedLoan.customerId || '');
          const paymentLoanId = String(payment.loanId || linkedLoan.loanId || linkedLoan.id || '');
          const paymentDate = String(payment.date || payment.paymentDate || payment.createdAt || '').slice(0, 10);

          const customerMatches = paymentCustomerId
            && (
              paymentCustomerId === String(row.customerDbId || '')
              || paymentCustomerId === String(row.customerId || '')
            );
          const loanMatches = paymentLoanId && row.loanIds.has(paymentLoanId);
          const relatesToPendingPeriod = !row.oldestDue || !paymentDate || paymentDate >= row.oldestDue;

          return (customerMatches || loanMatches) && relatesToPendingPeriod;
        });
        const finesPaidCount = matchingFinePayments.length;
        const finePaid = finesPaidCount > 0;

        // 3+ pending dues: Pending if the customer has kept paying fines
        // (2+ paid) despite falling behind; Risky if they haven't been
        // paying fines at all. Fewer than 3 dues: Fine Paid if any fine
        // was paid, else Normal.
        const category = row.pendingDueCount >= 3
          ? (finesPaidCount >= 2 ? 'pending' : 'risky')
          : finePaid
            ? 'fine-paid'
            : 'normal';

        return {
          ...row,
          loanIds: [...row.loanIds],
          cycles: [...row.cycles],
          finePaid,
          finesPaidCount,
          category,
          categoryLabel: category === 'risky'
            ? 'Risky'
            : category === 'pending'
              ? 'Pending'
              : category === 'fine-paid'
                ? 'Fine Paid'
                : 'Normal',
        };
      })
      .sort((a, b) => {
        if (b.pendingDueCount !== a.pendingDueCount) return b.pendingDueCount - a.pendingDueCount;
        if (b.pendingAmount !== a.pendingAmount) return b.pendingAmount - a.pendingAmount;
        return String(a.customerName || '').localeCompare(String(b.customerName || ''));
      });

    return {
      hasDateFilter,
      rangeLabel: hasDateFilter ? overviewRangeLabel : 'Overall live portfolio',
      activeLoans: activeLoans.length,
      closedLoans: closedLoans.length,
      activePercent,
      closedPercent,
      pendingCustomers,
      normalCustomers: pendingCustomers.filter((row) => row.category === 'normal'),
      riskyCustomers: pendingCustomers.filter((row) => row.category === 'risky'),
      finePaidCustomers: pendingCustomers.filter((row) => row.category === 'fine-paid'),
      pendingTierCustomers: pendingCustomers.filter((row) => row.category === 'pending'),
    };
  }, [
    loans,
    collections,
    payments,
    customerById,
    fromDate,
    toDate,
    overviewRangeLabel,
  ]);

  const filteredOverviewPendingCustomers = useMemo(() => {
    if (overviewPendingRiskFilter === 'risky') return overviewPerformanceReport.riskyCustomers;
    if (overviewPendingRiskFilter === 'pending') return overviewPerformanceReport.pendingTierCustomers;
    if (overviewPendingRiskFilter === 'fine-paid') return overviewPerformanceReport.finePaidCustomers;
    return overviewPerformanceReport.normalCustomers;
  }, [overviewPerformanceReport, overviewPendingRiskFilter]);

  const cyclePerformanceReport = useMemo(() => {
    const selectedCycle = view === 'daily'
      ? 'Daily'
      : view === 'weekly'
        ? 'Weekly'
        : view === 'monthly'
          ? 'Monthly'
          : null;

    if (!selectedCycle) return null;

    const today = toInputDate();
    const selectedKey = selectedCycle.toLowerCase();
    const hasDateFilter = Boolean(fromDate || toDate);

    const isClosedLoan = (loan) => {
      const status = String(loan?.status || '')
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, '-');

      return status === 'closed'
        || status === 'preclosed'
        || status === 'pre-closed'
        || Boolean(loan?.closedDate || loan?.closedAt || loan?.preclosedAt)
        || (loan?.outstanding !== null
          && loan?.outstanding !== undefined
          && numberValue(loan.outstanding) <= 0);
    };

    const loanIdentity = (loan) => [
      loan?.id,
      loan?.loanId,
      loan?.loanCode,
      loan?.code,
      loan?.loanDbId,
      loan?.dbLoanId,
    ]
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      .map((value) => String(value));

    const cycleLoanLookup = new Map();
    (loans || []).forEach((loan) => {
      loanIdentity(loan).forEach((key) => cycleLoanLookup.set(key, loan));
    });

    const linkedLoanFor = (item) => {
      const keys = [
        item?.loanId,
        item?.loanCode,
        item?.loanDbId,
        item?.dbLoanId,
        item?.loan?.id,
        item?.loan?.loanId,
      ]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
        .map((value) => String(value));

      for (const key of keys) {
        const match = cycleLoanLookup.get(key);
        if (match) return match;
      }
      return {};
    };

    const cycleLoans = (loans || []).filter(
      (loan) => String(loan.cycle || '').toLowerCase() === selectedKey,
    );
    const activeLoans = cycleLoans.filter((loan) => !isClosedLoan(loan));
    const closedLoans = cycleLoans.filter((loan) => isClosedLoan(loan));

    const totalCustomerIds = new Set(
      cycleLoans
        .map((loan) => loan.customerId)
        .filter((id) => id !== null && id !== undefined && String(id).trim() !== '')
        .map(String),
    );
    const activeCustomerIds = new Set(
      activeLoans
        .map((loan) => loan.customerId)
        .filter((id) => id !== null && id !== undefined && String(id).trim() !== '')
        .map(String),
    );
    const closedCustomerIds = new Set(
      closedLoans
        .map((loan) => loan.customerId)
        .filter((id) => id !== null && id !== undefined && String(id).trim() !== '')
        .map(String)
        .filter((id) => !activeCustomerIds.has(id)),
    );

    const outstandingAmount = activeLoans.reduce(
      (sum, loan) => sum + Math.max(0, numberValue(loan.outstanding)),
      0,
    );

    const cycleCollectionPayments = (payments || []).filter((item) => {
      if (String(item.type || '').toLowerCase() !== 'collection') return false;
      if (String(item.direction || '').toLowerCase() !== 'in') return false;

      const linkedLoan = linkedLoanFor(item);
      const paymentCycle = item.cycle || linkedLoan.cycle || '';
      if (String(paymentCycle).toLowerCase() !== selectedKey) return false;

      const paymentDate = String(item.date || item.paymentDate || item.createdAt || '').slice(0, 10);
      return hasDateFilter ? inRange(paymentDate, fromDate, toDate) : true;
    });

    const collectedAmount = cycleCollectionPayments.reduce(
      (sum, item) => sum + numberValue(item.collectionAmount ?? item.amount),
      0,
    );

    const pendingScheduleRows = (collections || []).filter((item) => {
      if (String(item.cycle || '').toLowerCase() !== selectedKey) return false;
      if (String(item.status || '').toLowerCase() === 'cancelled') return false;

      const dueDate = String(item.date || '').slice(0, 10);
      if (!dueDate || dueDate > today) return false;
      if (hasDateFilter && !inRange(dueDate, fromDate, toDate)) return false;

      return Math.max(
        0,
        numberValue(item.dueAmount) - numberValue(item.paidAmount),
      ) > 0;
    });

    const pendingAmount = pendingScheduleRows.reduce(
      (sum, item) => sum + Math.max(
        0,
        numberValue(item.dueAmount) - numberValue(item.paidAmount),
      ),
      0,
    );

    const pendingByCustomer = new Map();

    pendingScheduleRows.forEach((item) => {
      const linkedLoan = linkedLoanFor(item);
      const customerKey = String(item.customerId || linkedLoan.customerId || item.customerName || 'unknown');
      const customer = customerById[String(item.customerId || linkedLoan.customerId)] || {};
      const dueDate = String(item.date || '').slice(0, 10);
      const balance = Math.max(
        0,
        numberValue(item.dueAmount) - numberValue(item.paidAmount),
      );
      const loanId = item.loanId || linkedLoan.loanId || linkedLoan.id || '';

      if (!pendingByCustomer.has(customerKey)) {
        pendingByCustomer.set(customerKey, {
          key: customerKey,
          customerDbId: item.customerId || linkedLoan.customerId || customer.id || '',
          customerId: customer.customerId || item.customerCode || item.customerId || linkedLoan.customerId || '—',
          customerName: item.customerName || linkedLoan.customerName || customer.name || 'Customer',
          loanIds: new Set(),
          pendingDueCount: 0,
          pendingAmount: 0,
          oldestDue: dueDate,
          finePaid: false,
        });
      }

      const row = pendingByCustomer.get(customerKey);
      if (loanId) row.loanIds.add(String(loanId));
      row.pendingDueCount += 1;
      row.pendingAmount += balance;
      if (!row.oldestDue || (dueDate && dueDate < row.oldestDue)) row.oldestDue = dueDate;
    });

    const finePayments = (payments || []).filter((item) => {
      if (String(item.direction || '').toLowerCase() !== 'in') return false;
      const paymentType = String(item.type || '').toLowerCase();
      const fineAmount = numberValue(
        item.fineAmount
          ?? (paymentType.includes('fine') ? item.amount : 0),
      );
      if (fineAmount <= 0) return false;

      const paymentDate = String(item.date || item.paymentDate || item.createdAt || '').slice(0, 10);
      return hasDateFilter ? inRange(paymentDate, fromDate, toDate) : true;
    });

    const pendingCustomers = [...pendingByCustomer.values()]
      .map((row) => {
        const matchingFinePayments = finePayments.filter((payment) => {
          const linkedLoan = linkedLoanFor(payment);
          const paymentCustomerId = String(payment.customerId || linkedLoan.customerId || '');
          const paymentLoanId = String(payment.loanId || linkedLoan.loanId || linkedLoan.id || '');
          const paymentDate = String(payment.date || payment.paymentDate || payment.createdAt || '').slice(0, 10);

          const customerMatches = paymentCustomerId
            && (
              paymentCustomerId === String(row.customerDbId || '')
              || paymentCustomerId === String(row.customerId || '')
            );
          const loanMatches = paymentLoanId && row.loanIds.has(paymentLoanId);
          const relatesToPendingPeriod = !row.oldestDue || !paymentDate || paymentDate >= row.oldestDue;

          return (customerMatches || loanMatches) && relatesToPendingPeriod;
        });
        const finesPaidCount = matchingFinePayments.length;
        const finePaid = finesPaidCount > 0;

        // 3+ pending dues: Pending if the customer has kept paying fines
        // (2+ paid) despite falling behind; Risky if they haven't been
        // paying fines at all. Fewer than 3 dues: Fine Paid if any fine
        // was paid, else Normal.
        const category = row.pendingDueCount >= 3
          ? (finesPaidCount >= 2 ? 'pending' : 'risky')
          : finePaid
            ? 'fine-paid'
            : 'normal';

        return {
          ...row,
          loanIds: [...row.loanIds],
          finePaid,
          finesPaidCount,
          category,
          categoryLabel: category === 'risky'
            ? 'Risky'
            : category === 'pending'
              ? 'Pending'
              : category === 'fine-paid'
                ? 'Fine Paid'
                : 'Normal',
        };
      })
      .sort((a, b) => {
        if (b.pendingDueCount !== a.pendingDueCount) return b.pendingDueCount - a.pendingDueCount;
        if (b.pendingAmount !== a.pendingAmount) return b.pendingAmount - a.pendingAmount;
        return String(a.customerName || '').localeCompare(String(b.customerName || ''));
      });

    const normalCustomers = pendingCustomers.filter((row) => row.category === 'normal');
    const riskyCustomers = pendingCustomers.filter((row) => row.category === 'risky');
    const finePaidCustomers = pendingCustomers.filter((row) => row.category === 'fine-paid');
    const pendingTierCustomers = pendingCustomers.filter((row) => row.category === 'pending');

    const totalPerformanceLoans = activeLoans.length + closedLoans.length;
    const activePercent = totalPerformanceLoans
      ? (activeLoans.length / totalPerformanceLoans) * 100
      : 0;
    const closedPercent = totalPerformanceLoans
      ? 100 - activePercent
      : 0;

    return {
      cycle: selectedCycle,
      hasDateFilter,
      rangeLabel: hasDateFilter ? overviewRangeLabel : 'Overall live cycle report',
      outstandingAmount,
      collectedAmount,
      pendingAmount,
      totalCustomers: totalCustomerIds.size,
      activeCustomers: activeCustomerIds.size,
      closedCustomers: closedCustomerIds.size,
      activeLoans: activeLoans.length,
      closedLoans: closedLoans.length,
      activePercent,
      closedPercent,
      pendingCustomers,
      normalCustomers,
      riskyCustomers,
      finePaidCustomers,
      pendingTierCustomers,
    };
  }, [
    view,
    loans,
    collections,
    payments,
    customerById,
    fromDate,
    toDate,
    overviewRangeLabel,
  ]);

  const filteredPendingCycleCustomers = useMemo(() => {
    if (!cyclePerformanceReport) return [];
    if (pendingRiskFilter === 'risky') return cyclePerformanceReport.riskyCustomers;
    if (pendingRiskFilter === 'pending') return cyclePerformanceReport.pendingTierCustomers;
    if (pendingRiskFilter === 'fine-paid') return cyclePerformanceReport.finePaidCustomers;
    return cyclePerformanceReport.normalCustomers;
  }, [cyclePerformanceReport, pendingRiskFilter]);

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

  const selectReportView = (nextView) => {
    setView(nextView);
    setPendingRiskFilter('normal');
    if (nextView === 'daily') setCycle('Daily');
    else if (nextView === 'weekly') setCycle('Weekly');
    else if (nextView === 'monthly') setCycle('Monthly');
    else setCycle('All');
  };

  const buildReportDetailUrl = (key, value) => {
    const params = new URLSearchParams();
    params.set(key, value);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    return `/reports?${params.toString()}`;
  };

  const openActivityPage = (activity) => {
    navigate(buildReportDetailUrl('activity', activity));
  };

  const openCapacityPage = (itemCycle) => {
    navigate(buildReportDetailUrl('capacity', String(itemCycle || '').toLowerCase()));
  };

  const activityPageTitle = activityPage === 'loans'
    ? 'New Loans Given'
    : activityPage === 'expenses'
      ? 'Expenses'
      : activityPage === 'fine'
        ? 'Fine Income'
        : activityPage === 'documents'
          ? 'Document Charges Income'
          : activityPage === 'savings'
            ? 'Savings'
            : '';

  const reportMeta = [
    ['Company', company?.name || 'CREDNIVO'],
    ['Branch', user?.branch || company?.branch || 'Current branch'],
    ['Prepared by', user?.displayName || user?.name || user?.fullName || (isOwner ? 'Owner' : 'Agent')],
    ['Generated', formatDate(toInputDate())],
    ['Period', overviewRangeLabel],
  ];

  const makeExportReport = () => {
    if (activityPage === 'loans') {
      return {
        fileBase: `crednivo-new-loans-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'New Loans Given Report',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [
          {
            title: 'Summary',
            metrics: [
              { label: 'Loans', value: activityTotals.loans.count, type: 'number' },
              { label: 'Total Loan Amount', value: activityTotals.loans.loanAmount, type: 'currency' },
              { label: 'Total Given Amount', value: activityTotals.loans.givenAmount, type: 'currency' },
            ],
          },
          {
          title: 'Loan Disbursement Details',
          columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'customerName', label: 'Customer' },
            { key: 'customerId', label: 'Customer ID' },
            { key: 'loanId', label: 'Loan ID' },
            { key: 'cycle', label: 'Cycle' },
            { key: 'loanAmount', label: 'Loan Amount', type: 'currency' },
            { key: 'givenAmount', label: 'Given Amount', type: 'currency' },
            { key: 'status', label: 'Status' },
          ],
          rows: newLoanDetailRows,
          },
        ],
      };
    }

    if (activityPage === 'expenses') {
      return {
        fileBase: `crednivo-expenses-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Expense Report',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [
          {
            title: 'Summary',
            metrics: [
              { label: 'Total Expenses', value: activityTotals.expenses.amount, type: 'currency' },
              { label: 'Expense Entries', value: activityTotals.expenses.count, type: 'number' },
            ],
          },
          {
          title: 'Expense Entries',
          columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'category', label: 'Category' },
            { key: 'description', label: 'Description' },
            { key: 'createdBy', label: 'Created By' },
            { key: 'amount', label: 'Amount', type: 'currency' },
          ],
          rows: expenseDetailRows,
          },
        ],
      };
    }

    if (activityPage === 'fine') {
      return {
        fileBase: `crednivo-fine-income-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Fine Income Report',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [
          {
            title: 'Summary',
            metrics: [
              { label: 'Total Fine Income', value: activityTotals.fine.amount, type: 'currency' },
              { label: 'Fine Entries', value: activityTotals.fine.count, type: 'number' },
            ],
          },
          {
          title: 'Fine Income Details',
          columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'customerName', label: 'Customer' },
            { key: 'customerId', label: 'Customer ID' },
            { key: 'loanId', label: 'Loan ID' },
            { key: 'paymentMode', label: 'Payment Mode' },
            { key: 'amount', label: 'Fine Amount', type: 'currency' },
          ],
          rows: fineDetailRows,
          },
        ],
      };
    }

    if (activityPage === 'documents') {
      return {
        fileBase: `crednivo-document-charges-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Document Charges Income Report',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [
          {
            title: 'Summary',
            metrics: [
              { label: 'Total Document Charges', value: activityTotals.documents.amount, type: 'currency' },
              { label: 'Document Charge Entries', value: activityTotals.documents.count, type: 'number' },
            ],
          },
          {
          title: 'Document Charge Details',
          columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'customerName', label: 'Customer' },
            { key: 'customerId', label: 'Customer ID' },
            { key: 'loanId', label: 'Loan ID' },
            { key: 'reference', label: 'Reference' },
            { key: 'amount', label: 'Document Charge', type: 'currency' },
          ],
          rows: documentChargeDetailRows,
          },
        ],
      };
    }

    if (activityPage === 'savings') {
      return {
        fileBase: `crednivo-savings-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Savings Report',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [
          {
            title: 'Summary',
            metrics: [
              { label: 'Total Savings', value: activityTotals.savings.amount, type: 'currency' },
              { label: 'Savings Entries', value: activityTotals.savings.count, type: 'number' },
            ],
          },
          {
          title: 'Savings Entries',
          columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'description', label: 'Description' },
            { key: 'createdBy', label: 'Created By' },
            { key: 'amount', label: 'Amount', type: 'currency' },
          ],
          rows: savingsDetailRows,
          },
        ],
      };
    }

    if (capacityPage) {
      return {
        fileBase: `crednivo-${capacityPage}-collection-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Collection Capacity',
        title: `${capacityCycle} Collection Report`,
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [
          {
            title: 'Cycle Summary',
            metrics: [
              { label: 'Collection / Cycle', value: selectedOverviewCycleSummary?.amount || 0, type: 'currency' },
              { label: 'Active Loans', value: selectedOverviewCycleSummary?.loanCount || 0, type: 'number' },
              { label: 'Customers', value: selectedOverviewCycleSummary?.customerCount || 0, type: 'number' },
            ],
          },
          {
            title: 'Customer Collection Details',
            columns: [
              { key: 'customerName', label: 'Customer' },
              { key: 'customerId', label: 'Customer ID' },
              { key: 'loanId', label: 'Loan ID' },
              { key: 'collectionPerCycle', label: 'Collection / Cycle', type: 'currency' },
              { key: 'expected', label: 'Expected', type: 'currency' },
              { key: 'received', label: 'Collected', type: 'currency' },
              { key: 'pending', label: 'Pending', type: 'currency' },
              { key: 'outstanding', label: 'Outstanding', type: 'currency' },
              { key: 'status', label: 'Status' },
            ],
            rows: overviewCycleCustomerRows,
          },
        ],
      };
    }

    if (view === 'cashbook') {
      return {
        fileBase: `crednivo-cash-book-${fromDate || 'all'}-${toDate || 'current'}`,
        badge: 'Cash Book',
        title: 'Daily Cash Book',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        cashBook: true,
        cashBookMonths: cashBookStatement.months,
        cashBookBalanceLabel: cashBookStatement.balanceLabel,
        sections: cashBookSections,
      };
    }

    const periodCycle = view === 'daily'
      ? 'Daily'
      : view === 'weekly'
        ? 'Weekly'
        : view === 'monthly'
          ? 'Monthly'
          : null;

    if (periodCycle && cyclePerformanceReport) {
      return {
        fileBase: `crednivo-${periodCycle.toLowerCase()}-report-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: `${periodCycle} Report`,
        title: `${periodCycle} Collection & Loan Performance Report`,
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [
          {
            title: `${periodCycle} Financial Summary`,
            metrics: [
              { label: 'Outstanding Amount', value: cyclePerformanceReport.outstandingAmount, type: 'currency' },
              { label: 'Collected Amount', value: cyclePerformanceReport.collectedAmount, type: 'currency' },
              { label: 'Pending Amount', value: cyclePerformanceReport.pendingAmount, type: 'currency' },
            ],
          },
          {
            title: `${periodCycle} Customer Summary`,
            metrics: [
              { label: 'Customer Count', value: cyclePerformanceReport.totalCustomers, type: 'number' },
              { label: 'Active Customers', value: cyclePerformanceReport.activeCustomers, type: 'number' },
              { label: 'Closed Customers', value: cyclePerformanceReport.closedCustomers, type: 'number' },
            ],
          },
          {
            title: 'Loan Performance',
            columns: [
              { key: 'status', label: 'Loan Status' },
              { key: 'count', label: 'Loan Count', type: 'number' },
              { key: 'share', label: 'Share' },
            ],
            rows: [
              {
                status: 'Active Loans',
                count: cyclePerformanceReport.activeLoans,
                share: `${cyclePerformanceReport.activePercent.toFixed(1)}%`,
              },
              {
                status: 'Closed Loans',
                count: cyclePerformanceReport.closedLoans,
                share: `${cyclePerformanceReport.closedPercent.toFixed(1)}%`,
              },
            ],
          },
          {
            title: 'Pending Customer Risk List',
            note: 'Normal = 1–2 pending dues · Fine Paid = 1–2 pending dues with fine paid · Risky = 3+ pending dues even if fine was paid.',
            columns: [
              { key: 'customerName', label: 'Customer' },
              { key: 'customerId', label: 'Customer ID' },
              { key: 'loanIdsText', label: 'Loan ID(s)' },
              { key: 'pendingDueCount', label: 'Pending Dues', type: 'number' },
              { key: 'pendingAmount', label: 'Pending Amount', type: 'currency' },
              { key: 'oldestDue', label: 'Oldest Due', type: 'date' },
              { key: 'categoryLabel', label: 'Risk Status' },
            ],
            rows: cyclePerformanceReport.pendingCustomers.map((row) => ({
              ...row,
              loanIdsText: row.loanIds.join(', '),
            })),
          },
        ],
      };
    }

    return {
      fileBase: `crednivo-business-statement-${fromDate || 'all'}-${toDate || 'current'}`,
      badge: 'Business Statement',
      title: 'Business Statement',
      company: company?.name || 'CREDNIVO',
      generated: formatDate(toInputDate()),
      meta: reportMeta,
      bankStatement: true,
      statementMonths: overviewBankStatement.months,
      statementBalanceLabel: overviewBankStatement.balanceLabel,
      sections: overviewStatementSections,
    };
  };

  const openDownloadDialog = () => {
    setDownloadError('');
    setDownloadOpen(true);
  };

  const handleDownloadFormat = async (format) => {
    if (downloadBusy) return;
    setDownloadBusy(format);
    setDownloadError('');
    try {
      const report = makeExportReport();
      if (format === 'pdf') await exportReportPdf(report);
      else if (format === 'excel') await exportReportExcel(report);
      else if (format === 'doc') await exportReportDoc(report);
      setDownloadOpen(false);
    } catch (error) {
      console.error('Report export failed', error);
      setDownloadError(error?.message || 'Unable to generate this report file.');
    } finally {
      setDownloadBusy('');
    }
  };

  const downloadDialog = downloadOpen ? (
    <div className="reports-download-backdrop" role="presentation" onMouseDown={() => !downloadBusy && setDownloadOpen(false)}>
      <section
        className="reports-download-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-download-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="reports-download-dialog-head">
          <div>
            <span>EXPORT REPORT</span>
            <strong id="reports-download-title">Choose document type</strong>
            <small>Each format uses its own professional report layout.</small>
          </div>
          <button
            type="button"
            className="reports-download-close"
            onClick={() => setDownloadOpen(false)}
            disabled={Boolean(downloadBusy)}
            aria-label="Close download options"
          >
            <X size={18} />
          </button>
        </div>

        <div className="reports-download-options">
          <button type="button" onClick={() => handleDownloadFormat('pdf')} disabled={Boolean(downloadBusy)}>
            <span className="reports-download-format-icon pdf"><FileDown size={22} /></span>
            <div>
              <strong>PDF</strong>
              <small>Professional printable report with page header, tables and page numbers.</small>
            </div>
            <b>{downloadBusy === 'pdf' ? 'Creating…' : '.pdf'}</b>
          </button>

          <button type="button" onClick={() => handleDownloadFormat('excel')} disabled={Boolean(downloadBusy)}>
            <span className="reports-download-format-icon excel"><FileSpreadsheet size={22} /></span>
            <div>
              <strong>EXCEL</strong>
              <small>Real spreadsheet cells with title, metadata, section headings and structured tables.</small>
            </div>
            <b>{downloadBusy === 'excel' ? 'Creating…' : '.xlsx'}</b>
          </button>

          <button type="button" onClick={() => handleDownloadFormat('doc')} disabled={Boolean(downloadBusy)}>
            <span className="reports-download-format-icon doc"><FileText size={22} /></span>
            <div>
              <strong>DOC</strong>
              <small>Editable Word document with report headings and properly formatted tables.</small>
            </div>
            <b>{downloadBusy === 'doc' ? 'Creating…' : '.docx'}</b>
          </button>
        </div>

        {downloadError && <div className="reports-download-error">{downloadError}</div>}
      </section>
    </div>
  ) : null;

  if (activityPage || capacityPage) {
    return (
      <div className="module-page reports-page phase5-reports reports-dedicated-detail-page">
        <ModuleHeader
          eyebrow={activityPage ? 'Reports · Business Activity' : 'Reports · Collection Capacity'}
          title={activityPage ? activityPageTitle : `${capacityCycle} Collection`}
          description={overviewRangeLabel}
          actions={(
            <div className="page-actions-row">
              <PageBackButton />
              <DownloadMenu
                onPdf={() => handleDownloadFormat('pdf')}
                onXlsx={() => handleDownloadFormat('excel')}
                xlsxNote="Excel report"
              />
            </div>
          )}
        />

        {activityPage && (
          <section className="reports-dedicated-detail-card">
            <div className="reports-dedicated-detail-head">
              <div>
                <span>ACTIVITY DETAILS</span>
                <strong>{activityPageTitle}</strong>
                <small>{overviewRangeLabel}</small>
              </div>
              <div className="reports-dedicated-summary reports-dedicated-summary-grid">
                <div>
                  <strong>
                    {activityPage === 'loans' && formatCurrency(activityTotals.loans.loanAmount)}
                    {activityPage === 'expenses' && formatCurrency(activityTotals.expenses.amount)}
                    {activityPage === 'fine' && formatCurrency(activityTotals.fine.amount)}
                    {activityPage === 'documents' && formatCurrency(activityTotals.documents.amount)}
                    {activityPage === 'savings' && formatCurrency(activityTotals.savings.amount)}
                  </strong>
                  <small>
                    {activityPage === 'loans' ? 'Total Loan Amount'
                      : activityPage === 'expenses' ? 'Total Expenses'
                        : activityPage === 'fine' ? 'Total Fine Income'
                          : activityPage === 'documents' ? 'Total Document Charges'
                            : 'Total Savings'}
                  </small>
                </div>
                <div>
                  <strong>
                    {activityPage === 'loans' && activityTotals.loans.count}
                    {activityPage === 'expenses' && activityTotals.expenses.count}
                    {activityPage === 'fine' && activityTotals.fine.count}
                    {activityPage === 'documents' && activityTotals.documents.count}
                    {activityPage === 'savings' && activityTotals.savings.count}
                  </strong>
                  <small>Entries</small>
                </div>
              </div>
            </div>

            {activityPage === 'loans' && (
              newLoanDetailRows.length ? (
                <>
                  <div className="reports-activity-detail-table-wrap">
                    <table className="reports-activity-detail-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Customer ID</th>
                          <th>Loan ID</th>
                          <th>Cycle</th>
                          <th>Loan Amount</th>
                          <th>Given Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newLoanDetailRows.map((row) => (
                          <tr key={row.key}>
                            <td>{formatDate(row.date)}</td>
                            <td>
                              <strong>
                                {row.customerDbId
                                  ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink>
                                  : row.customerName}
                              </strong>
                            </td>
                            <td>{row.customerId}</td>
                            <td><strong>{row.loanId}</strong></td>
                            <td>{row.cycle}</td>
                            <td>{formatCurrency(row.loanAmount)}</td>
                            <td>{formatCurrency(row.givenAmount)}</td>
                            <td><span className="reports-cycle-detail-status">{row.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="5">Total</td>
                          <td>{formatCurrency(activityTotals.loans.loanAmount)}</td>
                          <td>{formatCurrency(activityTotals.loans.givenAmount)}</td>
                          <td>{activityTotals.loans.count} loan{activityTotals.loans.count === 1 ? '' : 's'}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="reports-activity-detail-mobile">
                    {newLoanDetailRows.map((row) => (
                      <article key={`m-${row.key}`} className="reports-activity-detail-mobile-card">
                        <div className="reports-activity-detail-mobile-top">
                          <div>
                            <span>{formatDate(row.date)}</span>
                            <strong>
                              {row.customerDbId
                                ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink>
                                : row.customerName}
                            </strong>
                            <small>{row.customerId} · {row.loanId}</small>
                          </div>
                          <span className="reports-cycle-detail-status">{row.status}</span>
                        </div>
                        <div className="reports-activity-detail-mobile-grid">
                          <div><span>Cycle</span><strong>{row.cycle}</strong></div>
                          <div><span>Loan Amount</span><strong>{formatCurrency(row.loanAmount)}</strong></div>
                          <div><span>Given Amount</span><strong>{formatCurrency(row.givenAmount)}</strong></div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : <div className="reports-overview-cycle-empty">No new loans found for {overviewRangeLabel.toLowerCase()}.</div>
            )}

            {activityPage === 'expenses' && (
              expenseDetailRows.length ? (
                <>
                  <div className="reports-activity-detail-table-wrap">
                    <table className="reports-activity-detail-table">
                      <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Created By</th><th>Amount</th></tr></thead>
                      <tbody>
                        {expenseDetailRows.map((row) => (
                          <tr key={row.key}>
                            <td>{formatDate(row.date)}</td>
                            <td><strong>{row.category}</strong></td>
                            <td>{row.description}</td>
                            <td>{row.createdBy}</td>
                            <td className="reports-activity-amount-out">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4">Total Expenses</td>
                          <td className="reports-activity-amount-out">{formatCurrency(activityTotals.expenses.amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="reports-activity-detail-mobile">
                    {expenseDetailRows.map((row) => (
                      <article key={`m-${row.key}`} className="reports-activity-detail-mobile-card">
                        <div className="reports-activity-detail-mobile-top">
                          <div><span>{formatDate(row.date)}</span><strong>{row.category}</strong><small>{row.description}</small></div>
                          <strong className="amount-out">{formatCurrency(row.amount)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : <div className="reports-overview-cycle-empty">No expenses found for {overviewRangeLabel.toLowerCase()}.</div>
            )}

            {activityPage === 'fine' && (
              fineDetailRows.length ? (
                <>
                  <div className="reports-activity-detail-table-wrap">
                    <table className="reports-activity-detail-table">
                      <thead><tr><th>Date</th><th>Customer</th><th>Customer ID</th><th>Loan ID</th><th>Mode</th><th>Fine Amount</th></tr></thead>
                      <tbody>
                        {fineDetailRows.map((row) => (
                          <tr key={row.key}>
                            <td>{formatDate(row.date)}</td>
                            <td><strong>{row.customerDbId ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink> : row.customerName}</strong></td>
                            <td>{row.customerId}</td>
                            <td><strong>{row.loanId}</strong></td>
                            <td>{row.paymentMode}</td>
                            <td className="reports-activity-amount-in">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="5">Total Fine Income</td>
                          <td className="reports-activity-amount-in">{formatCurrency(activityTotals.fine.amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="reports-activity-detail-mobile">
                    {fineDetailRows.map((row) => (
                      <article key={`m-${row.key}`} className="reports-activity-detail-mobile-card">
                        <div className="reports-activity-detail-mobile-top">
                          <div>
                            <span>{formatDate(row.date)}</span>
                            <strong>{row.customerDbId ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink> : row.customerName}</strong>
                            <small>{row.customerId} · {row.loanId}</small>
                          </div>
                          <strong className="amount-in">{formatCurrency(row.amount)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : <div className="reports-overview-cycle-empty">No fine income found for {overviewRangeLabel.toLowerCase()}.</div>
            )}

            {activityPage === 'documents' && (
              documentChargeDetailRows.length ? (
                <>
                  <div className="reports-activity-detail-table-wrap">
                    <table className="reports-activity-detail-table">
                      <thead><tr><th>Date</th><th>Customer</th><th>Customer ID</th><th>Loan ID</th><th>Reference</th><th>Document Charge</th></tr></thead>
                      <tbody>
                        {documentChargeDetailRows.map((row) => (
                          <tr key={row.key}>
                            <td>{formatDate(row.date)}</td>
                            <td><strong>{row.customerDbId ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink> : row.customerName}</strong></td>
                            <td>{row.customerId}</td>
                            <td><strong>{row.loanId}</strong></td>
                            <td>{row.reference}</td>
                            <td className="reports-activity-amount-in">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="5">Total Document Charges</td>
                          <td className="reports-activity-amount-in">{formatCurrency(activityTotals.documents.amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="reports-activity-detail-mobile">
                    {documentChargeDetailRows.map((row) => (
                      <article key={`m-${row.key}`} className="reports-activity-detail-mobile-card">
                        <div className="reports-activity-detail-mobile-top">
                          <div>
                            <span>{formatDate(row.date)}</span>
                            <strong>{row.customerDbId ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink> : row.customerName}</strong>
                            <small>{row.customerId} · {row.loanId}</small>
                          </div>
                          <strong className="amount-in">{formatCurrency(row.amount)}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : <div className="reports-overview-cycle-empty">No document charges found for {overviewRangeLabel.toLowerCase()}.</div>
            )}

            {activityPage === 'savings' && (
              isOwner ? (
                savingsDetailRows.length ? (
                  <>
                    <div className="reports-activity-detail-table-wrap">
                      <table className="reports-activity-detail-table">
                        <thead><tr><th>Date</th><th>Description</th><th>Created By</th><th>Amount</th></tr></thead>
                        <tbody>
                          {savingsDetailRows.map((row) => (
                            <tr key={row.key}>
                              <td>{formatDate(row.date)}</td>
                              <td><strong>{row.description}</strong></td>
                              <td>{row.createdBy}</td>
                              <td className="reports-activity-amount-saving">{formatCurrency(row.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan="3">Total Savings</td>
                            <td className="reports-activity-amount-saving">{formatCurrency(activityTotals.savings.amount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="reports-activity-detail-mobile">
                      {savingsDetailRows.map((row) => (
                        <article key={`m-${row.key}`} className="reports-activity-detail-mobile-card">
                          <div className="reports-activity-detail-mobile-top">
                            <div><span>{formatDate(row.date)}</span><strong>{row.description}</strong><small>{row.createdBy}</small></div>
                            <strong className="amount-saving">{formatCurrency(row.amount)}</strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : <div className="reports-overview-cycle-empty">No savings found for {overviewRangeLabel.toLowerCase()}.</div>
              ) : <div className="reports-overview-cycle-empty">Savings details are available to the Owner only.</div>
            )}
          </section>
        )}

        {capacityPage && (
          <section className="reports-dedicated-detail-card">
            <div className="reports-dedicated-detail-head">
              <div>
                <span>{capacityCycle.toUpperCase()} DETAILS</span>
                <strong>{capacityCycle} Customer Collection Details</strong>
                <small>{overviewRangeLabel}</small>
              </div>
              <div className="reports-dedicated-summary">
                <strong>{formatCurrency(selectedOverviewCycleSummary?.amount || 0)}</strong>
                <small>Collection / cycle</small>
              </div>
            </div>

            {overviewCycleCustomerRows.length ? (
              <>
                <div className="reports-overview-cycle-detail-table-wrap">
                  <table className="reports-overview-cycle-detail-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Loan</th>
                        <th>Collection / Cycle</th>
                        <th>Expected</th>
                        <th>Collected</th>
                        <th>Pending</th>
                        <th>Outstanding</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overviewCycleCustomerRows.map((row) => (
                        <tr key={row.key}>
                          <td>
                            <div className="reports-cycle-customer">
                              <CustomerAvatar
                                className="reports-cycle-customer-avatar"
                                photo={customerPhotoById[String(row.customerId)]}
                                name={row.customerName}
                              />
                              <div>
                                <strong><CustomerProfileLink customerId={row.customerId}>{row.customerName}</CustomerProfileLink></strong>
                                <small>{row.customerId || '—'}</small>
                              </div>
                            </div>
                          </td>
                          <td><strong>{row.loanId || '—'}</strong></td>
                          <td>{formatCurrency(row.collectionPerCycle)}</td>
                          <td>{formatCurrency(row.expected)}</td>
                          <td className="reports-cycle-detail-collected">{formatCurrency(row.received)}</td>
                          <td className="reports-cycle-detail-pending">{formatCurrency(row.pending)}</td>
                          <td>{formatCurrency(row.outstanding)}</td>
                          <td><span className={`reports-cycle-detail-status status-${String(row.status || '').toLowerCase()}`}>{row.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="reports-overview-cycle-mobile-list">
                  {overviewCycleCustomerRows.map((row) => (
                    <article className="reports-overview-cycle-mobile-card" key={`mobile-${row.key}`}>
                      <div className="reports-cycle-mobile-top">
                        <div className="reports-cycle-customer">
                          <CustomerAvatar
                            className="reports-cycle-customer-avatar"
                            photo={customerPhotoById[String(row.customerId)]}
                            name={row.customerName}
                          />
                          <div>
                            <strong><CustomerProfileLink customerId={row.customerId}>{row.customerName}</CustomerProfileLink></strong>
                            <small>{row.customerId || '—'} · {row.loanId || '—'}</small>
                          </div>
                        </div>
                        <span className={`reports-cycle-detail-status status-${String(row.status || '').toLowerCase()}`}>{row.status}</span>
                      </div>
                      <div className="reports-cycle-mobile-values">
                        <div><span>Collection</span><strong>{formatCurrency(row.collectionPerCycle)}</strong></div>
                        <div><span>Expected</span><strong>{formatCurrency(row.expected)}</strong></div>
                        <div><span>Collected</span><strong className="positive">{formatCurrency(row.received)}</strong></div>
                        <div><span>Pending</span><strong className="pending">{formatCurrency(row.pending)}</strong></div>
                        <div><span>Outstanding</span><strong>{formatCurrency(row.outstanding)}</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="reports-overview-cycle-empty">No {capacityCycle.toLowerCase()} customer records are available for {overviewRangeLabel.toLowerCase()}.</div>
            )}
          </section>
        )}

        {downloadDialog}
        {!downloadOpen && downloadError && <div className="form-error" role="alert">{downloadError}</div>}
      </div>
    );
  }

  return (
    <div className="module-page reports-page phase5-reports">
      <ModuleHeader
        eyebrow="Phase 5.1 · Reports"
        title="Reports & Analytics"
        actions={(
          <div className="page-actions-row">
            <PageBackButton />
            <ActionButton tone="secondary" icon={Printer} onClick={() => window.print()}>Print</ActionButton>
            <DownloadMenu
              onPdf={() => handleDownloadFormat('pdf')}
              onXlsx={() => handleDownloadFormat('excel')}
              xlsxNote="Excel report"
            />
          </div>
        )}
      />

      <div className="reports-tabs-row">
        <div className="reports-view-tabs" role="tablist" aria-label="Report view">
          <button type="button" className={view === 'overview' ? 'active' : ''} onClick={() => selectReportView('overview')}><BarChart3 size={17} />Overview</button>
          <button type="button" className={view === 'cashbook' ? 'active' : ''} onClick={() => selectReportView('cashbook')}><WalletCards size={17} />Cash Book</button>
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
        <ReportActivityBoard
          customers={customers}
          loans={loans}
          collections={collections}
          payments={payments}
          expenses={expenses}
          savings={savings}
          capitalMetrics={capitalMetrics}
        />
      )}

      {view === 'overview' && (
        <section className="reports-overall-report" aria-label="Overall report summary">
          <div className="reports-overall-section-heading">
            <div>
              <strong>Current Collection Capacity</strong>
            </div>
            <small>{overviewRangeLabel}</small>
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
                <button
                  type="button"
                  key={item.cycle}
                  className={`reports-overall-cycle-card reports-overall-cycle-button reports-overall-cycle-${item.cycle.toLowerCase()}`}
                  onClick={() => openCapacityPage(item.cycle)}
                >
                  <span className="reports-overall-cycle-icon">
                    <CycleIcon size={19} />
                  </span>
                  <div>
                    <span>{item.cycle} Collection</span>
                    <strong>{formatCurrency(item.amount)}</strong>
                    <small>
                      {item.customerCount} customer{item.customerCount === 1 ? '' : 's'}
                      {' · '}
                      {item.loanCount} active loan{item.loanCount === 1 ? '' : 's'}
                      {' · '}
                      per {cycleUnit}
                    </small>
                  </div>
                </button>
              );
            })}
          </div>

        </section>
      )}

      {view === 'cashbook' && (
        <section className="reports-cycle-performance-page" aria-label="Daily cash book">
          <div className="reports-cycle-performance-head">
            <div>
              <h2>Daily Cash Book</h2>
              <p>Principal, profit, interest (late fines), other income, expense, lending and savings — with a running in-hand balance carried forward day by day and month to month.</p>
            </div>
          </div>

          {cashBookStatement.months.length === 0 && (
            <div className="reports-cycle-pending-empty">No transactions found for the selected date range.</div>
          )}

          {cashBookStatement.months.map((month) => (
            <div className="reports-overview-panel" key={month.key} style={{ marginTop: 16 }}>
              <div className="reports-cycle-performance-head">
                <div>
                  <h3>{month.label}</h3>
                  <p>
                    Opening {formatCurrency(month.openingBalance)} · Closing {formatCurrency(month.closingBalance)}
                  </p>
                </div>
              </div>
              <div className="reports-activity-detail-table-wrap">
                <table className="reports-activity-detail-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Date</th>
                      <th>Principal</th>
                      <th>Profit</th>
                      <th>Interest</th>
                      <th>Other Income</th>
                      <th>Expense</th>
                      <th>Lending Amount</th>
                      <th>Savings</th>
                      <th>{cashBookStatement.balanceLabel}</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {month.rows.map((row) => (
                      <tr key={row.date}>
                        <td>{row.sNo}</td>
                        <td>{formatDate(row.date)}</td>
                        <td>{row.principal ? formatCurrency(row.principal) : '—'}</td>
                        <td>{row.profit ? formatCurrency(row.profit) : '—'}</td>
                        <td>{row.interest ? formatCurrency(row.interest) : '—'}</td>
                        <td>{row.otherIncome ? formatCurrency(row.otherIncome) : '—'}</td>
                        <td>{row.expense ? formatCurrency(row.expense) : '—'}</td>
                        <td>{row.lending ? formatCurrency(row.lending) : '—'}</td>
                        <td>{row.savings ? formatCurrency(row.savings) : '—'}</td>
                        <td>{formatCurrency(row.inHandAmount)}</td>
                        <td>{row.remarks || '—'}</td>
                      </tr>
                    ))}
                    <tr className="reports-activity-detail-total-row">
                      <td colSpan={2}>TOTAL</td>
                      <td>{formatCurrency(month.totalPrincipal)}</td>
                      <td>{formatCurrency(month.totalProfit)}</td>
                      <td>{formatCurrency(month.totalInterest)}</td>
                      <td>{formatCurrency(month.totalOtherIncome)}</td>
                      <td>{formatCurrency(month.totalExpense)}</td>
                      <td>{formatCurrency(month.totalLending)}</td>
                      <td>{formatCurrency(month.totalSavings)}</td>
                      <td>{formatCurrency(month.closingBalance)}</td>
                      <td>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      {view !== 'overview' && view !== 'cashbook' && cyclePerformanceReport && (
        <section className="reports-cycle-performance-page" aria-label={`${cyclePerformanceReport.cycle} report`}>
          <div className="reports-cycle-performance-head">
            <div>
              <span>{cyclePerformanceReport.cycle.toUpperCase()} REPORT</span>
              <strong>{cyclePerformanceReport.cycle} Collection & Loan Performance</strong>
            </div>
            <small>{cyclePerformanceReport.rangeLabel}</small>
          </div>

          <div className="reports-cycle-report-kpi-grid">
            <MetricCard
              icon={Landmark}
              label="Outstanding"
              value={formatCurrency(cyclePerformanceReport.outstandingAmount)}
              sub="Current active loan balance"
              tone="blue"
            />
            <MetricCard
              icon={HandCoins}
              label="Collected"
              value={formatCurrency(cyclePerformanceReport.collectedAmount)}
              sub={cyclePerformanceReport.hasDateFilter ? 'Received in selected range' : 'Total collection received'}
              tone="green"
            />
            <MetricCard
              icon={TriangleAlert}
              label="Pending"
              value={formatCurrency(cyclePerformanceReport.pendingAmount)}
              sub={cyclePerformanceReport.hasDateFilter ? 'Pending dues in selected range' : 'Due / overdue balance'}
              tone="orange"
            />
          </div>

          <div className="reports-cycle-report-kpi-grid reports-cycle-customer-kpis">
            <MetricCard
              icon={UsersRound}
              label="Customer Count"
              value={cyclePerformanceReport.totalCustomers}
              sub={`All ${cyclePerformanceReport.cycle.toLowerCase()} customers`}
              tone="blue"
            />
            <MetricCard
              icon={Activity}
              label="Active Customers"
              value={cyclePerformanceReport.activeCustomers}
              sub="Currently having active loan"
              tone="green"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Closed Customers"
              value={cyclePerformanceReport.closedCustomers}
              sub="No active loan in this cycle"
              tone="purple"
            />
          </div>

          <div className="reports-cycle-performance-chart-card">
            <div className="reports-cycle-section-head">
              <div>
                <span>LOAN PERFORMANCE</span>
                <strong>{cyclePerformanceReport.cycle} Loan Performance</strong>
              </div>
              <small>Active vs Closed loans</small>
            </div>

            <div className="reports-loan-pie-layout">
              <div
                className={`reports-loan-pie ${cyclePerformanceReport.activeLoans + cyclePerformanceReport.closedLoans === 0 ? 'empty' : ''}`}
                style={{ '--active-share': `${cyclePerformanceReport.activePercent}%` }}
                role="img"
                aria-label={`${cyclePerformanceReport.activePercent.toFixed(1)} percent active loans and ${cyclePerformanceReport.closedPercent.toFixed(1)} percent closed loans`}
              />

              <div className="reports-loan-pie-legend">
                <div>
                  <span className="reports-pie-dot active" />
                  <div>
                    <small>Active Loans</small>
                    <strong>{cyclePerformanceReport.activeLoans}</strong>
                    <em>{cyclePerformanceReport.activePercent.toFixed(1)}%</em>
                  </div>
                </div>
                <div>
                  <span className="reports-pie-dot closed" />
                  <div>
                    <small>Closed Loans</small>
                    <strong>{cyclePerformanceReport.closedLoans}</strong>
                    <em>{cyclePerformanceReport.closedPercent.toFixed(1)}%</em>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="reports-cycle-pending-section">
            <div className="reports-cycle-section-head reports-cycle-pending-head">
              <div>
                <span>PENDING CUSTOMERS</span>
                <strong>Pending Customer List</strong>
                <small>
                  Normal: 1–2 dues · Fine Paid: 1–2 dues with fine paid · Pending: 3+ dues with 2+ fines paid · Risky: 3+ dues, fines not kept up
                </small>
              </div>

              <div className="reports-risk-filter" role="tablist" aria-label="Pending customer risk filter">
                <button
                  type="button"
                  className={pendingRiskFilter === 'normal' ? 'active normal' : 'normal'}
                  onClick={() => setPendingRiskFilter('normal')}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={pendingRiskFilter === 'fine-paid' ? 'active fine-paid' : 'fine-paid'}
                  onClick={() => setPendingRiskFilter('fine-paid')}
                >
                  Fine Paid
                </button>
                <button
                  type="button"
                  className={pendingRiskFilter === 'pending' ? 'active pending' : 'pending'}
                  onClick={() => setPendingRiskFilter('pending')}
                >
                  Pending
                </button>
                <button
                  type="button"
                  className={pendingRiskFilter === 'risky' ? 'active risky' : 'risky'}
                  onClick={() => setPendingRiskFilter('risky')}
                >
                  Risky
                </button>
              </div>
            </div>

            {filteredPendingCycleCustomers.length ? (
              <>
                <div className="reports-cycle-pending-table-wrap">
                  <table className="reports-cycle-pending-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Customer ID</th>
                        <th>Loan ID(s)</th>
                        <th>Pending Dues</th>
                        <th>Pending Amount</th>
                        <th>Oldest Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendingCycleCustomers.map((row) => (
                        <tr key={row.key}>
                          <td>
                            <strong>
                              {row.customerDbId
                                ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink>
                                : row.customerName}
                            </strong>
                          </td>
                          <td>{row.customerId}</td>
                          <td>{row.loanIds.length ? row.loanIds.join(', ') : '—'}</td>
                          <td><strong>{row.pendingDueCount}</strong></td>
                          <td className="reports-cycle-pending-money">{formatCurrency(row.pendingAmount)}</td>
                          <td>{formatDate(row.oldestDue)}</td>
                          <td>
                            <span className={`reports-risk-badge ${row.category}`}>
                              {row.categoryLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="reports-cycle-pending-mobile">
                  {filteredPendingCycleCustomers.map((row) => (
                    <article className="reports-cycle-pending-mobile-card" key={`mobile-${row.key}`}>
                      <div className="reports-cycle-pending-mobile-top">
                        <div>
                          <strong>
                            {row.customerDbId
                              ? <CustomerProfileLink customerId={row.customerDbId}>{row.customerName}</CustomerProfileLink>
                              : row.customerName}
                          </strong>
                          <small>{row.customerId} · {row.loanIds.length ? row.loanIds.join(', ') : '—'}</small>
                        </div>
                        <span className={`reports-risk-badge ${row.category}`}>{row.categoryLabel}</span>
                      </div>
                      <div className="reports-cycle-pending-mobile-grid">
                        <div><span>Pending Dues</span><strong>{row.pendingDueCount}</strong></div>
                        <div><span>Pending Amount</span><strong>{formatCurrency(row.pendingAmount)}</strong></div>
                        <div><span>Oldest Due</span><strong>{formatDate(row.oldestDue)}</strong></div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="reports-cycle-pending-empty">
                No {pendingRiskFilter === 'fine-paid' ? 'Fine Paid' : pendingRiskFilter === 'pending' ? 'Pending' : pendingRiskFilter === 'risky' ? 'Risky' : 'Normal'} pending customers found for this {cyclePerformanceReport.cycle.toLowerCase()} report.
              </div>
            )}
          </div>
        </section>
      )}

      {downloadDialog}
      {!downloadOpen && downloadError && <div className="form-error" role="alert">{downloadError}</div>}
    </div>
  );
}
