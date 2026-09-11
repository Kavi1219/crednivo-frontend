import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
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
        subtitle: 'Customer-wise loan disbursement details. This document is generated from report data, not from the website layout.',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [{
          title: 'Loan Disbursement Details',
          note: overviewHasDateFilter ? 'Only loans inside the selected date range are included.' : 'All available loan disbursements are included.',
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
        }],
      };
    }

    if (activityPage === 'expenses') {
      return {
        fileBase: `crednivo-expenses-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Expense Report',
        subtitle: 'Expense ledger for the selected reporting period.',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [{
          title: 'Expense Entries',
          columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'category', label: 'Category' },
            { key: 'description', label: 'Description' },
            { key: 'createdBy', label: 'Created By' },
            { key: 'amount', label: 'Amount', type: 'currency' },
          ],
          rows: expenseDetailRows,
        }],
      };
    }

    if (activityPage === 'fine') {
      return {
        fileBase: `crednivo-fine-income-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Fine Income Report',
        subtitle: 'Customer and loan-wise fine amounts received.',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [{
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
        }],
      };
    }

    if (activityPage === 'documents') {
      return {
        fileBase: `crednivo-document-charges-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Document Charges Income Report',
        subtitle: 'Customer and loan-wise document charge income.',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [{
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
        }],
      };
    }

    if (activityPage === 'savings') {
      return {
        fileBase: `crednivo-savings-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Business Activity',
        title: 'Savings Report',
        subtitle: 'Savings movements recorded by the business.',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [{
          title: 'Savings Entries',
          columns: [
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'description', label: 'Description' },
            { key: 'createdBy', label: 'Created By' },
            { key: 'amount', label: 'Amount', type: 'currency' },
          ],
          rows: savingsDetailRows,
        }],
      };
    }

    if (capacityPage) {
      return {
        fileBase: `crednivo-${capacityPage}-collection-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: 'Collection Capacity',
        title: `${capacityCycle} Collection Report`,
        subtitle: 'Customer-wise collection position for the selected cycle.',
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

    const periodCycle = view === 'daily'
      ? 'Daily'
      : view === 'weekly'
        ? 'Weekly'
        : view === 'monthly'
          ? 'Monthly'
          : null;

    if (periodCycle) {
      const statusRow = overviewCycleStatusRows.find((item) => item.cycle === periodCycle) || {};
      return {
        fileBase: `crednivo-${periodCycle.toLowerCase()}-report-${fromDate || 'all'}-${toDate || 'all'}`,
        badge: `${periodCycle} Report`,
        title: `${periodCycle} Collection Report`,
        subtitle: 'Cycle-specific business collection summary.',
        company: company?.name || 'CREDNIVO',
        generated: formatDate(toInputDate()),
        meta: reportMeta,
        sections: [{
          title: `${periodCycle} Summary`,
          metrics: [
            { label: 'Active Loan Amount', value: statusRow.loanAmount || 0, type: 'currency' },
            { label: 'Collected Amount', value: statusRow.collectedAmount || 0, type: 'currency' },
            { label: 'Upcoming Amount', value: statusRow.upcomingAmount || 0, type: 'currency' },
            { label: 'Pending Amount', value: statusRow.pendingAmount || 0, type: 'currency' },
          ],
        }],
      };
    }

    return {
      fileBase: `crednivo-overview-${fromDate || 'overall'}-${toDate || 'overall'}`,
      badge: 'Overview Report',
      title: 'Business Overview Report',
      subtitle: 'Professional business summary prepared from live CREDNIVO records. The exported document uses a dedicated report layout rather than the website card design.',
      company: company?.name || 'CREDNIVO',
      generated: formatDate(toInputDate()),
      meta: reportMeta,
      sections: [
        {
          title: 'Business Summary',
          metrics: [
            { label: 'In-Hand Amount', value: currentInHandAmount, type: 'currency' },
            { label: 'Collection Amount', value: overviewCollectionAmount, type: 'currency' },
            { label: 'Collected Amount', value: overview.collected, type: 'currency' },
            { label: 'Pending Amount', value: overviewPendingAmount, type: 'currency' },
            { label: 'Total Outstanding', value: currentTotalOutstanding, type: 'currency' },
            { label: 'Active Loans', value: overviewActiveLoanCount, type: 'number' },
            { label: 'Total Customers', value: overviewCustomerCount, type: 'number' },
            { label: 'Overdue Amount', value: overview.overdue, type: 'currency' },
          ],
        },
        {
          title: 'Business Activity',
          metrics: [
            { label: 'New Loans Given', value: overview.loanGiven, type: 'currency' },
            { label: 'Expenses', value: overview.expenseTotal, type: 'currency' },
            { label: 'Fine Income', value: overviewFineIncome, type: 'currency' },
            { label: 'Document Charges Income', value: overviewDocumentChargeIncome, type: 'currency' },
            ...(isOwner ? [{ label: 'Savings', value: overviewSavingsAmount, type: 'currency' }] : []),
          ],
        },
        {
          title: 'Current Collection Capacity',
          note: 'Active loans only.',
          columns: [
            { key: 'cycle', label: 'Cycle' },
            { key: 'amount', label: 'Collection / Cycle', type: 'currency' },
            { key: 'customerCount', label: 'Customers', type: 'number' },
            { key: 'loanCount', label: 'Active Loans', type: 'number' },
          ],
          rows: overviewCycleCollections,
        },
        {
          title: 'Collection Status by Cycle',
          columns: [
            { key: 'cycle', label: 'Cycle' },
            { key: 'loanAmount', label: 'Active Loan Amount', type: 'currency' },
            { key: 'collectedAmount', label: 'Collected Amount', type: 'currency' },
            { key: 'upcomingAmount', label: 'Upcoming Amount', type: 'currency' },
            { key: 'pendingAmount', label: 'Pending Amount', type: 'currency' },
          ],
          rows: overviewCycleStatusRows,
        },
      ],
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
            <>
              <ActionButton tone="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
                Back
              </ActionButton>
              <ActionButton tone="secondary" icon={Download} onClick={openDownloadDialog}>
                Download
              </ActionButton>
            </>
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
              <div className="reports-dedicated-summary">
                <strong>
                  {activityPage === 'loans' && formatCurrency(overview.loanGiven)}
                  {activityPage === 'expenses' && formatCurrency(overview.expenseTotal)}
                  {activityPage === 'fine' && formatCurrency(overviewFineIncome)}
                  {activityPage === 'documents' && formatCurrency(overviewDocumentChargeIncome)}
                  {activityPage === 'savings' && formatCurrency(overviewSavingsAmount)}
                </strong>
                <small>Total amount</small>
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
      </div>
    );
  }

  return (
    <div className="module-page reports-page phase5-reports">
      <ModuleHeader
        eyebrow="Phase 5.1 · Reports"
        title="Reports & Analytics"
        description="Business-wide overview plus a launch-ready detailed collection report from your live CREDNIVO records."
        actions={(
          <>
            <ActionButton tone="secondary" icon={Printer} onClick={() => window.print()}>Print</ActionButton>
            <ActionButton tone="secondary" icon={Download} onClick={openDownloadDialog}>Download</ActionButton>
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
              <span>BUSINESS ACTIVITY</span>
              <strong>{overviewHasDateFilter ? 'Selected Period Activity' : 'Overall Activity'}</strong>
            </div>
            <small>{overviewRangeLabel}</small>
          </div>

          <div className={`reports-overall-activity-grid ${isOwner ? 'with-savings' : ''}`} aria-label="Business activity summary">
            <button
              type="button"
              className="reports-overall-activity-card reports-overall-activity-button"
              onClick={() => openActivityPage('loans')}
            >
              <span className="reports-overall-activity-icon"><UserPlus size={19} /></span>
              <div>
                <small>New Loans Given</small>
                <strong>{formatCurrency(overview.loanGiven)}</strong>
                <span>{overviewHasDateFilter ? 'Loans given in selected date range' : 'All loan disbursements'}</span>
              </div>
            </button>

            <button
              type="button"
              className="reports-overall-activity-card reports-overall-activity-button"
              onClick={() => openActivityPage('expenses')}
            >
              <span className="reports-overall-activity-icon"><ReceiptText size={19} /></span>
              <div>
                <small>Expenses</small>
                <strong>{formatCurrency(overview.expenseTotal)}</strong>
                <span>{overviewHasDateFilter ? 'Expenses in selected date range' : 'All recorded business expenses'}</span>
              </div>
            </button>

            <button
              type="button"
              className="reports-overall-activity-card reports-overall-activity-button"
              onClick={() => openActivityPage('fine')}
            >
              <span className="reports-overall-activity-icon"><CircleDollarSign size={19} /></span>
              <div>
                <small>Fine Income</small>
                <strong>{formatCurrency(overviewFineIncome)}</strong>
                <span>{overviewHasDateFilter ? 'Fine received in selected date range' : 'All fine amount received'}</span>
              </div>
            </button>

            <button
              type="button"
              className="reports-overall-activity-card reports-overall-activity-button"
              onClick={() => openActivityPage('documents')}
            >
              <span className="reports-overall-activity-icon"><ReceiptText size={19} /></span>
              <div>
                <small>Document Charges Income</small>
                <strong>{formatCurrency(overviewDocumentChargeIncome)}</strong>
                <span>{overviewHasDateFilter ? 'Charges in selected date range' : 'All document charge income'}</span>
              </div>
            </button>

            {isOwner && (
              <button
                type="button"
                className="reports-overall-activity-card reports-overall-activity-button reports-overall-activity-savings"
                onClick={() => openActivityPage('savings')}
              >
                <span className="reports-overall-activity-icon"><PiggyBank size={19} /></span>
                <div>
                  <small>Savings</small>
                  <strong>{formatCurrency(overviewSavingsAmount)}</strong>
                  <span>{overviewHasDateFilter ? 'Savings in selected date range' : 'All cash moved into Savings'}</span>
                </div>
              </button>
            )}
          </div>

          <div className="reports-overall-section-heading">
            <div>
              <span>COLLECTION BY CYCLE</span>
              <strong>Current Collection Capacity</strong>
            </div>
            <small>Tap a cycle to view customer details · {overviewRangeLabel}</small>
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
                    <small>{item.loanCount} active loan{item.loanCount === 1 ? '' : 's'} · per {cycleUnit}</small>
                  </div>
                </button>
              );
            })}
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
                  <th>Loan Amount</th>
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
                    <td><strong>{formatCurrency(row.loanAmount)}</strong></td>
                    <td className="reports-cycle-status-collected">{formatCurrency(row.collectedAmount)}</td>
                    <td className="reports-cycle-status-upcoming">{formatCurrency(row.upcomingAmount)}</td>
                    <td className="reports-cycle-status-pending">{formatCurrency(row.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {downloadDialog}
    </div>
  );
}
