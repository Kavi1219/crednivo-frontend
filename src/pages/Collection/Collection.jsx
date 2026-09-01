import { CalendarDays, Check, Filter, HandCoins, IndianRupee, List, RotateCcw, Search, TriangleAlert, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import CustomerProfileLink from '../../components/common/CustomerProfileLink';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Collection.css';

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

function keyOf(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function loanIdentityKeys(loan) {
  return [
    loan?.id,
    loan?.loanId,
    loan?.loanCode,
    loan?.code,
    loan?.loanDbId,
    loan?.dbLoanId,
  ].map(keyOf).filter(Boolean);
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

function isPrecloseMarker(value) {
  const marker = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');

  return marker === 'PRECLOSE' || marker === 'PRECLOSED';
}

export default function Collection() {
  const { collections, loans, payments, recordLoanPayment } = useCrednivo();
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const initialView = (() => {
    const view = String(searchParams.get('view') || 'today').toLowerCase();
    if (view === 'overdue') return 'Overdue';
    if (view === 'upcoming') return 'Upcoming';
    if (view === 'all') return 'All';
    return 'Today';
  })();
  const initialStatus = (() => {
    const requested = String(searchParams.get('status') || 'All');
    const allowed = ['All', 'Unpaid', 'Partial', 'Pending', 'Paid', 'Overdue'];
    return allowed.includes(requested) ? requested : 'All';
  })();
  const [cycle, setCycle] = useState('All');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState('');
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
  const [actionError, setActionError] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const paymentSubmitLockRef = useRef(false);

  const today = toInputDate();

  // A preclosed loan is finished immediately, even when its original due date
  // is today. Detect it from BOTH the loan record and the PRE-CLOSE transaction.
  // This is intentional: depending on API normalization, a collection row may
  // carry SFCLN-00053 while the loan record also has a numeric database id, and
  // some screens can normalize the final loan status to Closed. The transaction
  // still tells us that the close type was PRE-CLOSE.
  const preclosedLoanKeys = useMemo(() => {
    const keys = new Set();

    (loans || []).forEach((loan) => {
      const status = String(loan?.status || '').trim().toUpperCase();
      const closeType = String(loan?.closeType || '').trim().toUpperCase();

      const isPreclosed =
        isPrecloseMarker(status) ||
        isPrecloseMarker(closeType) ||
        Boolean(loan?.preclosedAt);

      if (!isPreclosed) return;
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

  // Actual cash received today. This intentionally includes:
  // - normal collections due today
  // - early payments for future installments
  // - overdue recoveries collected today
  const todayCollected = useMemo(
    () => (payments || [])
      .filter((item) => item.date === today && item.type === 'Collection')
      .reduce((sum, item) => sum + Number(item.collectionAmount ?? item.amount ?? 0), 0),
    [payments, today],
  );

  const todayPending = todayCollections.reduce((sum, item) => sum + balanceOf(item), 0);
  const todayTotalEntries = todayCollections.length;
  const todayPaidEntries = todayCollections.filter((item) => getDisplayStatus(item, today) === 'Paid').length;
  const todayUnpaidEntries = Math.max(0, todayTotalEntries - todayPaidEntries);

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

  const activeFilterCount = Number(cycle !== 'All') + Number(statusFilter !== 'All');

  const filtered = useMemo(() => viewRows.filter((item) => {
    const q = search.toLowerCase().trim();
    const displayStatus = getDisplayStatus(item, today);
    const matchesCycle = cycle === 'All' || item.cycle === cycle;
    const matchesStatus = statusFilter === 'All' || displayStatus === statusFilter;
    const matchesSearch = !q || `${item.customerName} ${item.customerId} ${item.loanId}`.toLowerCase().includes(q);
    return matchesCycle && matchesStatus && matchesSearch;
  }), [viewRows, cycle, statusFilter, search, today]);

  // OVERDUE VIEW RULE:
  // Keep the Overdue tab badge as the number of missed installments, but show
  // only ONE summary row per customer loan inside the Overdue table/list.
  const displayRows = useMemo(() => {
    if (collectionView !== 'Overdue') return filtered;

    const grouped = new Map();

    filtered.forEach((item) => {
      const identity = collectionLoanIdentityKeys(item)[0] || keyOf(item.loanId);
      const key = `${keyOf(item.customerId || item.customerName)}-${identity}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          ...item,
          id: `overdue-group-${key}`,
          overdueCount: 1,
          dueAmount: Number(item.dueAmount || 0),
          paidAmount: Number(item.paidAmount || 0),
          fine: Number(item.fine || 0),
          firstOverdueDate: item.date,
          lastOverdueDate: item.date,
          groupedOverdue: true,
        });
        return;
      }

      existing.overdueCount += 1;
      existing.dueAmount += Number(item.dueAmount || 0);
      existing.paidAmount += Number(item.paidAmount || 0);
      existing.fine += Number(item.fine || 0);

      if (!existing.firstOverdueDate || String(item.date || '') < String(existing.firstOverdueDate || '')) {
        existing.firstOverdueDate = item.date;
        existing.date = item.date;
      }
      if (!existing.lastOverdueDate || String(item.date || '') > String(existing.lastOverdueDate || '')) {
        existing.lastOverdueDate = item.date;
      }
    });

    return Array.from(grouped.values()).map((item) => {
      const itemKeys = new Set(collectionLoanIdentityKeys(item));
      const loan = (loans || []).find((entry) =>
        loanIdentityKeys(entry).some((key) => itemKeys.has(key)),
      );
      const allKeys = new Set([
        ...collectionLoanIdentityKeys(item),
        ...loanIdentityKeys(loan),
      ]);

      const loanPaid = (payments || [])
        .filter((payment) =>
          collectionLoanIdentityKeys(payment).some((key) => allKeys.has(key)) &&
          String(payment.type || '').toLowerCase() === 'collection' &&
          String(payment.direction || '').toLowerCase() !== 'out'
        )
        .reduce((sum, payment) => sum + Number(payment.collectionAmount ?? payment.amount ?? 0), 0);

      return {
        ...item,
        loanPaid,
        loanOutstanding: Number(loan?.outstanding || 0),
      };
    }).sort(sortByDateThenCustomer);
  }, [collectionView, filtered, loans, payments]);

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

      <section className="metric-strip collection-metric-strip">
        <article className="mini-metric module-card">
          <span className="mini-metric-icon"><IndianRupee size={20} /></span>
          <div><span>Expected Today</span><strong>{formatCurrency(todayExpected)}</strong></div>
        </article>
        <article className="mini-metric module-card">
          <span className="mini-metric-icon"><HandCoins size={20} /></span>
          <div><span>Collected Today</span><strong>{formatCurrency(todayCollected)}</strong></div>
        </article>
        <article className="mini-metric module-card">
          <span className="mini-metric-icon"><TriangleAlert size={20} /></span>
          <div><span>Pending Today</span><strong>{formatCurrency(todayPending)}</strong></div>
        </article>
        <article className="mini-metric module-card">
          <span className="mini-metric-icon"><List size={20} /></span>
          <div><span>Due Today Entries</span><strong>{todayTotalEntries}</strong></div>
        </article>
        <article className="mini-metric module-card collection-entry-split">
          <span className="mini-metric-icon"><Check size={20} /></span>
          <div>
            <span>Today's Due Paid / Unpaid</span>
            <strong>{todayPaidEntries} / {todayUnpaidEntries}</strong>
            <small>Paid / Unpaid</small>
          </div>
        </article>
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
              onClick={() => setCollectionView(name)}
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
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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

                <div className="collection-filter-section">
                  <span className="collection-filter-label">Cycle</span>
                  <div className="collection-filter-options">
                    {['All', 'Daily', 'Weekly', 'Monthly'].map((item) => (
                      <button
                        type="button"
                        className={`filter-chip ${cycle === item ? 'active' : ''}`}
                        key={item}
                        onClick={() => setCycle(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="collection-filter-section">
                  <span className="collection-filter-label">Status</span>
                  <div className="collection-filter-options">
                    {['All', 'Unpaid', 'Partial', 'Pending', 'Paid', 'Overdue'].map((item) => (
                      <button
                        type="button"
                        className={`filter-chip ${statusFilter === item ? 'active' : ''}`}
                        key={item}
                        onClick={() => setStatusFilter(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="collection-filter-actions">
                  <button
                    type="button"
                    className="collection-filter-reset"
                    onClick={() => { setCycle('All'); setStatusFilter('All'); }}
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
          {collectionView === 'Today' && 'Collections due today, including entries already paid today.'}
          {collectionView === 'Overdue' && 'Previous unpaid and partial installments are grouped into one row per customer loan.'}
          {collectionView === 'Upcoming' && 'Only the next unpaid installment for each active loan is shown.'}
          {collectionView === 'All' && 'Overdue + today + one next upcoming installment per active loan.'}
        </div>

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table">
            <thead>
              {collectionView === 'Overdue' ? (
                <tr>
                  <th>Customer</th><th>Loan</th><th>Cycle</th><th>Overdue Dues</th><th>Paid</th><th>Pending</th><th>Outstanding</th><th>Fine</th><th>Oldest Due</th><th>Status</th><th>Action</th>
                </tr>
              ) : (
                <tr>
                  <th>Customer</th><th>Loan</th><th>Cycle</th><th>Due</th><th>Paid</th><th>Balance</th><th>Fine</th><th>Date</th><th>Status</th><th>Action</th>
                </tr>
              )}
            </thead>
            <tbody>
              {displayRows.map((item) => {
                const displayStatus = getDisplayStatus(item, today);
                const balance = balanceOf(item);
                const isFuture = item.date > today;
                const loanClosed = isLoanClosed(item);
                const currentLoan = loanForItem(item);
                const outstanding = item.groupedOverdue
                  ? Number(item.loanOutstanding || currentLoan?.outstanding || 0)
                  : Number(currentLoan?.outstanding || 0);
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="row-title">
                        <span className="row-avatar">{item.customerName.charAt(0)}</span>
                        <div><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong><small>{item.customerId}</small></div>
                      </div>
                    </td>
                    <td>{item.loanId}</td>
                    <td><span className="soft-chip blue">{item.cycle}</span></td>
                    {collectionView === 'Overdue' ? (
                      <>
                        <td>
                          <strong>{item.overdueCount || 1}</strong>
                          <small style={{ display: 'block', marginTop: 3 }}>
                            {formatCurrency(item.dueAmount)}
                          </small>
                        </td>
                        <td>{formatCurrency(item.loanPaid || 0)}</td>
                        <td><strong>{formatCurrency(balance)}</strong></td>
                        <td><strong>{formatCurrency(outstanding)}</strong></td>
                        <td>{formatCurrency(item.fine)}</td>
                        <td>{formatDate(item.firstOverdueDate || item.date)}</td>
                        <td><StatusBadge status="Overdue" /></td>
                      </>
                    ) : (
                      <>
                        <td>{formatCurrency(item.dueAmount)}</td>
                        <td>{formatCurrency(item.paidAmount)}</td>
                        <td><strong>{formatCurrency(balance)}</strong></td>
                        <td>{formatCurrency(item.fine)}</td>
                        <td>{formatDate(item.date)}</td>
                        <td><StatusBadge status={displayStatus} /></td>
                      </>
                    )}
                    <td>
                      <div className="collection-row-actions">
                        {isFuture && (
                          <button type="button" className="collection-schedule-button" onClick={() => setScheduleLoanId(item.loanId)}>
                            <CalendarDays size={14} /> Schedule
                          </button>
                        )}
                        {hasPermission('collections.collect') && (
                          <ActionButton
                            tone={loanClosed ? 'secondary' : (displayStatus === 'Paid' ? 'secondary' : 'success')}
                            icon={HandCoins}
                            onClick={() => !loanClosed && openPay(item)}
                            disabled={loanClosed}
                            className={loanClosed ? 'collection-closed-action' : ''}
                            title={loanClosed ? 'Loan closed — no additional payment allowed' : actionLabel(item)}
                          >
                            {actionLabel(item)}
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={collectionView === 'Overdue' ? 11 : 10}>
                    <div className="collection-empty-state">
                      <CalendarDays size={22} />
                      <strong>{emptyMessage}</strong>
                      <span>Try another view or adjust the filters.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-data-list">
          {displayRows.map((item) => {
            const displayStatus = getDisplayStatus(item, today);
            const balance = balanceOf(item);
            const isFuture = item.date > today;
            const loanClosed = isLoanClosed(item);
            const currentLoan = loanForItem(item);
            const outstanding = item.groupedOverdue
              ? Number(item.loanOutstanding || currentLoan?.outstanding || 0)
              : Number(currentLoan?.outstanding || 0);
            return (
              <article className="mobile-data-card" key={item.id}>
                <div className="mobile-data-top">
                  <div className="row-title">
                    <span className="row-avatar">{item.customerName.charAt(0)}</span>
                    <div><strong><CustomerProfileLink customerId={item.customerId}>{item.customerName}</CustomerProfileLink></strong><small>{item.customerId} · {item.cycle}</small></div>
                  </div>
                  <StatusBadge status={collectionView === 'Overdue' ? 'Overdue' : displayStatus} />
                </div>

                {collectionView === 'Overdue' ? (
                  <>
                    <div className="collection-mobile-date">
                      <CalendarDays size={14} />
                      {item.overdueCount || 1} overdue due{Number(item.overdueCount || 1) > 1 ? 's' : ''}
                      {' · '}Oldest {formatDate(item.firstOverdueDate || item.date)}
                    </div>
                    <div className="mobile-data-meta">
                      <div><span>Paid</span><strong>{formatCurrency(item.loanPaid || 0)}</strong></div>
                      <div><span>Pending</span><strong>{formatCurrency(balance)}</strong></div>
                      <div><span>Outstanding</span><strong>{formatCurrency(outstanding)}</strong></div>
                      <div><span>Fine</span><strong>{formatCurrency(item.fine)}</strong></div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="collection-mobile-date"><CalendarDays size={14} /> {formatDate(item.date)}</div>
                    <div className="mobile-data-meta">
                      <div><span>Due</span><strong>{formatCurrency(item.dueAmount)}</strong></div>
                      <div><span>Paid</span><strong>{formatCurrency(item.paidAmount)}</strong></div>
                      <div><span>Pending</span><strong>{formatCurrency(balance)}</strong></div>
                      <div><span>Fine</span><strong>{formatCurrency(item.fine)}</strong></div>
                    </div>
                  </>
                )}
                <div className="collection-mobile-action">
                  {isFuture && (
                    <button type="button" className="collection-schedule-button" onClick={() => setScheduleLoanId(item.loanId)}>
                      <CalendarDays size={14} /> Schedule
                    </button>
                  )}
                  {hasPermission('collections.collect') && (
                    <ActionButton
                      tone={loanClosed ? 'secondary' : 'success'}
                      icon={HandCoins}
                      onClick={() => !loanClosed && openPay(item)}
                      disabled={loanClosed}
                      className={loanClosed ? 'collection-closed-action' : ''}
                      title={loanClosed ? 'Loan closed — no additional payment allowed' : actionLabel(item)}
                    >
                      {actionLabel(item)}
                    </ActionButton>
                  )}
                </div>
              </article>
            );
          })}
          {displayRows.length === 0 && (
            <div className="collection-empty-state mobile">
              <CalendarDays size={22} />
              <strong>{emptyMessage}</strong>
              <span>Try another view or adjust the filters.</span>
            </div>
          )}
        </div>
      </section>

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
