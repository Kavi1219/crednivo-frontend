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
  RotateCcw,
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

const CYCLES = ['All', 'Daily', 'Weekly', 'Monthly'];

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
  const monthRange = useMemo(() => getMonthMeta(monthDefault), [monthDefault]);
  const [view, setView] = useState('overview');
  const [fromDate, setFromDate] = useState(monthRange.start);
  const [toDate, setToDate] = useState(monthRange.end);
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

  const resetFilters = () => {
    const currentMonth = getMonthMeta(toInputDate().slice(0, 7));
    setFromDate(currentMonth.start);
    setToDate(currentMonth.end);
    setCycle('All');
  };

  const setQuickRange = (type) => {
    const range = getQuickRange(type);
    setFromDate(range.from);
    setToDate(range.to);
  };

  const downloadOverview = () => downloadCsv(
    `crednivo-reports-overview-${fromDate}-to-${toDate}.csv`,
    [
      ['CREDNIVO Reports Overview'],
      ['Company', company.name],
      ['Branch', user?.branch || company.branch || 'All'],
      ['From', fromDate],
      ['To', toDate],
      ['Cycle', cycle],
      [],
      ['Summary', 'Value'],
      ['Expected Collection', overview.expected],
      ['Customer Money Received', overview.collected],
      ...overviewCycleCollections.map((item) => [`${item.cycle} Collection / Cycle Total`, item.amount]),
      ['Scheduled Collection Collected', overview.scheduledCollected],
      ['Pending', overview.pending],
      ['Overdue', overview.overdue],
      ['Incoming Cash', overview.incoming],
      ['Outgoing Cash', overview.outgoing],
      ['Net Cash Flow', overview.netCash],
      ['Expenses', overview.expenseTotal],
      ['New Loans Given', overview.loanGiven],
      ['Total Outstanding (Current)', currentTotalOutstanding],
      ['In-Hand Amount (Current)', currentInHandAmount],
      ['Recovery %', `${overview.recovery.toFixed(1)}%`],
      [],
      ['Cycle', 'Expected', 'Collected', 'Pending', 'Customers', 'Loans', 'Recovery %'],
      ...cycleRows.map((item) => [item.cycle, item.expected, item.collected, item.pending, item.uniqueCustomers, item.loans, `${item.rate.toFixed(1)}%`]),
      [],
      ['Recovery Attention', 'Customer', 'Loan', 'Due Date', 'Balance'],
      ...overview.overdueRows.slice(0, 100).map((item) => [item.customerId, item.customerName, item.loanId, item.date, Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount))]),
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

  const exportCurrent = () => {
    if (view === 'statement') return downloadMonthly();
    if (view === 'collection') return downloadCollectionReport();
    return downloadOverview();
  };

  const rangeLabel = fromDate === toDate
    ? formatDate(fromDate)
    : `${formatDate(fromDate)} – ${formatDate(toDate)}`;

  return (
    <div className="module-page reports-page phase5-reports">
      <ModuleHeader
        eyebrow="Phase 5.1 · Reports"
        title="Reports & Analytics"
        description="Business-wide overview plus a launch-ready detailed collection report from your live CREDNIVO records."
        actions={(
          <>
            <ActionButton tone="secondary" icon={Printer} onClick={() => window.print()}>Print</ActionButton>
            <ActionButton tone="secondary" icon={Download} onClick={exportCurrent}>Export CSV</ActionButton>
          </>
        )}
      />

      <div className="reports-view-tabs" role="tablist" aria-label="Report view">
        <button type="button" className={view === 'overview' ? 'active' : ''} onClick={() => setView('overview')}><BarChart3 size={17} />Overview</button>
        <button type="button" className={view === 'collection' ? 'active' : ''} onClick={() => setView('collection')}><HandCoins size={17} />Collection Report</button>
        <button type="button" className={view === 'statement' ? 'active' : ''} onClick={() => setView('statement')}><ReceiptText size={17} />Monthly Statement</button>
      </div>

      {view === 'overview' ? (
        <>
          <section className="reports-filter-card app-card">
            <div className="reports-filter-head">
              <div>
                <strong>Report Filters</strong>
                <span>{rangeLabel} · {cycle === 'All' ? 'All cycles' : cycle}</span>
              </div>
              <div className="reports-quick-ranges">
                <button type="button" onClick={() => setQuickRange('today')}>Today</button>
                <button type="button" onClick={() => setQuickRange('week')}>This Week</button>
                <button type="button" onClick={() => setQuickRange('month')}>This Month</button>
              </div>
            </div>
            <div className="reports-filter-grid">
              <label><span>From Date</span><div><CalendarDays size={16} /><input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></div></label>
              <label><span>To Date</span><div><CalendarDays size={16} /><input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
              <label><span>Cycle</span><select value={cycle} onChange={(event) => setCycle(event.target.value)}>{CYCLES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Branch</span><input value={user?.branch || company.branch || 'Current company branch'} readOnly /></label>
              <label><span>Agent Scope</span><input value={isOwner ? 'All permitted company data' : `${user?.displayName || 'Agent'} · permitted data`} readOnly /></label>
              <button type="button" className="reports-reset" onClick={resetFilters}><RotateCcw size={16} />Reset</button>
            </div>
          </section>

          <section className="reports-kpi-grid">
            <MetricCard icon={Wallet} label="Expected Collection" value={formatCurrency(overview.expected)} sub={`${filteredCollections.length} collection entries`} tone="blue" />
            <MetricCard
              icon={HandCoins}
              label="Customer Money Received"
              value={formatCurrency(overview.collected)}
              sub={`${overview.collectionPaymentCount} payment transaction${overview.collectionPaymentCount === 1 ? '' : 's'}`}
              tone="green"
            />
            <MetricCard icon={TriangleAlert} label="Pending" value={formatCurrency(overview.pending)} sub={`${overview.overdueRows.length} overdue entries`} tone="orange" />
            <MetricCard icon={WalletCards} label="Total Outstanding" value={formatCurrency(currentTotalOutstanding)} sub="Outstanding across active loans" tone="purple" />
            <MetricCard icon={Wallet} label="In-Hand Amount" value={formatCurrency(currentInHandAmount)} sub="Current available business cash" tone="teal" />
            <MetricCard icon={CircleDollarSign} label="New Loans Given" value={formatCurrency(overview.loanGiven)} sub={`${filteredLoans.length} loans in period`} tone="purple" />
            <MetricCard icon={ReceiptText} label="Expenses" value={formatCurrency(overview.expenseTotal)} sub={`${filteredExpenses.length} expense entries`} tone="red" />
            <MetricCard icon={Landmark} label="Net Cash Flow" value={formatCurrency(overview.netCash)} sub={`${formatCurrency(overview.incoming)} in · ${formatCurrency(overview.outgoing)} out`} tone={overview.netCash < 0 ? 'red' : 'teal'} />
          </section>

          <section className="reports-cycle-collection-section app-card">
            <div className="reports-cycle-collection-head">
              <div>
                <strong>Collection by Cycle</strong>
                <span>Total Collection / Cycle amount across current active loans. Click a cycle to view only those customer details.</span>
              </div>
              <span className="reports-cycle-selected-badge">{selectedOverviewCycle} customers</span>
            </div>

            <div className="reports-cycle-collection-tabs" role="tablist" aria-label="Collection cycle customer details">
              {overviewCycleCollections.map((item) => {
                const active = selectedOverviewCycle === item.cycle;
                return (
                  <button
                    key={item.cycle}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`reports-cycle-collection-tab cycle-${item.cycle.toLowerCase()} ${active ? 'active' : ''}`}
                    onClick={() => setSelectedOverviewCycle(item.cycle)}
                  >
                    <span className="reports-cycle-tab-icon"><HandCoins size={20} /></span>
                    <span className="reports-cycle-tab-copy">
                      <small>{item.cycle} Collection</small>
                      <strong>{formatCurrency(item.amount)}</strong>
                      <em>{item.customerCount} customer${item.customerCount === 1 ? '' : 's'} · {item.loanCount} active loan${item.loanCount === 1 ? '' : 's'}</em>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="reports-cycle-customer-panel">
              <div className="reports-cycle-customer-panel-head">
                <div>
                  <strong>{selectedOverviewCycle} Collection Customers</strong>
                  <span>{overviewCycleCustomerRows.length} active loan/customer record${overviewCycleCustomerRows.length === 1 ? '' : 's'} · period figures: {rangeLabel}</span>
                </div>
                <strong>{formatCurrency(selectedOverviewCycleSummary?.amount || 0)}</strong>
              </div>

              {overviewCycleCustomerRows.length === 0 ? (
                <EmptyState>No active {selectedOverviewCycle.toLowerCase()} collection customers found.</EmptyState>
              ) : (
                <>
                  <div className="reports-cycle-customer-table-wrap">
                    <table className="reports-cycle-customer-table">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Loan</th>
                          <th>Collection / Cycle</th>
                          <th>Expected</th>
                          <th>Received</th>
                          <th>Pending</th>
                          <th>Outstanding</th>
                          <th>Status</th>
                          <th>View</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewCycleCustomerRows.map((item) => (
                          <tr key={item.key}>
                            <td>
                              <div className="reports-cycle-customer-identity">
                                <CustomerAvatar className="reports-cycle-customer-avatar" photo={customerPhotoById[String(item.customerId)]} name={item.customerName} />
                                <div>
                                  <strong><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong>
                                  <span>{item.customerId || '—'}</span>
                                </div>
                              </div>
                            </td>
                            <td><strong>{item.loanId || '—'}</strong></td>
                            <td>{formatCurrency(item.collectionPerCycle)}</td>
                            <td>{formatCurrency(item.expected)}</td>
                            <td className="collection-money-positive">{formatCurrency(item.received)}</td>
                            <td className={item.pending > 0 ? 'collection-money-pending' : ''}>{formatCurrency(item.pending)}</td>
                            <td>{formatCurrency(item.outstanding)}</td>
                            <td><span className={`collection-status-pill status-${String(item.status).toLowerCase()}`}>{item.status}</span></td>
                            <td>
                              <button type="button" className="reports-cycle-customer-view" onClick={() => navigate(`/customers/${item.customerId}`)} aria-label={`View ${item.customerName}`}>
                                <Eye size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="reports-cycle-customer-mobile">
                    {overviewCycleCustomerRows.map((item) => (
                      <article key={item.key} className="reports-cycle-customer-mobile-card">
                        <div className="reports-cycle-customer-mobile-top">
                          <div className="reports-cycle-customer-identity">
                            <CustomerAvatar className="reports-cycle-customer-avatar" photo={customerPhotoById[String(item.customerId)]} name={item.customerName} />
                            <div>
                              <strong><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong>
                              <span>{item.customerId || '—'} · {item.loanId || '—'}</span>
                            </div>
                          </div>
                          <span className={`collection-status-pill status-${String(item.status).toLowerCase()}`}>{item.status}</span>
                        </div>
                        <div className="reports-cycle-customer-mobile-money">
                          <div><span>Collection / Cycle</span><strong>{formatCurrency(item.collectionPerCycle)}</strong></div>
                          <div><span>Expected</span><strong>{formatCurrency(item.expected)}</strong></div>
                          <div><span>Received</span><strong className="collection-money-positive">{formatCurrency(item.received)}</strong></div>
                          <div><span>Pending</span><strong className={item.pending > 0 ? 'collection-money-pending' : ''}>{formatCurrency(item.pending)}</strong></div>
                          <div><span>Outstanding</span><strong>{formatCurrency(item.outstanding)}</strong></div>
                        </div>
                        <button type="button" className="reports-cycle-customer-mobile-view" onClick={() => navigate(`/customers/${item.customerId}`)}>
                          <Eye size={15} /> View Customer
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="reports-overview-grid">
            <article className="reports-panel app-card reports-cycle-panel">
              <div className="reports-panel-head"><div><strong>Cycle Performance</strong><span>Expected vs collected for the selected period</span></div><Activity size={19} /></div>
              <div className="reports-cycle-list">
                {cycleRows.map((item) => (
                  <div className="reports-cycle-row" key={item.cycle}>
                    <div className="reports-cycle-name"><strong>{item.cycle}</strong><span>{item.uniqueCustomers} customers · {item.loans} loans</span></div>
                    <div className="reports-cycle-money"><span>Expected</span><strong>{formatCurrency(item.expected)}</strong></div>
                    <div className="reports-cycle-money positive"><span>Collected</span><strong>{formatCurrency(item.collected)}</strong></div>
                    <div className="reports-cycle-money"><span>Pending</span><strong>{formatCurrency(item.pending)}</strong></div>
                    <div className="reports-cycle-progress"><div><span>Recovery</span><strong>{item.rate.toFixed(1)}%</strong></div><i><b style={{ width: `${item.rate}%` }} /></i></div>
                  </div>
                ))}
              </div>
            </article>

            <article className="reports-panel app-card reports-cash-panel">
              <div className="reports-panel-head"><div><strong>Cash Flow</strong><span>Recorded money movement in the selected period</span></div><Landmark size={19} /></div>
              <div className="reports-cash-summary">
                <div><span className="cash-icon green"><WalletCards size={18} /></span><div><small>Incoming</small><strong>{formatCurrency(overview.incoming)}</strong></div></div>
                <div><span className="cash-icon orange"><CircleDollarSign size={18} /></span><div><small>Outgoing</small><strong>{formatCurrency(overview.outgoing)}</strong></div></div>
                <div className={overview.netCash < 0 ? 'negative' : 'positive'}><span className="cash-icon blue"><Landmark size={18} /></span><div><small>Net Cash</small><strong>{formatCurrency(overview.netCash)}</strong></div></div>
              </div>
              <div className="reports-cash-lines">
                <div><span>New loan disbursement</span><strong>{formatCurrency(overview.loanGiven)}</strong></div>
                <div><span>Recorded expenses</span><strong>{formatCurrency(overview.expenseTotal)}</strong></div>
                <div><span>Payment transactions</span><strong>{filteredPayments.length}</strong></div>
              </div>
            </article>
          </section>

          <section className="reports-overview-grid reports-lower-grid">
            <article className="reports-panel app-card reports-trend-panel">
              <div className="reports-panel-head"><div><strong>Collection Trend</strong><span>Last 14 collection dates inside this report period</span></div><BarChart3 size={19} /></div>
              {trendRows.length === 0 ? <EmptyState>No collection activity in this period.</EmptyState> : (
                <div className="reports-mini-chart">
                  {trendRows.map((item) => {
                    const height = Math.max(5, (item.amount / trendMax) * 100);
                    return <div key={item.date} title={`${formatDate(item.date)} · ${formatCurrency(item.amount)}`}><span><i style={{ height: `${height}%` }} /></span><small>{String(item.date).slice(8, 10)}</small></div>;
                  })}
                </div>
              )}
            </article>

            <article className="reports-panel app-card reports-recovery-panel">
              <div className="reports-panel-head"><div><strong>Recovery Attention</strong><span>Oldest overdue collection entries</span></div><TriangleAlert size={19} /></div>
              {overview.overdueRows.length === 0 ? (
                <div className="reports-success-state"><CheckCircle2 size={24} /><strong>No overdue collections</strong><span>The selected period has no overdue balances requiring attention.</span></div>
              ) : (
                <div className="reports-recovery-list">
                  {overview.overdueRows.slice(0, 5).map((item) => (
                    <div key={item.id}>
                      <CustomerAvatar className="recovery-avatar" photo={customerPhotoById[String(item.customerId)]} name={item.customerName || 'Customer'} />
                      <div><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong><small>{item.customerId} · {item.loanId}</small></div>
                      <div><span>{formatDate(item.date)}</span><strong>{formatCurrency(Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount)))}</strong></div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>

          <section className="reports-overview-grid reports-lower-grid">
            <article className="reports-panel app-card reports-activity-panel">
              <div className="reports-panel-head"><div><strong>Portfolio Activity</strong><span>Company position and period movement</span></div><UsersRound size={19} /></div>
              <div className="reports-activity-grid">
                <div><UsersRound size={17} /><span>Total Customers</span><strong>{customers.length}</strong></div>
                <div><UserPlus size={17} /><span>Customers in Period</span><strong>{periodCustomers}</strong></div>
                <div><WalletCards size={17} /><span>Active Loans</span><strong>{activeLoans}</strong></div>
                <div><CheckCircle2 size={17} /><span>Closed Loans</span><strong>{closedLoans}</strong></div>
              </div>
            </article>

            {isOwner ? (
              <article className="reports-panel app-card reports-agent-panel">
                <div className="reports-panel-head"><div><strong>Agent Snapshot</strong><span>Current assigned and collected totals</span></div><UsersRound size={19} /></div>
                {agents.length === 0 ? <EmptyState>No agent data available.</EmptyState> : (
                  <div className="reports-agent-list">
                    {agents.slice(0, 5).map((agent) => (
                      <div key={agent.id}>
                        <span className="reports-agent-avatar">{agent.photo ? <img src={agent.photo} alt="" /> : String(agent.name || 'A').charAt(0)}</span>
                        <div><strong>{agent.name}</strong><small>{agent.id} · {agent.branch}</small></div>
                        <div><span>{agent.assigned || 0} assigned</span><strong>{formatCurrency(agent.collected || 0)}</strong></div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ) : (
              <article className="reports-panel app-card reports-agent-panel">
                <div className="reports-panel-head"><div><strong>Your Report Scope</strong><span>Agent report access follows assigned permissions</span></div><UsersRound size={19} /></div>
                <div className="reports-agent-scope"><span className="reports-agent-avatar">{user?.profilePhoto ? <img src={user.profilePhoto} alt="" /> : String(user?.displayName || 'A').charAt(0)}</span><div><strong>{user?.displayName || 'Agent'}</strong><span>{user?.employeeId || 'Agent account'} · {user?.branch || company.branch}</span><small>Only data returned by your authorized CREDNIVO account is included in this report.</small></div></div>
              </article>
            )}
          </section>

        </>
      ) : view === 'collection' ? (
        <section className="collection-report-wrap">
          <section className="collection-report-filter app-card">
            <div className="collection-report-filter-head">
              <div><strong>Detailed Collection Report</strong><span>{rangeLabel} · {cycle === 'All' ? 'All cycles' : cycle} · {collectionStatus === 'All' ? 'All statuses' : collectionStatus}</span></div>
              <div className="reports-quick-ranges">
                <button type="button" onClick={() => setQuickRange('today')}>Today</button>
                <button type="button" onClick={() => setQuickRange('week')}>This Week</button>
                <button type="button" onClick={() => setQuickRange('month')}>This Month</button>
              </div>
            </div>

            <div className="collection-report-filter-grid">
              <label className="collection-report-search"><span>Customer / Loan</span><div><Search size={16} /><input value={collectionSearch} onChange={(event) => setCollectionSearch(event.target.value)} placeholder="Search name, customer ID or loan ID..." /></div></label>
              <label><span>From Date</span><div><CalendarDays size={16} /><input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></div></label>
              <label><span>To Date</span><div><CalendarDays size={16} /><input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} /></div></label>
              <label><span>Cycle</span><select value={cycle} onChange={(event) => setCycle(event.target.value)}>{CYCLES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Status</span><select value={collectionStatus} onChange={(event) => setCollectionStatus(event.target.value)}>{['All', 'Paid', 'Pending', 'Overdue', 'Due Today', 'Upcoming'].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Branch</span><input value={user?.branch || company.branch || 'Current company branch'} readOnly /></label>
              <label><span>Report Scope</span><input value={isOwner ? 'All company records' : `${user?.displayName || 'Agent'} · authorized records`} readOnly /></label>
              <button type="button" className="reports-reset" onClick={() => { resetFilters(); setCollectionSearch(''); setCollectionStatus('All'); }}><RotateCcw size={16} />Reset</button>
            </div>
          </section>

          {collectionApiLoading && <div className="report-data-status app-card">Loading detailed collection report…</div>}
          {collectionApiError && <div className="report-data-status report-data-warning app-card">{collectionApiError} Showing the currently synced workspace data instead.</div>}

          <section className="collection-report-kpis">
            <MetricCard icon={Wallet} label="Expected" value={formatCurrency(collectionReportSummary.expected)} sub={`${collectionReportRows.length} schedule entries`} tone="blue" />
            <MetricCard icon={HandCoins} label="Collected" value={formatCurrency(collectionReportSummary.collected)} sub={`${collectionReportPaymentRows.length} payment transactions`} tone="green" />
            <MetricCard icon={TriangleAlert} label="Pending" value={formatCurrency(collectionReportSummary.pending)} sub={`${collectionReportSummary.overdueEntries} overdue entries`} tone="orange" />
            <MetricCard icon={CircleDollarSign} label="Fine Collected" value={formatCurrency(collectionReportSummary.fine)} sub={`${collectionReportSummary.paidEntries} collection payments`} tone="purple" />
          </section>

          <section className="collection-report-card app-card collection-transactions-card">
            <div className="collection-report-card-head">
              <div><strong>Collection Transactions</strong><span>Actual collection money received inside the selected payment-date range.</span></div>
              <strong>{collectionReportPaymentRows.length} payments</strong>
            </div>

            {collectionReportPaymentRows.length === 0 ? (
              <EmptyState>No collection payments were received in the selected period.</EmptyState>
            ) : (
              <>
                <div className="collection-report-table-wrap desktop-data-table">
                  <table className="collection-report-table collection-payment-table">
                    <thead><tr><th>Payment Date</th><th>Customer</th><th>Loan</th><th>Cycle</th><th>Collection</th><th>Fine</th><th>Total Received</th><th>Mode</th><th>Note</th><th></th></tr></thead>
                    <tbody>
                      {collectionReportPaymentRows.map((item) => (
                        <tr key={item.paymentId || `${item.loanId}-${item.paymentDate}-${item.totalReceived}`}>
                          <td>{formatDate(item.paymentDate)}</td>
                          <td><div className="collection-report-customer"><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName || 'Customer'}</CustomerProfileLink></strong><span>{item.customerId}</span></div></td>
                          <td>{item.loanId || '—'}</td>
                          <td><span className={`collection-cycle-pill cycle-${String(item.cycle || '').toLowerCase()}`}>{item.cycle || '—'}</span></td>
                          <td className="collection-money-positive">{formatCurrency(item.collectionAmount)}</td>
                          <td>{formatCurrency(item.fineAmount)}</td>
                          <td><strong>{formatCurrency(item.totalReceived)}</strong></td>
                          <td>{item.paymentMode || 'Cash'}</td>
                          <td className="collection-payment-note">{item.note || '—'}</td>
                          <td>{hasPermission('customers.view') && item.customerId && item.customerId !== '—' ? <button type="button" className="collection-report-view" onClick={() => navigate(`/customers/${item.customerId}`)} title="View customer"><Eye size={16} /></button> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-data-list collection-report-mobile">
                  {collectionReportPaymentRows.map((item) => (
                    <article className="mobile-data-card collection-report-mobile-card" key={`payment-mobile-${item.paymentId || `${item.loanId}-${item.paymentDate}`}`}>
                      <div className="mobile-data-top"><div><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName || 'Customer'}</CustomerProfileLink></strong><small>{item.customerId} · {item.loanId || '—'}</small></div><span className="collection-status-pill status-paid">Received</span></div>
                      <div className="collection-report-mobile-amounts"><div><span>Collection</span><strong className="collection-money-positive">{formatCurrency(item.collectionAmount)}</strong></div><div><span>Fine</span><strong>{formatCurrency(item.fineAmount)}</strong></div><div><span>Total</span><strong>{formatCurrency(item.totalReceived)}</strong></div></div>
                      <div className="collection-report-mobile-meta"><span>{formatDate(item.paymentDate)} · {item.cycle || '—'}</span><span>{item.paymentMode || 'Cash'}</span><span>{item.note || 'Collection payment'}</span></div>
                      {hasPermission('customers.view') && item.customerId && item.customerId !== '—' && <button type="button" className="collection-report-mobile-view" onClick={() => navigate(`/customers/${item.customerId}`)}><Eye size={15} />View Customer</button>}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="collection-report-card app-card">
            <div className="collection-report-card-head">
              <div><strong>Scheduled Collections</strong><span>Expected, allocated and outstanding amounts grouped by scheduled due date.</span></div>
              <strong>{collectionReportRows.length} rows</strong>
            </div>

            {collectionReportRows.length === 0 ? (
              <EmptyState>No scheduled collection entries match the selected filters.</EmptyState>
            ) : (
              <>
                <div className="collection-report-table-wrap desktop-data-table">
                  <table className="collection-report-table">
                    <thead><tr><th>Due Date</th><th>Customer</th><th>Loan</th><th>Cycle</th><th>Expected</th><th>Collected</th><th>Fine</th><th>Balance</th><th>Status</th><th>Latest Payment</th><th></th></tr></thead>
                    <tbody>
                      {collectionReportRows.map((item) => (
                        <tr key={item.id}>
                          <td>{formatDate(item.date)}</td>
                          <td><div className="collection-report-customer"><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName || 'Customer'}</CustomerProfileLink></strong><span>{item.customerId}</span></div></td>
                          <td>{item.loanId}</td>
                          <td><span className={`collection-cycle-pill cycle-${String(item.cycle || '').toLowerCase()}`}>{item.cycle}</span></td>
                          <td>{formatCurrency(item.dueAmount)}</td>
                          <td className="collection-money-positive">{formatCurrency(item.paidAmount)}</td>
                          <td>{formatCurrency(item.fine)}</td>
                          <td className={item.balance > 0 ? 'collection-money-pending' : ''}>{formatCurrency(item.balance)}</td>
                          <td><span className={`collection-status-pill status-${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span></td>
                          <td><div className="collection-report-payment"><strong>{item.latestPaymentDate ? formatDate(item.latestPaymentDate) : '—'}</strong><span>{item.paymentMode || 'No payment'}</span></div></td>
                          <td>{hasPermission('customers.view') ? <button type="button" className="collection-report-view" onClick={() => navigate(`/customers/${item.customerId}`)} title="View customer"><Eye size={16} /></button> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mobile-data-list collection-report-mobile">
                  {collectionReportRows.map((item) => (
                    <article className="mobile-data-card collection-report-mobile-card" key={`mobile-${item.id}`}>
                      <div className="mobile-data-top"><div><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName || 'Customer'}</CustomerProfileLink></strong><small>{item.customerId} · {item.loanId}</small></div><span className={`collection-status-pill status-${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</span></div>
                      <div className="collection-report-mobile-amounts"><div><span>Expected</span><strong>{formatCurrency(item.dueAmount)}</strong></div><div><span>Collected</span><strong className="collection-money-positive">{formatCurrency(item.paidAmount)}</strong></div><div><span>Balance</span><strong className={item.balance > 0 ? 'collection-money-pending' : ''}>{formatCurrency(item.balance)}</strong></div></div>
                      <div className="collection-report-mobile-meta"><span>{formatDate(item.date)} · {item.cycle}</span><span>Fine {formatCurrency(item.fine)}</span><span>{item.latestPaymentDate ? `Last payment ${formatDate(item.latestPaymentDate)} · ${item.paymentMode || 'Mode not recorded'}` : 'No payment recorded'}</span></div>
                      {hasPermission('customers.view') && <button type="button" className="collection-report-mobile-view" onClick={() => navigate(`/customers/${item.customerId}`)}><Eye size={15} />View Customer</button>}
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </section>
      ) : (
        <section className="monthly-statement-wrap">
          <div className="statement-toolbar app-card">
            <div><strong>Monthly Business Statement</strong><span>Database-generated month-end view</span></div>
            <label><CalendarDays size={17} /><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
          </div>
          {monthlyLoading && <div className="report-data-status app-card">Loading monthly report…</div>}
          {monthlyError && <div className="report-data-status report-data-error app-card">{monthlyError}</div>}

          <article className={`monthly-statement app-card ${monthlyLoading ? 'is-loading' : ''}`}>
            <header className="monthly-statement-head">
              <div><span className="statement-brand"><BarChart3 size={21} /></span><div><strong>CREDNIVO</strong><small>{company.name} · {user?.branch || company.branch}</small></div></div>
              <div><span>MONTHLY BUSINESS STATEMENT</span><strong>{monthlyReport.month.label}</strong></div>
            </header>

            <div className="statement-kpis">
              <div><span>Expected</span><strong>{formatCurrency(monthlyReport.overallExpected)}</strong></div>
              <div><span>Collected</span><strong>{formatCurrency(monthlyReport.overallCollected)}</strong></div>
              <div><span>Pending</span><strong>{formatCurrency(monthlyReport.overallPending)}</strong></div>
              <div><span>Overdue</span><strong>{formatCurrency(monthlyReport.overdueAmount)}</strong></div>
              <div><span>Net Cash Flow</span><strong>{formatCurrency(monthlyReport.netCash)}</strong></div>
            </div>

            <div className="statement-section">
              <div className="statement-section-title"><strong>Cycle Performance</strong><span>Expected, collection and recovery by cycle</span></div>
              <div className="statement-table-wrap"><table><thead><tr><th>Cycle</th><th>Expected</th><th>Collected</th><th>Pending</th><th>Customers</th><th>Loans</th><th>Recovery</th></tr></thead><tbody>{monthlyReport.cycles.map((item) => <tr key={item.cycle}><td><b>{item.cycle}</b></td><td>{formatCurrency(item.expected)}</td><td className="positive-cell">{formatCurrency(item.collected)}</td><td>{formatCurrency(item.pending)}</td><td>{item.customers}</td><td>{item.loans}</td><td><strong>{item.rate.toFixed(1)}%</strong></td></tr>)}</tbody></table></div>
            </div>

            <div className="statement-two-column">
              <div className="statement-section">
                <div className="statement-section-title"><strong>Finance Summary</strong><span>Cash movement and business position</span></div>
                <div className="statement-lines">
                  <div><span>New Loans Given</span><strong>{formatCurrency(monthlyReport.newLoansGiven)}</strong></div>
                  <div><span>Expenses</span><strong>{formatCurrency(monthlyReport.expenseTotal)}</strong></div>
                  <div><span>Net Cash Flow</span><strong>{formatCurrency(monthlyReport.netCash)}</strong></div>
                  <div><span>In-Hand Amount (Month End)</span><strong>{formatCurrency(monthlyReport.availableCapitalAtMonthEnd)}</strong></div>
                  <div><span>Total Outstanding (Current)</span><strong>{formatCurrency(currentTotalOutstanding)}</strong></div>
                </div>
              </div>
              <div className="statement-section">
                <div className="statement-section-title"><strong>Monthly Activity</strong><span>Portfolio movement and recovery</span></div>
                <div className="statement-lines"><div><span>New Customers</span><strong>{monthlyReport.newCustomers}</strong></div><div><span>New Loans</span><strong>{monthlyReport.newLoans}</strong></div><div><span>Closed Loans</span><strong>{monthlyReport.closedLoans}</strong></div><div><span>Overdue Customers</span><strong>{monthlyReport.overdueCustomers}</strong></div></div>
              </div>
            </div>

            <footer className="monthly-statement-footer"><span>Generated from CREDNIVO database records.</span><strong>{monthlyReport.month.label}</strong></footer>
          </article>
        </section>
      )}
    </div>
  );
}
