import { ArrowRight, Eye, HandCoins } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, toInputDate } from '../../utils/finance';
import IconButton from '../common/IconButton';
import CustomerProfileLink from '../common/CustomerProfileLink';
import RecordLoanPaymentModal from '../payments/RecordLoanPaymentModal';
import StatusBadge from '../common/StatusBadge';
import './CollectionTable.css';
import CustomerAvatar from '../common/CustomerAvatar';


const COLLECTION_TABS = ['Daily', 'Weekly', 'Monthly', 'Collected Today'];

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

function isPrecloseMarker(value) {
  const marker = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');

  return marker === 'PRECLOSE' || marker === 'PRECLOSED';
}

export default function CollectionTable() {
  const [tab, setTab] = useState('Daily');
  const [paying, setPaying] = useState(null);
  const { customers, collections, loans, payments } = useCrednivo();
  const navigate = useNavigate();
  const today = toInputDate();

  const customerPhotoById = useMemo(
    () => Object.fromEntries((customers || []).map((customer) => [String(customer.id), customer.photo || ''])),
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

  const todayRows = useMemo(
    () => (collections || []).filter((item) => {
      if (item.date !== today) return false;
      if (matchesLoanKeys(item, preclosedLoanKeys)) return false;

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
    [collections, loans, preclosedLoanKeys, today],
  );

  const collectedTodayCount = useMemo(
    () => todayRows.filter((item) => item.status === 'Paid').length,
    [todayRows],
  );

  const rows = useMemo(() => {
    if (tab === 'Collected Today') {
      return todayRows.filter((item) => item.status === 'Paid').slice(0, 5);
    }

    return todayRows
      .filter((item) => item.cycle === tab && item.status !== 'Paid')
      .slice(0, 5);
  }, [todayRows, tab]);

  const isCollectedTab = tab === 'Collected Today';

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

  return (
    <section className="collection-card app-card">
      <div className="section-head">
        <h2>Today's Collection</h2>
        <button onClick={() => navigate('/collection')}>View All <ArrowRight size={15} /></button>
      </div>

      <div className="collection-tabs" role="tablist">
        {COLLECTION_TABS.map((item) => (
          <button
            key={item}
            className={`${tab === item ? 'active' : ''} ${item === 'Collected Today' ? 'collected-tab' : ''}`}
            onClick={() => setTab(item)}
          >
            {item}
            {item === 'Collected Today' && <span className="collection-tab-count">{collectedTodayCount}</span>}
          </button>
        ))}
      </div>

      {rows.length ? <>
        <div className="collection-table-wrap">
          <table className="collection-table">
            <thead>
              <tr>
                <th>Customer ID</th>
                <th>Customer Name</th>
                <th>Cycle</th>
                <th>{isCollectedTab ? 'Amount Paid' : 'Amount to Pay'}</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowKeys = new Set(rowLoanIdentityKeys(row));
                const loan = (loans || []).find((item) =>
                  loanIdentityKeys(item).some((key) => rowKeys.has(key)),
                );
                const loanClosed =
                  !loan ||
                  String(loan.status || '').trim().toUpperCase() === 'CLOSED' ||
                  isPrecloseMarker(loan.status) ||
                  Number(loan.outstanding) <= 0;
                return (
                  <tr key={row.id}>
                    <td>{row.customerId}</td>
                    <td><div className="dashboard-customer-cell"><CustomerAvatar className="dashboard-customer-avatar" photo={customerPhotoById[String(row.customerId)]} name={row.customerName} /><CustomerProfileLink customerId={row.customerId}>{row.customerName}</CustomerProfileLink></div></td>
                    <td><span className="cycle-chip">{row.cycle}</span></td>
                    <td>{formatCurrency(isCollectedTab ? row.paidAmount : Math.max(0, Number(row.dueAmount || 0) - Number(row.paidAmount || 0)))}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      <div className="dashboard-collection-actions">
                        {!isCollectedTab && (
                          <button
                            className={`dashboard-pay-button ${loanClosed ? 'closed' : ''}`}
                            onClick={() => !loanClosed && openPay(row)}
                            disabled={loanClosed}
                            title={loanClosed ? 'Loan closed — no additional payment allowed' : `Pay ${row.customerName}`}
                          >
                            <HandCoins size={15} />
                            <span>{loanClosed ? 'Closed' : 'Pay'}</span>
                          </button>
                        )}
                        <IconButton label={`View ${row.customerName}`} size="sm" onClick={() => navigate(`/customers/${row.customerId}`)}>
                          <Eye size={16} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mobile-collection-list">
          {rows.map((row) => {
            const rowKeys = new Set(rowLoanIdentityKeys(row));
            const loan = (loans || []).find((item) =>
              loanIdentityKeys(item).some((key) => rowKeys.has(key)),
            );
            const loanClosed =
                  !loan ||
                  String(loan.status || '').trim().toUpperCase() === 'CLOSED' ||
                  isPrecloseMarker(loan.status) ||
                  Number(loan.outstanding) <= 0;
            return (
              <article className="mobile-collection-row" key={row.id}>
                <div className="mobile-row-top">
                  <div className="dashboard-mobile-customer"><CustomerAvatar className="dashboard-customer-avatar" photo={customerPhotoById[String(row.customerId)]} name={row.customerName} /><div><strong><CustomerProfileLink customerId={row.customerId}>{row.customerName}</CustomerProfileLink></strong><span>{row.customerId}</span></div></div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mobile-row-bottom">
                  <span><small>Cycle</small><b>{row.cycle}</b></span>
                  <span><small>{isCollectedTab ? 'Paid' : 'Amount'}</small><b>{formatCurrency(isCollectedTab ? row.paidAmount : Math.max(0, Number(row.dueAmount || 0) - Number(row.paidAmount || 0)))}</b></span>
                  <div className="dashboard-collection-actions mobile-actions">
                    {!isCollectedTab && (
                      <button
                        className={`dashboard-pay-button compact ${loanClosed ? 'closed' : ''}`}
                        onClick={() => !loanClosed && openPay(row)}
                        disabled={loanClosed}
                        aria-label={loanClosed ? `${row.customerName} loan closed` : `Pay ${row.customerName}`}
                      >
                        <HandCoins size={15} />
                        <span>{loanClosed ? 'Closed' : 'Pay'}</span>
                      </button>
                    )}
                    <IconButton label={`View ${row.customerName}`} size="sm" onClick={() => navigate(`/customers/${row.customerId}`)}>
                      <Eye size={16} />
                    </IconButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </> : (
        <div className="dashboard-empty">
          {isCollectedTab ? 'No fully paid collections yet today.' : `No unpaid ${tab.toLowerCase()} collections due today.`}
        </div>
      )}

      <button className="view-collections-button" onClick={() => navigate('/collection')}>
        View All Today's Collections <ArrowRight size={15} />
      </button>

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
