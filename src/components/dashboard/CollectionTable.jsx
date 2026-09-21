import { ArrowRight, CalendarDays, ChevronDown, Download, FileSpreadsheet, FileText, HandCoins, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, toInputDate } from '../../utils/finance';
import { keyOf, loanIdentityKeys, isPrecloseMarker } from '../../utils/loanIdentity';
import { exportTodayCollectionPdf, exportTodayCollectionXlsx } from '../../utils/todaysCollectionExport';
import IconButton from '../common/IconButton';
import CustomerProfileLink from '../common/CustomerProfileLink';
import RecordLoanPaymentModal from '../payments/RecordLoanPaymentModal';
import StatusBadge from '../common/StatusBadge';
import './CollectionTable.css';
import CustomerAvatar from '../common/CustomerAvatar';


const COLLECTION_CYCLES = ['Daily', 'Weekly', 'Monthly'];

function rowLoanIdentityKeys(row) {
  return [
    row?.loanId,
    row?.loanCode,
    row?.loanDbId,
    row?.dbLoanId,
    row?.loan?.id,
    row?.loan?.loanId,
    row?.loan?.loanCode,
  ].map(keyOf).filter(Boolean);
}

function matchesLoanKeys(item, keySet) {
  return rowLoanIdentityKeys(item).some((key) => keySet.has(key));
}

export default function CollectionTable() {
  const [paying, setPaying] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const { customers, collections, loans, payments, rescheduleCollection, company } = useCrednivo();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = toInputDate();

  const customerPhotoById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.photo || ''])),
    [customers],
  );

  const customerPhoneById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.mobile || ''])),
    [customers],
  );

  // A preclosed loan must disappear from Today's Collection immediately.
  // Detect it from both the current loan record and any PRE-CLOSE transaction
  // so older schedules cannot remain visible after settlement.
  const preclosedLoanKeys = useMemo(() => {
    const keys = new Set();

    (loans || []).forEach((loan) => {
      const status = String(loan?.status || '').trim();
      const rawStatus = String(loan?.rawStatus || '').trim();
      const closeType = String(loan?.closeType || '').trim();

      const preclosed =
        Boolean(loan?.wasPreclosed || loan?.preclosed) ||
        isPrecloseMarker(rawStatus) ||
        isPrecloseMarker(status) ||
        isPrecloseMarker(closeType) ||
        Boolean(loan?.preclosedAt);

      if (!preclosed) return;
      loanIdentityKeys(loan).forEach((key) => keys.add(key));
    });

    (payments || []).forEach((payment) => {
      const preclosePayment = [
        payment?.type,
        payment?.rawType,
        payment?.transactionType,
        payment?.paymentType,
        payment?.closeType,
      ].some(isPrecloseMarker);

      if (!preclosePayment) return;
      rowLoanIdentityKeys(payment).forEach((key) => keys.add(key));
    });

    return keys;
  }, [loans, payments]);

  // Infer early/preclose settlement even when the backend exposes only
  // generic "Closed": early settlement cancels future schedule rows.
  const earlyClosedLoanKeys = useMemo(() => {
    const keys = new Set();

    (loans || []).forEach((loan) => {
      const status = String(loan?.status || '').trim().toUpperCase();
      const rawStatus = String(loan?.rawStatus || '').trim().toUpperCase();
      const closed =
        status === 'CLOSED' ||
        rawStatus === 'CLOSED' ||
        isPrecloseMarker(status) ||
        isPrecloseMarker(rawStatus) ||
        Number(loan?.outstanding) <= 0;

      if (!closed) return;

      const loanKeys = new Set(loanIdentityKeys(loan));
      const hasCancelledFuture = (collections || []).some((entry) => {
        if (!matchesLoanKeys(entry, loanKeys)) return false;
        if (!entry?.date || entry.date <= today) return false;

        const entryStatus = String(entry?.status || '')
          .trim()
          .toUpperCase()
          .replace(/[\s_-]+/g, '');

        return entryStatus === 'CANCELLED' || entryStatus === 'CANCELED';
      });

      const hasCancelledInterest = Number(loan?.cancelledInterestAmount || 0) > 0;

      if (hasCancelledFuture || hasCancelledInterest) {
        loanKeys.forEach((key) => keys.add(key));
      }
    });

    return keys;
  }, [loans, collections, today]);

  const excludedClosedLoanKeys = useMemo(() => {
    const keys = new Set(preclosedLoanKeys);
    earlyClosedLoanKeys.forEach((key) => keys.add(key));
    return keys;
  }, [preclosedLoanKeys, earlyClosedLoanKeys]);

  const todayRows = useMemo(
    () => (collections || []).filter((item) => {
      if (item.date !== today) return false;
      if (matchesLoanKeys(item, excludedClosedLoanKeys)) return false;

      const itemKeys = new Set(rowLoanIdentityKeys(item));
      const loan = (loans || []).find((candidate) =>
        loanIdentityKeys(candidate).some((key) => itemKeys.has(key)),
      );

      // Closed/settled loans do not belong in today's active collection list.
      if (!loan) return false;

      const status = String(loan.status || '').trim().toUpperCase();
      if (
        status === 'CLOSED' ||
        isPrecloseMarker(status) ||
        Number(loan.outstanding) <= 0
      ) {
        return false;
      }

      return true;
    }),
    [collections, loans, excludedClosedLoanKeys, today],
  );

  const cycleRows = useMemo(() => Object.fromEntries(
    COLLECTION_CYCLES.map((cycle) => [
      cycle,
      todayRows.filter((item) => item.cycle === cycle && item.status !== 'Paid'),
    ]),
  ), [todayRows]);

  const cycleTotals = useMemo(() => Object.fromEntries(
    COLLECTION_CYCLES.map((cycle) => [
      cycle,
      (cycleRows[cycle] || []).reduce(
        (sum, item) => sum + Math.max(0, Number(item.dueAmount || 0) - Number(item.paidAmount || 0)),
        0,
      ),
    ]),
  ), [cycleRows]);

  const currentWeekDay = useMemo(() => {
    const [year, month, day] = today.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', { weekday: 'long' });
  }, [today]);

  const buildExportPayload = () => ({
    date: today,
    createdBy: user?.displayName || company?.owner || 'Admin',
    company: {
      name: company?.name || user?.companyName || 'Company',
      branch: user?.branch || company?.branch || 'Main Branch',
      logo: company?.logo || '',
    },
    cycleRows,
    phoneById: customerPhoneById,
  });

  const downloadTodayCollections = async (format) => {
    setDownloadOpen(false);
    const payload = buildExportPayload();
    if (format === 'pdf') {
      await exportTodayCollectionPdf(payload);
      return;
    }
    await exportTodayCollectionXlsx(payload);
  };


  const openPay = (row) => {
    const balance = Math.max(0, Number(row.dueAmount || 0) - Number(row.paidAmount || 0));
    const rowKeys = new Set(rowLoanIdentityKeys(row));
    const loan = (loans || []).find((entry) =>
      loanIdentityKeys(entry).some((key) => rowKeys.has(key)),
    );
    if (
      !loan ||
      String(loan.status || '').trim().toUpperCase() === 'CLOSED' ||
      isPrecloseMarker(loan.status) ||
      Number(loan.outstanding) <= 0
    ) return;

    setPaying({
      ...row,
      loan,
      initialPaymentAmount: loan.loanType === 'IO'
        ? (balance || Number(loan.collectionAmount) || Number(loan.interestAmount) || 0)
        : (balance || Number(row.dueAmount) || 0),
      initialFine: row.status === 'Overdue' ? Number(row.fine || 0) : 0,
    });
  };

  const closePay = () => {
    setPaying(null);
  };

  const openReschedule = (row) => {
    if (!row || String(row.status || '').trim().toLowerCase() === 'paid') return;
    setRescheduleError('');
    setRescheduling(row);
    setRescheduleDate(row.date > today ? row.date : '');
  };

  const closeReschedule = () => {
    if (rescheduleSaving) return;
    setRescheduling(null);
    setRescheduleDate('');
    setRescheduleError('');
  };

  const submitReschedule = async () => {
    if (!rescheduling?.id || !rescheduleDate || rescheduleSaving) return;
    setRescheduleSaving(true);
    setRescheduleError('');
    try {
      await rescheduleCollection(rescheduling.id, rescheduleDate);
      closeReschedule();
    } catch (error) {
      setRescheduleError(error?.message || 'Could not reschedule this collection.');
    } finally {
      setRescheduleSaving(false);
    }
  };

  return (
    <section className="collection-card app-card">
      <div className="section-head collection-home-head">
        <h2>Today's Collection</h2>
        <div className="collection-home-head-actions">
          <span className="collection-weekday"><CalendarDays size={15} />{currentWeekDay}</span>
          <div className="collection-download-menu">
            <button
              type="button"
              className="collection-download-button"
              onClick={() => setDownloadOpen((open) => !open)}
              aria-expanded={downloadOpen}
            >
              <Download size={15} /> Download <ChevronDown size={13} className={downloadOpen ? 'open' : ''} />
            </button>
            {downloadOpen && (
              <div className="collection-download-popdown">
                <button type="button" onClick={() => downloadTodayCollections('pdf')}>
                  <FileText size={16} />
                  <span><strong>PDF</strong><small>Professional printable report</small></span>
                </button>
                <button type="button" onClick={() => downloadTodayCollections('xlsx')}>
                  <FileSpreadsheet size={16} />
                  <span><strong>XLSX</strong><small>Excel collection report</small></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="collection-cycle-stack">
        {COLLECTION_CYCLES.map((cycle) => {
          const rows = cycleRows[cycle] || [];
          return (
            <section className="collection-cycle-section" key={cycle}>
              <div className="collection-cycle-heading">
                <h3>{cycle}</h3>
                <div className="collection-cycle-total">
                  <span>Amount to collect</span>
                  <strong>{formatCurrency(cycleTotals[cycle] || 0)}</strong>
                </div>
              </div>

              {rows.length ? (
                <>
                  <div className="collection-table-wrap collection-cycle-table-wrap">
                    <table className="collection-table">
                      <thead>
                        <tr>
                          <th>Customer ID</th>
                          <th>Customer Name</th>
                          <th>Amount to Pay</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const rowKeys = new Set(rowLoanIdentityKeys(row));
                          const loan = (loans || []).find((item) => loanIdentityKeys(item).some((key) => rowKeys.has(key)));
                          const loanClosed = !loan || String(loan.status || '').trim().toUpperCase() === 'CLOSED' || isPrecloseMarker(loan.status) || Number(loan.outstanding) <= 0;
                          return (
                            <tr key={row.id}>
                              <td>{row.customerId}</td>
                              <td><div className="dashboard-customer-cell"><CustomerAvatar className="dashboard-customer-avatar" photo={customerPhotoById[String(row.customerId)]} name={row.customerName} /><CustomerProfileLink customerId={row.customerId}>{row.customerName}</CustomerProfileLink></div></td>
                              <td><strong>{formatCurrency(Math.max(0, Number(row.dueAmount || 0) - Number(row.paidAmount || 0)))}</strong></td>
                              <td><StatusBadge status={row.status} /></td>
                              <td>
                                <div className="dashboard-collection-actions">
                                  <button className={`dashboard-pay-button ${loanClosed ? 'closed' : ''}`} onClick={() => !loanClosed && openPay(row)} disabled={loanClosed} title={loanClosed ? 'Loan closed — no additional payment allowed' : `Pay ${row.customerName}`}>
                                    <HandCoins size={15} /><span>{loanClosed ? 'Closed' : 'Pay'}</span>
                                  </button>
                                  <button type="button" className="dashboard-reschedule-button" onClick={() => openReschedule(row)} disabled={loanClosed} title={loanClosed ? 'Loan closed' : `Reschedule ${row.customerName}`}>
                                    <CalendarDays size={15} /><span>Reschedule</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mobile-collection-list collection-cycle-mobile-list">
                    {rows.map((row) => {
                      const rowKeys = new Set(rowLoanIdentityKeys(row));
                      const loan = (loans || []).find((item) => loanIdentityKeys(item).some((key) => rowKeys.has(key)));
                      const loanClosed = !loan || String(loan.status || '').trim().toUpperCase() === 'CLOSED' || isPrecloseMarker(loan.status) || Number(loan.outstanding) <= 0;
                      return (
                        <article className="mobile-collection-row" key={row.id}>
                          <CustomerAvatar className="dashboard-customer-avatar" photo={customerPhotoById[String(row.customerId)]} name={row.customerName} />
                          <div className="mobile-row-identity"><strong><CustomerProfileLink customerId={row.customerId}>{row.customerName}</CustomerProfileLink></strong><span>{row.customerId}</span></div>
                          <div className="mobile-row-amount"><b>{formatCurrency(Math.max(0, Number(row.dueAmount || 0) - Number(row.paidAmount || 0)))}</b><StatusBadge status={row.status} /></div>
                          <div className="mobile-collection-actions">
                            <button className={`dashboard-pay-button compact icon-only ${loanClosed ? 'closed' : ''}`} onClick={() => !loanClosed && openPay(row)} disabled={loanClosed} aria-label={loanClosed ? `${row.customerName} loan closed` : `Pay ${row.customerName}`} title={loanClosed ? 'Loan closed' : `Pay ${row.customerName}`}><HandCoins size={15} /></button>
                            <button type="button" className="dashboard-reschedule-button icon-only" onClick={() => openReschedule(row)} disabled={loanClosed} aria-label={`Reschedule ${row.customerName}`} title="Reschedule"><CalendarDays size={16} /></button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="dashboard-empty collection-cycle-empty">No {cycle.toLowerCase()} customers due today.</div>
              )}
            </section>
          );
        })}
      </div>

      <button className="view-collections-button" onClick={() => navigate('/collection')}>
        View All Today's Collections <ArrowRight size={15} />
      </button>

      {rescheduling && (
        <div className="dashboard-reschedule-backdrop" onMouseDown={closeReschedule}>
          <div className="dashboard-reschedule-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dashboard-reschedule-head">
              <div>
                <strong>Reschedule Collection</strong>
                <span>{rescheduling.customerName} · {rescheduling.cycle}</span>
              </div>
              <button type="button" className="dashboard-reschedule-close" onClick={closeReschedule} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="dashboard-reschedule-summary">
              <div><span>Current date</span><strong>{rescheduling.date}</strong></div>
              <div><span>Amount to pay</span><strong>{formatCurrency(Math.max(0, Number(rescheduling.dueAmount || 0) - Number(rescheduling.paidAmount || 0)))}</strong></div>
            </div>

            <label className="dashboard-reschedule-field">
              <span>New collection date</span>
              <input type="date" min={today} value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
            </label>

            {rescheduleError && <div className="dashboard-reschedule-error">{rescheduleError}</div>}

            <div className="dashboard-reschedule-actions">
              <button type="button" className="secondary" onClick={closeReschedule} disabled={rescheduleSaving}>Cancel</button>
              <button type="button" className="primary" onClick={submitReschedule} disabled={!rescheduleDate || rescheduleSaving}>
                {rescheduleSaving ? 'Saving...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      <RecordLoanPaymentModal
        open={Boolean(paying)}
        loan={paying?.loan}
        customerName={paying?.customerName}
        customerId={paying?.customerId}
        scheduledAmount={paying?.dueAmount}
        scheduleDate={paying?.date}
        initialAmount={paying?.initialPaymentAmount}
        initialFine={paying?.initialFine}
        title="Record Collection"
        onClose={closePay}
      />
    </section>
  );
}
