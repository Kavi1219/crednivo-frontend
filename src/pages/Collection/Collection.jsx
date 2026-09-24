import { CalendarDays, Check, ChevronDown, Filter, HandCoins, IndianRupee, RotateCcw, Search, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import { keyOf, loanIdentityKeys, isPrecloseMarker } from '../../utils/loanIdentity';
import {
  calculateCycleTargets,
  getWeekRange,
  calculateWeekTarget,
  calculatePendingDueCounts,
  getRiskTier,
} from '../../utils/collectionTargets';
import './Collection.css';
import CustomerAvatar from '../../components/common/CustomerAvatar';

function balanceOf(item) {
  return Math.max(0, Number(item?.dueAmount || 0) - Number(item?.paidAmount || 0));
}

function getDisplayStatus(item, today = toInputDate()) {
  const due = Number(item.dueAmount || 0);
  const paid = Number(item.paidAmount || 0);
  const balance = Math.max(0, due - paid);

  if (item.status === 'Paid' || paid >= due) return 'Paid';

  // Date decides whether a remaining balance is future, current or overdue.
  if (item.date < today && balance > 0) return 'Overdue';

  // A partly-paid future installment is not pending/overdue yet.
  if (paid > 0 && balance > 0 && item.date > today) return 'Partial';

  // A partly-paid installment due today is pending for today's collection.
  if (paid > 0 && balance > 0 && item.date === today) return 'Pending';

  return 'Unpaid';
}

function sortByDateThenCustomer(a, b) {
  const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
  if (dateCompare !== 0) return dateCompare;
  return String(a.customerName || '').localeCompare(String(b.customerName || ''));
}

function collectionLoanIdentityKeys(item) {
  return [
    item?.loanId,
    item?.loanCode,
    item?.loanDbId,
    item?.dbLoanId,
    item?.loan?.id,
    item?.loan?.loanId,
    item?.loan?.loanCode,
  ].map(keyOf).filter(Boolean);
}

function collectionMatchesLoanKeySet(item, keySet) {
  return collectionLoanIdentityKeys(item).some((key) => keySet.has(key));
}

function dateKeyParts(value) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function utcDateKey(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

// Mirrors the backend contract schedule rule:
// Daily   -> start date + duration days
// Weekly  -> start date + duration weeks
// Monthly -> start date + duration months (LocalDate-style month clamping)
//
// Because duration is the number of actual scheduled collections, this gives
// the contractual LAST due date without needing cancelled schedule rows.
function plannedFinalDueDate(loan) {
  const parts = dateKeyParts(loan?.startDate);
  const duration = Math.max(0, Math.trunc(Number(loan?.duration || 0)));
  const cycle = String(loan?.cycle || '').trim().toLowerCase();

  if (!parts || duration <= 0) return '';

  if (cycle === 'daily') {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    date.setUTCDate(date.getUTCDate() + duration);
    return utcDateKey(date);
  }

  if (cycle === 'weekly') {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    date.setUTCDate(date.getUTCDate() + (duration * 7));
    return utcDateKey(date);
  }

  if (cycle === 'monthly') {
    const absoluteMonth = (parts.year * 12) + (parts.month - 1) + duration;
    const targetYear = Math.floor(absoluteMonth / 12);
    const targetMonthIndex = absoluteMonth % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
    const targetDay = Math.min(parts.day, lastDay);
    return utcDateKey(new Date(Date.UTC(targetYear, targetMonthIndex, targetDay)));
  }

  return '';
}

function isEarlyClosedLoan(loan) {
  if (!loan) return false;

  const status = String(loan?.status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  // Backward compatibility with older Crednivo builds that explicitly stored
  // PRE-CLOSE/PRECLOSED.
  if (
    isPrecloseMarker(loan?.status)
    || isPrecloseMarker(loan?.rawStatus)
    || isPrecloseMarker(loan?.closeType)
    || Boolean(loan?.preclosedAt)
  ) {
    return true;
  }

  // Current backend closes a fully settled loan as generic CLOSED. For IO,
  // cancelled future interest is already a direct early-settlement signal.
  if (Number(loan?.cancelledInterestAmount || 0) > 0) return true;

  const closedLike =
    status === 'closed'
    || Number(loan?.outstanding) <= 0
    || Boolean(loan?.closedDate || loan?.closedAt);

  if (!closedLike) return false;

  const closeDate = String(
    loan?.closedDate || loan?.closedAt || loan?.preclosedAt || '',
  ).slice(0, 10);
  const finalDueDate = plannedFinalDueDate(loan);

  // This is the key distinction:
  // closed BEFORE the contractual final due date = early/pre-close.
  // closed ON the final due date = normal final installment, so it can remain
  // visible as Paid in Today's Collection.
  return Boolean(closeDate && finalDueDate && closeDate < finalDueDate);
}

// V40: Collection keeps tab/filter/search/scroll position when opening a customer profile.
export default function Collection() {
  const { customers, collections, loans, payments, recordLoanPayment, rescheduleCollection } = useCrednivo();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = (() => {
    const view = String(searchParams.get('view') || 'today').toLowerCase();
    if (view === 'overdue') return 'Overdue';
    if (view === 'upcoming') return 'Upcoming';
    if (view === 'all') return 'All';
    return 'Today';
  })();
  const initialStatus = (() => {
    const requested = String(searchParams.get('status') || 'All');
    const allowed = ['All', 'Very Good', 'Good', 'Normal', 'Risky'];
    return allowed.includes(requested) ? requested : 'All';
  })();
  const initialCycle = (() => {
    const requested = String(searchParams.get('cycle') || 'All').toLowerCase();
    if (requested === 'daily') return 'Daily';
    if (requested === 'weekly') return 'Weekly';
    if (requested === 'monthly') return 'Monthly';
    return 'All';
  })();
  const initialSearch = String(searchParams.get('q') || '');

  const [cycle, setCycle] = useState(initialCycle);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [amountFilter, setAmountFilter] = useState('');
  const [amountCompare, setAmountCompare] = useState('Any');
  const [dueFilter, setDueFilter] = useState('');
  const [dueCompare, setDueCompare] = useState('Any');
  const [search, setSearch] = useState(initialSearch);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchParams.get('focus') === 'search') {
      searchInputRef.current?.focus();
    }
  }, []);
  const [collectionView, setCollectionView] = useState(initialView);
  const [scheduleLoanId, setScheduleLoanId] = useState(null);
  const [paying, setPaying] = useState(null);
  const [amount, setAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('0');
  const [fine, setFine] = useState('0');
  const [paymentDate, setPaymentDate] = useState(() => toInputDate());
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openFilterSection, setOpenFilterSection] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const paymentSubmitLockRef = useRef(false);

  const updateCollectionUrl = (changes = {}) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(changes).forEach(([key, value]) => {
      const normalized = String(value ?? '').trim();
      if (!normalized) next.delete(key);
      else next.set(key, normalized);
    });

    setSearchParams(next, { replace: true });
  };

  const changeCollectionView = (name) => {
    setCollectionView(name);
    updateCollectionUrl({ view: name === 'Today' ? '' : name.toLowerCase() });
  };

  const changeCycle = (name) => {
    setCycle(name);
    updateCollectionUrl({ cycle: name === 'All' ? '' : name.toLowerCase() });
  };

  const changeStatus = (name) => {
    setStatusFilter(name);
    updateCollectionUrl({ status: name === 'All' ? '' : name });
  };

  const changeSearch = (value) => {
    setSearch(value);
    updateCollectionUrl({ q: value.trim() ? value : '' });
  };

  const resetCollectionFilters = () => {
    setCycle('All');
    setStatusFilter('All');
    setAmountFilter('');
    setAmountCompare('Any');
    setDueFilter('');
    setDueCompare('Any');
    const next = new URLSearchParams(searchParams);
    next.delete('cycle');
    next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const saveCollectionReturnPosition = () => {
    try {
      sessionStorage.setItem('crednivo:collection-return', JSON.stringify({
        url: `${window.location.pathname}${window.location.search}`,
        scrollY: window.scrollY,
      }));
    } catch {
      // Browsers can disable sessionStorage; navigation should still work.
    }
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('crednivo:collection-return');
      if (!raw) return;

      const saved = JSON.parse(raw);
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (saved?.url !== currentUrl) return;

      sessionStorage.removeItem('crednivo:collection-return');
      const scrollY = Math.max(0, Number(saved?.scrollY || 0));
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
        });
      });
    } catch {
      // Ignore malformed/blocked sessionStorage data.
    }
  }, []);

  const today = toInputDate();

  // Section 1: same standing Daily/Weekly/Monthly capacity shown on Home.
  const cycleTargets = calculateCycleTargets(loans);

  // Section 2: This Week — Daily loans recur every day of the week, Weekly
  // loans are already a full week's worth, Monthly loans only count if
  // their own due date actually falls inside this specific week.
  const weekRange = useMemo(() => getWeekRange(today), [today]);
  const weekTarget = useMemo(() => calculateWeekTarget(loans, weekRange), [loans, weekRange]);
  const weekAchieved = useMemo(
    () => (payments || [])
      .filter((item) => item.type === 'Collection' && item.date >= weekRange.from && item.date <= weekRange.to)
      .reduce((sum, item) => sum + Number(item.collectionAmount ?? item.amount ?? 0), 0),
    [payments, weekRange],
  );
  const weekPending = Math.max(0, weekTarget - weekAchieved);

  // Section 4: how many currently-unpaid dues each customer has right now,
  // used to sort them into Very Good / Good / Normal / Risky.
  const pendingDueCounts = useMemo(() => calculatePendingDueCounts(collections, today), [collections, today]);

  // Customer pending summary used by the list + filters.
  // pendingAmount = total unpaid balance from all due/overdue installments.
  // pendingDueCount = number of those unpaid installments.
  const pendingSummaryByCustomer = useMemo(() => {
    const summary = new Map();
    (collections || []).forEach((item) => {
      if (String(item.status || '').toLowerCase() === 'cancelled') return;
      const dueDate = String(item.date || '').slice(0, 10);
      if (!dueDate || dueDate > today) return;
      const balance = balanceOf(item);
      if (balance <= 0) return;
      const key = String(item.customerId || '');
      if (!key) return;
      const current = summary.get(key) || { amount: 0, count: 0 };
      current.amount += balance;
      current.count += 1;
      summary.set(key, current);
    });
    return summary;
  }, [collections, today]);

  const customerPhotoById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.photo || ''])),
    [customers],
  );
  const customerPhoneById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.mobile || ''])),
    [customers],
  );

  // CURRENT BACKEND NOTE:
  // A loan settled early is stored as generic Closed + closedDate, not as a
  // dedicated Preclosed status. Detect early closure by comparing closedDate to
  // the contractual final due date derived from startDate + duration + cycle.
  // Older PRE-CLOSE markers remain supported for backward compatibility.
  const preclosedLoanKeys = useMemo(() => {
    const keys = new Set();

    (loans || []).forEach((loan) => {
      if (!isEarlyClosedLoan(loan)) return;
      loanIdentityKeys(loan).forEach((key) => keys.add(key));
    });

    (payments || []).forEach((payment) => {
      const isPreclosePayment = [
        payment?.type,
        payment?.rawType,
        payment?.transactionType,
        payment?.paymentType,
        payment?.closeType,
      ].some(isPrecloseMarker);

      if (!isPreclosePayment) return;
      collectionLoanIdentityKeys(payment).forEach((key) => keys.add(key));
    });

    return keys;
  }, [loans, payments]);

  const isPreclosedCollection = (item) =>
    collectionMatchesLoanKeySet(item, preclosedLoanKeys);

  // Summary cards intentionally stay focused on today's workload.
  // A preclosed loan is NOT a normal due anymore, even if its old schedule row
  // was already paid/filled during the preclose operation.
  const todayCollections = useMemo(
    () => collections.filter((item) => item.date === today && !collectionMatchesLoanKeySet(item, preclosedLoanKeys)),
    [collections, today, preclosedLoanKeys],
  );

  const todayExpected = todayCollections.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0);
  const todayPending = todayCollections.reduce((sum, item) => sum + balanceOf(item), 0);

  // Section 3: Today's Collection Status — amount/customerCount for each of
  // target, achieved and pending, built from the same todayCollections set
  // the existing "Expected Today" metrics already use.
  const todayTargetCustomers = new Set(todayCollections.map((item) => item.customerId)).size;
  const todayAchievedCustomers = new Set(
    todayCollections.filter((item) => getDisplayStatus(item, today) === 'Paid').map((item) => item.customerId),
  ).size;
  const todayPendingCustomers = Math.max(0, todayTargetCustomers - todayAchievedCustomers);
  const todayAchievedAmount = Math.max(0, todayExpected - todayPending);

  // Previous unpaid/partial entries remain in Overdue.
  const overdueCollections = useMemo(
    () => collections
      .filter((item) => !collectionMatchesLoanKeySet(item, preclosedLoanKeys) && item.date < today && balanceOf(item) > 0)
      .sort(sortByDateThenCustomer),
    [collections, today, preclosedLoanKeys],
  );

  // Upcoming only shows ONE next unpaid installment per active loan.
  // This prevents Daily loans from flooding the main Collection screen.
  const upcomingCollections = useMemo(() => {
    const nextByLoan = new Map();
    collections
      .filter((item) => !collectionMatchesLoanKeySet(item, preclosedLoanKeys) && item.date > today && balanceOf(item) > 0)
      .sort(sortByDateThenCustomer)
      .forEach((item) => {
        if (!nextByLoan.has(item.loanId)) nextByLoan.set(item.loanId, item);
      });
    return Array.from(nextByLoan.values()).sort(sortByDateThenCustomer);
  }, [collections, today, preclosedLoanKeys]);

  const activeCollections = useMemo(() => {
    const merged = [...overdueCollections, ...todayCollections, ...upcomingCollections];
    const seen = new Set();
    return merged.filter((item) => {
      const key = item.id || `${item.loanId}-${item.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort(sortByDateThenCustomer);
  }, [overdueCollections, todayCollections, upcomingCollections]);

  const viewRows = useMemo(() => {
    if (collectionView === 'Today') return todayCollections;
    if (collectionView === 'Overdue') return overdueCollections;
    if (collectionView === 'Upcoming') return upcomingCollections;
    return activeCollections;
  }, [collectionView, todayCollections, overdueCollections, upcomingCollections, activeCollections]);

  const activeFilterCount = Number(cycle !== 'All') + Number(statusFilter !== 'All') + Number(Boolean(amountFilter) && amountCompare !== 'Any') + Number(Boolean(dueFilter) && dueCompare !== 'Any');

  const filtered = useMemo(() => viewRows.filter((item) => {
    const q = search.toLowerCase().trim();
    const matchesCycle = cycle === 'All' || item.cycle === cycle;
    const riskTier = getRiskTier(pendingDueCounts.get(String(item.customerId || '')) || 0);
    const matchesStatus = statusFilter === 'All' || riskTier === statusFilter;
    const matchesSearch = !q || `${item.customerName} ${item.customerId} ${item.loanId} ${customerPhoneById[String(item.customerId)] || ''}`.toLowerCase().includes(q);
    return matchesCycle && matchesStatus && matchesSearch;
  }), [viewRows, cycle, statusFilter, search, pendingDueCounts, customerPhoneById]);

  // CUSTOMER LIST RULE: show each customer only once in the list.
  // Multiple due rows/loans are merged into one customer row while the Collect
  // and Reschedule actions continue with the earliest actionable due.
  const displayRows = useMemo(() => {
    const grouped = new Map();

    filtered.forEach((item) => {
      const customerKey = keyOf(item.customerId || item.customerName);
      const current = grouped.get(customerKey);
      const itemLoanKeys = new Set(collectionLoanIdentityKeys(item));
      const loan = (loans || []).find((entry) => loanIdentityKeys(entry).some((key) => itemLoanKeys.has(key)));

      if (!current) {
        grouped.set(customerKey, {
          ...item,
          id: `customer-group-${customerKey}`,
          primaryItem: item,
          sourceRows: [item],
          cycles: new Set([item.cycle]),
          loanKeys: new Set(collectionLoanIdentityKeys(item)),
          dueAmount: Number(item.dueAmount || 0),
          paidAmount: Number(item.paidAmount || 0),
          fine: Number(item.fine || 0),
          outstanding: Number(loan?.outstanding || 0),
          maxRescheduleCount: Number(item.rescheduleCount || 0),
          firstDueDate: item.date,
          overdueCount: item.date < today && balanceOf(item) > 0 ? 1 : 0,
        });
        return;
      }

      current.sourceRows.push(item);
      current.cycles.add(item.cycle);
      current.dueAmount += Number(item.dueAmount || 0);
      current.paidAmount += Number(item.paidAmount || 0);
      current.fine += Number(item.fine || 0);
      current.maxRescheduleCount = Math.max(current.maxRescheduleCount, Number(item.rescheduleCount || 0));
      if (!current.firstDueDate || String(item.date || '') < String(current.firstDueDate || '')) current.firstDueDate = item.date;
      if (item.date < today && balanceOf(item) > 0) current.overdueCount += 1;

      const loanKeys = collectionLoanIdentityKeys(item);
      const isNewLoan = !loanKeys.some((key) => current.loanKeys.has(key));
      if (isNewLoan) {
        loanKeys.forEach((key) => current.loanKeys.add(key));
        current.outstanding += Number(loan?.outstanding || 0);
      }

      const currentPrimary = current.primaryItem;
      const currentPaid = getDisplayStatus(currentPrimary, today) === 'Paid';
      const itemPaid = getDisplayStatus(item, today) === 'Paid';
      if ((currentPaid && !itemPaid) || (!itemPaid && String(item.date || '') < String(currentPrimary.date || ''))) {
        current.primaryItem = item;
        current.loanId = item.loanId;
        current.date = item.date;
        current.rescheduleCount = item.rescheduleCount;
      }
    });

    return Array.from(grouped.values())
      .map((item) => {
        const outstanding = Number(item.outstanding || 0);
        const pendingSummary = pendingSummaryByCustomer.get(String(item.customerId || '')) || { amount: 0, count: 0 };
        const pendingAmount = Number(pendingSummary.amount || 0);
        const pendingDueCount = Number(pendingSummary.count || 0);
        const amountLimit = Number(amountFilter || 0);
        const dueLimit = Number(dueFilter || 0);
        const matchesAmount = !amountFilter || amountCompare === 'Any'
          || (amountCompare === 'Less' ? pendingAmount < amountLimit : pendingAmount > amountLimit);
        const matchesDue = !dueFilter || dueCompare === 'Any'
          || (dueCompare === 'Less' ? pendingDueCount < dueLimit : pendingDueCount > dueLimit);
        return {
          ...item,
          cycle: Array.from(item.cycles).join(', '),
          outstanding,
          pendingAmount,
          pendingDueCount,
          riskTier: getRiskTier(pendingDueCounts.get(String(item.customerId || '')) || 0),
          matchesAmount,
          matchesDue,
        };
      })
      .filter((item) => item.matchesAmount && item.matchesDue)
      .sort((a, b) => String(a.customerName || '').localeCompare(String(b.customerName || '')));
  }, [filtered, loans, today, amountFilter, amountCompare, dueFilter, dueCompare, pendingDueCounts, pendingSummaryByCustomer]);

  const scheduleRows = useMemo(() => {
    if (!scheduleLoanId) return [];
    return collections
      .filter((item) => item.loanId === scheduleLoanId)
      .slice()
      .sort(sortByDateThenCustomer);
  }, [collections, scheduleLoanId]);

  const scheduleLoan = loans.find((loan) => loan.id === scheduleLoanId);
  const scheduleCustomer = scheduleRows[0];

  // Rebuild the actual payment date for each installment from the loan's payment
  // transactions. The backend allocates collection credit to due/on-date entries
  // first and then to the earliest future installment, so replay the same rule here.
  const scheduleRowsWithPaidDates = useMemo(() => {
    if (!scheduleLoanId || !scheduleRows.length) return scheduleRows;

    const simulated = scheduleRows.map((row) => ({
      ...row,
      simulatedPaid: 0,
      paidDate: null,
    }));

    const loanPayments = (payments || [])
      .filter((payment) =>
        payment.loanId === scheduleLoanId &&
        payment.type === 'Collection' &&
        payment.direction !== 'out'
      )
      .slice()
      .sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || '')) ||
        String(a.id || '').localeCompare(String(b.id || ''))
      );

    for (const payment of loanPayments) {
      const paymentDateValue = payment.date || '';
      let remaining = scheduleLoan?.loanType === 'IO'
        ? Number(payment.interestPaid || 0)
        : Number(payment.collectionAmount ?? payment.amount ?? 0);

      if (remaining <= 0) continue;

      const candidates = simulated
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => Number(row.simulatedPaid || 0) < Number(row.dueAmount || 0))
        .sort((a, b) => {
          const aFuture = a.row.date > paymentDateValue ? 1 : 0;
          const bFuture = b.row.date > paymentDateValue ? 1 : 0;
          if (aFuture !== bFuture) return aFuture - bFuture;
          return String(a.row.date || '').localeCompare(String(b.row.date || ''));
        });

      for (const { index } of candidates) {
        if (remaining <= 0) break;

        const row = simulated[index];
        const dueRemaining = Math.max(
          0,
          Number(row.dueAmount || 0) - Number(row.simulatedPaid || 0),
        );
        const applied = Math.min(remaining, dueRemaining);

        if (applied > 0) {
          row.simulatedPaid = Number(row.simulatedPaid || 0) + applied;
          row.paidDate = paymentDateValue;
          remaining -= applied;
        }
      }
    }

    return simulated.map(({ simulatedPaid, ...row }) => row);
  }, [scheduleLoanId, scheduleRows, scheduleLoan?.loanType, payments]);

  const openPay = (item) => {
    const itemKeys = new Set(collectionLoanIdentityKeys(item));
    const loan = (loans || []).find((entry) =>
      loanIdentityKeys(entry).some((key) => itemKeys.has(key)),
    );
    if (!loan || isPreclosedCollection(item) || String(loan.status || '').toLowerCase() === 'closed' || String(loan.status || '').toLowerCase() === 'preclosed' || Number(loan.outstanding) <= 0) {
      setActionError('This loan is closed. No additional payment can be recorded.');
      return;
    }
    const balance = balanceOf(item);
    setPaying({ ...item, loan });
    if (loan?.loanType === 'IO') {
      setAmount('');
      setInterestAmount(String(balance || Number(loan.collectionAmount) || Number(loan.interestAmount) || 0));
      setPrincipalAmount('0');
    } else {
      setAmount(String(balance || item.dueAmount));
      setInterestAmount('');
      setPrincipalAmount('0');
    }
    const displayStatus = getDisplayStatus(item, today);
    const defaultFine = displayStatus === 'Overdue'
      && loan?.fineEnabled
      && Number(item.fine || 0) <= 0
        ? Number(loan.fineAmount || 0)
        : 0;
    setFine(String(defaultFine));
    setPaymentDate(toInputDate());
    setPaymentMode('Cash');
  };

  const submit = async () => {
    if (!paying || paymentSubmitLockRef.current) return;

    const isIo = paying.loan?.loanType === 'IO';
    const paymentTotal = isIo
      ? Number(interestAmount || 0) + Number(principalAmount || 0)
      : Number(amount || 0);
    const fineTotal = Number(fine || 0);

    // Allow a fine-only collection. Reject only when both normal payment
    // and fine are zero.
    if (paymentTotal <= 0 && fineTotal <= 0) {
      setActionError('Enter an amount paid or a fine amount before saving.');
      return;
    }

    // Synchronous lock prevents accidental double-click / double-submit
    // before React has time to re-render the disabled button.
    paymentSubmitLockRef.current = true;
    setPaymentSaving(true);
    setActionError('');

    try {
      const saved = isIo
        ? await recordLoanPayment(paying.loanId, {
            interestAmount,
            principalAmount,
            fine,
            paymentDate,
            paymentMode,
          })
        : await recordLoanPayment(paying.loanId, {
            amount,
            fine,
            paymentDate,
            paymentMode,
          });

      if (saved) {
        setPaying(null);
        setAmount('');
        setInterestAmount('');
        setPrincipalAmount('0');
        setFine('0');
      }
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not save the collection to the database.');
    } finally {
      paymentSubmitLockRef.current = false;
      setPaymentSaving(false);
    }
  };

  const openReschedule = (item) => {
    const source = item?.primaryItem || item;
    if (!source || getDisplayStatus(source, today) === 'Paid') return;
    setActionError('');
    setRescheduling(source);
    setRescheduleDate(source.date > today ? source.date : '');
  };

  const submitReschedule = async () => {
    if (!rescheduling || !rescheduleDate || rescheduleSaving) return;
    setRescheduleSaving(true);
    setActionError('');
    try {
      await rescheduleCollection(rescheduling.id, rescheduleDate);
      setRescheduling(null);
      setRescheduleDate('');
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not reschedule this collection.');
    } finally {
      setRescheduleSaving(false);
    }
  };

  const loanForItem = (item) => {
    const itemKeys = new Set(collectionLoanIdentityKeys(item));
    return (loans || []).find((loan) =>
      loanIdentityKeys(loan).some((key) => itemKeys.has(key)),
    );
  };

  const isLoanClosed = (item) => {
    const loan = loanForItem(item);
    const status = String(loan?.status || '').trim().toLowerCase();
    return !loan || isPreclosedCollection(item) || status === 'closed' || status === 'preclosed' || Number(loan.outstanding) <= 0;
  };

  const actionLabel = (item) => {
    if (isLoanClosed(item)) return 'Closed';
    const displayStatus = getDisplayStatus(item, today);
    if (displayStatus === 'Partial') return 'Pay Balance';
    if (displayStatus === 'Pending') return 'Collect Balance';
    if (item.date > today && displayStatus !== 'Paid') return 'Pay Early';
    if (displayStatus === 'Paid') return 'Add Payment';
    return 'Collect';
  };

  const emptyMessage = {
    Today: 'No collections are due today.',
    Overdue: 'No overdue collections. Great work.',
    Upcoming: 'No upcoming collection is scheduled.',
    All: 'No active collection entries found.',
  }[collectionView];

  return (
    <div className="module-page collection-page">
      <ModuleHeader
        eyebrow="Field Collection"
        title="Collections"
        description="Focus on today's dues and overdue recovery. Upcoming shows only the next installment for each active loan."
      />

      {actionError && <div className="form-error">{actionError}</div>}

      <section className="collection-summary-board" aria-label="Collection summary">
        <div className="collection-summary-column">
          <div className="collection-summary-heading">
            <span>Cycle Target</span>
            <small>Standing collection target</small>
          </div>
          <div className="collection-summary-list">
            <div className="collection-summary-row tone-blue">
              <span className="collection-summary-icon"><IndianRupee size={17} /></span>
              <span className="collection-summary-copy"><b>Daily Target</b><small>{cycleTargets.daily.customerCount} {cycleTargets.daily.customerCount === 1 ? 'customer' : 'customers'}</small></span>
              <strong>{formatCurrency(cycleTargets.daily.amount)}</strong>
            </div>
            <div className="collection-summary-row tone-green">
              <span className="collection-summary-icon"><IndianRupee size={17} /></span>
              <span className="collection-summary-copy"><b>Weekly Target</b><small>{cycleTargets.weekly.customerCount} {cycleTargets.weekly.customerCount === 1 ? 'customer' : 'customers'}</small></span>
              <strong>{formatCurrency(cycleTargets.weekly.amount)}</strong>
            </div>
            <div className="collection-summary-row tone-purple">
              <span className="collection-summary-icon"><IndianRupee size={17} /></span>
              <span className="collection-summary-copy"><b>Monthly Target</b><small>{cycleTargets.monthly.customerCount} {cycleTargets.monthly.customerCount === 1 ? 'customer' : 'customers'}</small></span>
              <strong>{formatCurrency(cycleTargets.monthly.amount)}</strong>
            </div>
          </div>
        </div>

        <div className="collection-summary-column">
          <div className="collection-summary-heading">
            <span>Current Week</span>
            <small>Weekly collection progress</small>
          </div>
          <div className="collection-summary-list">
            <div className="collection-summary-row tone-blue">
              <span className="collection-summary-icon"><CalendarDays size={17} /></span>
              <span className="collection-summary-copy"><b>Target</b><small>Expected this week</small></span>
              <strong>{formatCurrency(weekTarget)}</strong>
            </div>
            <div className="collection-summary-row tone-green">
              <span className="collection-summary-icon"><HandCoins size={17} /></span>
              <span className="collection-summary-copy"><b>Achieved</b><small>Collected so far</small></span>
              <strong>{formatCurrency(weekAchieved)}</strong>
            </div>
            <div className="collection-summary-row tone-orange">
              <span className="collection-summary-icon"><TriangleAlert size={17} /></span>
              <span className="collection-summary-copy"><b>Pending</b><small>Remaining collection</small></span>
              <strong>{formatCurrency(weekPending)}</strong>
            </div>
          </div>
        </div>

        <div className="collection-summary-column">
          <div className="collection-summary-heading">
            <span>Today’s Status</span>
            <small>Today’s collection position</small>
          </div>
          <div className="collection-summary-list">
            <div className="collection-summary-row tone-blue">
              <span className="collection-summary-icon"><IndianRupee size={17} /></span>
              <span className="collection-summary-copy"><b>Target</b><small>{todayTargetCustomers} {todayTargetCustomers === 1 ? 'customer' : 'customers'} due</small></span>
              <strong>{formatCurrency(todayExpected)}</strong>
            </div>
            <div className="collection-summary-row tone-green">
              <span className="collection-summary-icon"><HandCoins size={17} /></span>
              <span className="collection-summary-copy"><b>Achieved</b><small>{todayAchievedCustomers} {todayAchievedCustomers === 1 ? 'customer' : 'customers'} paid</small></span>
              <strong>{formatCurrency(todayAchievedAmount)}</strong>
            </div>
            <div className="collection-summary-row tone-orange">
              <span className="collection-summary-icon"><TriangleAlert size={17} /></span>
              <span className="collection-summary-copy"><b>Pending</b><small>{todayPendingCustomers} {todayPendingCustomers === 1 ? 'customer' : 'customers'} pending</small></span>
              <strong>{formatCurrency(todayPending)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="module-card">
        <div className="collection-view-tabs" role="tablist" aria-label="Collection view">
          {[
            ['Today', todayCollections.length],
            ['Overdue', overdueCollections.length],
            ['Upcoming', upcomingCollections.length],
            ['All', activeCollections.length],
          ].map(([name, count]) => (
            <button
              type="button"
              key={name}
              role="tab"
              aria-selected={collectionView === name}
              className={`collection-view-tab ${collectionView === name ? 'active' : ''}`}
              onClick={() => changeCollectionView(name)}
            >
              <span>{name}</span>
              <b>{count}</b>
            </button>
          ))}
        </div>

        <div className="module-toolbar collection-toolbar">
          <label className="module-search">
            <Search size={16} />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search customer or loan..."
            />
          </label>

          <div className="collection-filter-menu">
            <button
              type="button"
              className={`collection-filter-trigger ${filtersOpen ? 'open' : ''} ${activeFilterCount ? 'active' : ''}`}
              onClick={() => setFiltersOpen((value) => !value)}
              aria-label="Collection filters"
              aria-expanded={filtersOpen}
              title="Filters"
            >
              <Filter size={18} />
              {activeFilterCount > 0 && <span className="collection-filter-count">{activeFilterCount}</span>}
            </button>

            {filtersOpen && (
              <div className="collection-filter-popover module-card">
                <div className="collection-filter-popover-head">
                  <div>
                    <strong>Filters</strong>
                    <span>Filter the current collection view</span>
                  </div>
                  <button
                    type="button"
                    className="collection-filter-close"
                    onClick={() => setFiltersOpen(false)}
                    aria-label="Close filters"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className={`collection-filter-section ${openFilterSection === 'cycle' ? 'open' : ''}`}>
                  <button type="button" className="collection-filter-section-toggle" onClick={() => setOpenFilterSection((value) => value === 'cycle' ? null : 'cycle')}>
                    <span>Cycle</span><ChevronDown size={16} />
                  </button>
                  {openFilterSection === 'cycle' && (
                    <div className="collection-filter-section-body">
                      <div className="collection-filter-options">
                        {['All', 'Daily', 'Weekly', 'Monthly'].map((item) => (
                          <button type="button" className={`filter-chip ${cycle === item ? 'active' : ''}`} key={item} onClick={() => changeCycle(item)}>{item}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`collection-filter-section ${openFilterSection === 'status' ? 'open' : ''}`}>
                  <button type="button" className="collection-filter-section-toggle" onClick={() => setOpenFilterSection((value) => value === 'status' ? null : 'status')}>
                    <span>Status</span><ChevronDown size={16} />
                  </button>
                  {openFilterSection === 'status' && (
                    <div className="collection-filter-section-body">
                      <div className="collection-filter-options">
                        {['All', 'Very Good', 'Good', 'Normal', 'Risky'].map((item) => (
                          <button type="button" className={`filter-chip ${statusFilter === item ? 'active' : ''}`} key={item} onClick={() => changeStatus(item)}>{item}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`collection-filter-section ${openFilterSection === 'amount' ? 'open' : ''}`}>
                  <button type="button" className="collection-filter-section-toggle" onClick={() => setOpenFilterSection((value) => value === 'amount' ? null : 'amount')}>
                    <span>Pending Amount</span><ChevronDown size={16} />
                  </button>
                  {openFilterSection === 'amount' && (
                    <div className="collection-filter-section-body">
                      <label className="collection-filter-input-shell">
                        <IndianRupee size={15} />
                        <input type="number" min="0" value={amountFilter} onChange={(event) => setAmountFilter(event.target.value)} placeholder="Enter pending amount" />
                      </label>
                      <div className="collection-compare-toggle" role="group" aria-label="Pending amount comparison">
                        <button type="button" className={amountCompare === 'Less' ? 'active' : ''} onClick={() => setAmountCompare('Less')}><span>&lt;</span><small>Less</small></button>
                        <button type="button" className={amountCompare === 'Any' ? 'active center' : 'center'} onClick={() => setAmountCompare('Any')}><span>•</span><small>Off</small></button>
                        <button type="button" className={amountCompare === 'Greater' ? 'active' : ''} onClick={() => setAmountCompare('Greater')}><span>&gt;</span><small>Greater</small></button>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`collection-filter-section ${openFilterSection === 'due' ? 'open' : ''}`}>
                  <button type="button" className="collection-filter-section-toggle" onClick={() => setOpenFilterSection((value) => value === 'due' ? null : 'due')}>
                    <span>Pending Due</span><ChevronDown size={16} />
                  </button>
                  {openFilterSection === 'due' && (
                    <div className="collection-filter-section-body">
                      <label className="collection-filter-input-shell due-count">
                        <span className="collection-filter-input-prefix">#</span>
                        <input type="number" min="0" step="1" value={dueFilter} onChange={(event) => setDueFilter(event.target.value)} placeholder="Enter pending due count" />
                      </label>
                      <div className="collection-compare-toggle" role="group" aria-label="Pending due comparison">
                        <button type="button" className={dueCompare === 'Less' ? 'active' : ''} onClick={() => setDueCompare('Less')}><span>&lt;</span><small>Less</small></button>
                        <button type="button" className={dueCompare === 'Any' ? 'active center' : 'center'} onClick={() => setDueCompare('Any')}><span>•</span><small>Off</small></button>
                        <button type="button" className={dueCompare === 'Greater' ? 'active' : ''} onClick={() => setDueCompare('Greater')}><span>&gt;</span><small>Greater</small></button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="collection-filter-actions">
                  <button
                    type="button"
                    className="collection-filter-reset"
                    onClick={resetCollectionFilters}
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                  <button
                    type="button"
                    className="collection-filter-done"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="collection-view-note">
          {collectionView === 'Today' && 'Collections due today for open loans, including normal entries already paid today. Early-closed loans are excluded.'}
          {collectionView === 'Overdue' && 'Previous unpaid and partial installments are grouped into one row per customer loan.'}
          {collectionView === 'Upcoming' && 'Only the next unpaid installment for each active loan is shown.'}
          {collectionView === 'All' && 'Overdue + today + one next upcoming installment per active loan.'}
        </div>

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table">
            <thead>
              <tr>
                <th>Customer</th><th>Phone Number</th><th>Cycle</th><th>Due Amount</th><th>Outstanding</th><th>Pending</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((item) => {
                const source = item.primaryItem || item;
                const loanClosed = isLoanClosed(source);
                const paid = getDisplayStatus(source, today) === 'Paid';
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="row-title">
                        <CustomerAvatar className="row-avatar" photo={customerPhotoById[String(item.customerId)]} name={item.customerName} />
                        <div>
                          <strong onClickCapture={saveCollectionReturnPosition}><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong>
                          <small>{item.customerId}{item.maxRescheduleCount > 0 && item.date === today ? ` · Re-schedule ${item.maxRescheduleCount}` : ''}</small>
                        </div>
                      </div>
                    </td>
                    <td>{customerPhoneById[String(item.customerId)] || '—'}</td>
                    <td><span className="soft-chip blue">{item.cycle}</span></td>
                    <td><strong>{formatCurrency(Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)))}</strong></td>
                    <td><strong>{formatCurrency(item.outstanding)}</strong></td>
                    <td><div className="collection-pending-value"><strong>{formatCurrency(item.pendingAmount)}</strong><span>/ {item.pendingDueCount}</span></div></td>
                    <td><StatusBadge status={item.riskTier} /></td>
                    <td>
                      <div className="collection-row-actions">
                        {hasPermission('collections.collect') && (
                          <>
                            <ActionButton
                              tone={loanClosed || paid ? 'secondary' : 'success'}
                              icon={HandCoins}
                              onClick={() => !loanClosed && !paid && openPay(source)}
                              disabled={loanClosed || paid}
                              className={loanClosed ? 'collection-closed-action' : ''}
                              title={loanClosed ? 'Loan closed — no additional payment allowed' : 'Collect'}
                            >
                              Collect
                            </ActionButton>
                            <button
                              type="button"
                              className="collection-reschedule-button"
                              onClick={() => openReschedule(source)}
                              disabled={loanClosed || paid}
                              title="Reschedule collection"
                            >
                              <CalendarDays size={14} /> Reschedule
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayRows.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="collection-empty-state">
                    <CalendarDays size={22} /><strong>{emptyMessage}</strong><span>Try another view or adjust the filters.</span>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-data-list">
          {displayRows.map((item) => {
            const source = item.primaryItem || item;
            const loanClosed = isLoanClosed(source);
            const paid = getDisplayStatus(source, today) === 'Paid';
            return (
              <article className="mobile-data-card" key={item.id}>
                <div className="mobile-data-top">
                  <div className="row-title">
                    <CustomerAvatar className="row-avatar" photo={customerPhotoById[String(item.customerId)]} name={item.customerName} />
                    <div>
                      <strong onClickCapture={saveCollectionReturnPosition}><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong>
                      <small>{customerPhoneById[String(item.customerId)] || '—'}</small>
                    </div>
                  </div>
                  <StatusBadge status={item.riskTier} />
                </div>
                {item.maxRescheduleCount > 0 && item.date === today && <div className="collection-reschedule-chip">Re-schedule {item.maxRescheduleCount}</div>}
                <div className="mobile-data-meta">
                  <div><span>Cycle</span><strong>{item.cycle}</strong></div>
                  <div><span>Due Amount</span><strong>{formatCurrency(Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)))}</strong></div>
                  <div><span>Outstanding</span><strong>{formatCurrency(item.outstanding)}</strong></div>
                  <div><span>Pending</span><strong>{formatCurrency(item.pendingAmount)} / {item.pendingDueCount}</strong></div>
                </div>
                <div className="collection-mobile-action">
                  {hasPermission('collections.collect') && (
                    <>
                      <button type="button" className="collection-reschedule-button" onClick={() => openReschedule(source)} disabled={loanClosed || paid}>
                        <CalendarDays size={14} /> Reschedule
                      </button>
                      <ActionButton tone={loanClosed || paid ? 'secondary' : 'success'} icon={HandCoins} onClick={() => !loanClosed && !paid && openPay(source)} disabled={loanClosed || paid}>
                        Collect
                      </ActionButton>
                    </>
                  )}
                </div>
              </article>
            );
          })}
          {displayRows.length === 0 && (
            <div className="collection-empty-state mobile">
              <CalendarDays size={22} /><strong>{emptyMessage}</strong><span>Try another view or adjust the filters.</span>
            </div>
          )}
        </div>
      </section>

      {rescheduling && (
        <div className="collection-modal-backdrop" onMouseDown={() => !rescheduleSaving && setRescheduling(null)}>
          <div className="collection-reschedule-modal module-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div><strong>Reschedule Collection</strong><span>{rescheduling.customerName} · {rescheduling.cycle}</span></div>
              <IconButton label="Close" onClick={() => !rescheduleSaving && setRescheduling(null)}><X size={18} /></IconButton>
            </div>
            <div className="collection-reschedule-info">
              <span>Current due date</span><strong>{formatDate(rescheduling.date)}</strong>
              <span>Due amount</span><strong>{formatCurrency(balanceOf(rescheduling))}</strong>
            </div>
            <label className="collection-reschedule-field">
              <span>New collection date</span>
              <input type="date" min={today} value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
            </label>
            <div className="collection-filter-actions">
              <button type="button" className="collection-filter-reset" onClick={() => setRescheduling(null)} disabled={rescheduleSaving}>Cancel</button>
              <button type="button" className="collection-filter-done" onClick={submitReschedule} disabled={!rescheduleDate || rescheduleSaving}>
                {rescheduleSaving ? 'Saving...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleLoanId && (
        <div className="collection-modal-backdrop" onMouseDown={() => setScheduleLoanId(null)}>
          <div className="collection-schedule-modal module-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div>
                <strong>Full Loan Schedule</strong>
                <span>{scheduleCustomer?.customerName || 'Customer'} · {scheduleLoanId}</span>
              </div>
              <IconButton label="Close" onClick={() => setScheduleLoanId(null)}><X size={18} /></IconButton>
            </div>

            <div className="collection-schedule-summary">
              <div><span>Cycle</span><strong>{scheduleLoan?.cycle || scheduleCustomer?.cycle || '-'}</strong></div>
              <div><span>Installments</span><strong>{scheduleRows.length}</strong></div>
              <div><span>Collection / Cycle</span><strong>{formatCurrency(scheduleLoan?.collectionAmount || scheduleRows[0]?.dueAmount || 0)}</strong></div>
              <div><span>Outstanding</span><strong>{formatCurrency(scheduleLoan?.outstanding || 0)}</strong></div>
            </div>

            <div className="collection-schedule-scroll desktop-data-table">
              <table className="module-table collection-schedule-table">
                <thead><tr><th>#</th><th>Pay Date</th><th>Paid Date</th><th>Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                <tbody>
                  {scheduleRowsWithPaidDates.map((row, index) => (
                    <tr key={row.id} className={row.date === today ? 'schedule-today-row' : ''}>
                      <td>{index + 1}</td>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.paidDate ? formatDate(row.paidDate) : '—'}</td>
                      <td>{formatCurrency(row.dueAmount)}</td>
                      <td>{formatCurrency(row.paidAmount)}</td>
                      <td><strong>{formatCurrency(balanceOf(row))}</strong></td>
                      <td><StatusBadge status={getDisplayStatus(row, today)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="crednivo-popup-end-spacer" aria-hidden="true" />
            </div>

            <div className="mobile-data-list collection-schedule-mobile">
              {scheduleRowsWithPaidDates.map((row, index) => (
                <article className="mobile-data-card" key={row.id}>
                  <div className="mobile-data-top">
                    <strong>#{index + 1} · Pay {formatDate(row.date)}</strong>
                    <StatusBadge status={getDisplayStatus(row, today)} />
                  </div>
                  <div className="mobile-data-meta">
                    <div><span>Paid Date</span><strong>{row.paidDate ? formatDate(row.paidDate) : '—'}</strong></div>
                    <div><span>Due</span><strong>{formatCurrency(row.dueAmount)}</strong></div>
                    <div><span>Paid</span><strong>{formatCurrency(row.paidAmount)}</strong></div>
                    <div><span>Balance</span><strong>{formatCurrency(balanceOf(row))}</strong></div>
                  </div>
                </article>
              ))}
              <div className="crednivo-popup-end-spacer" aria-hidden="true" />
            </div>
          </div>
        </div>
      )}

      {paying && (
        <div className="collection-modal-backdrop" onMouseDown={() => setPaying(null)}>
          <div className="collection-modal module-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div><strong>{paying.date > today ? 'Record Early Payment' : 'Record Collection'}</strong><span>{paying.customerName} · {paying.customerId}</span></div>
              <IconButton label="Close" onClick={() => setPaying(null)}><X size={18} /></IconButton>
            </div>
            <div className="collection-due-banner">
              <span>{paying.loan?.loanType === 'IO' ? 'Interest due' : paying.date > today ? 'Next scheduled amount' : 'Due amount'}</span>
              <strong>{formatCurrency(paying.dueAmount)}</strong>
              <small>{paying.loan?.loanType === 'IO' ? `Principal outstanding ${formatCurrency(paying.loan?.outstanding)}. Interest and principal are separate. Full principal settlement requires only already-due/pending interest; future interest is cancelled.` : paying.date > today ? `Scheduled for ${formatDate(paying.date)}. Payment will be recorded using the actual received date.` : 'Overpay is allowed. Fine is tracked separately.'}</small>
            </div>
            <div className="form-grid collection-modal-form">
              {paying.loan?.loanType === 'IO' ? <>
                <div className="form-field collection-date-field">
                  <label>Payment Date</label>
                  <input type="date" min={paying.loan?.startDate || undefined} max={toInputDate()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                  <small className="field-help">Use the actual received date.</small>
                </div>
                <div className="form-field">
                  <label>Interest Paid</label>
                  <input autoFocus type="number" min="0" value={interestAmount} onChange={(event) => setInterestAmount(event.target.value)} />
                </div>
                <div className="form-field">
                  <label>Principal Paid</label>
                  <input type="number" min="0" max={Number(paying.loan?.outstanding) || undefined} value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} />
                  <small className="field-help">Maximum principal: {formatCurrency(paying.loan?.outstanding)}</small>
                </div>
              </> : <>
              <div className="form-field collection-date-field">
                <label>Payment Date</label>
                <input type="date" min={paying.loan?.startDate || undefined} max={toInputDate()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                <small className="field-help">Use the actual received date.</small>
              </div>
              <div className="form-field">
                <label>Amount Paid</label>
                <input autoFocus type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
                <small className="field-help">Set this to 0 or leave it blank when collecting only a fine.</small>
              </div></>}
              {hasPermission('collections.fine') && <div className="form-field">
                <label>Fine Paid</label>
                <input type="number" min="0" value={fine} onChange={(event) => setFine(event.target.value)} />
              </div>}
              <div className="form-field">
                <label>Payment Mode</label>
                <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
                  <option>Cash</option><option>UPI</option><option>Bank</option><option>Cheque</option><option>Other</option>
                </select>
              </div>
            </div>
            <ActionButton
              icon={Check}
              onClick={submit}
              disabled={paymentSaving}
            >
              {paymentSaving ? 'Saving…' : 'Save Collection'}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
