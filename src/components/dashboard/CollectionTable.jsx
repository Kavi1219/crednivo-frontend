import { ArrowRight, Check, Eye, HandCoins, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, toInputDate } from '../../utils/finance';
import IconButton from '../common/IconButton';
import StatusBadge from '../common/StatusBadge';
import './CollectionTable.css';

const COLLECTION_TABS = ['Daily', 'Weekly', 'Monthly', 'Collected Today'];

export default function CollectionTable() {
  const [tab, setTab] = useState('Daily');
  const [paying, setPaying] = useState(null);
  const [amount, setAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('0');
  const [fine, setFine] = useState('0');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentError, setPaymentError] = useState('');
  const { collections, loans, recordLoanPayment } = useCrednivo();
  const navigate = useNavigate();
  const today = toInputDate();

  const todayRows = useMemo(
    () => collections.filter((item) => item.date === today),
    [collections, today],
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
    const loan = loans.find((entry) => entry.id === row.loanId);
    if (!loan || loan.status === 'Closed' || Number(loan.outstanding) <= 0) {
      setPaymentError('This loan is closed. No additional payment can be recorded.');
      return;
    }
    setPaying({ ...row, loan });
    if (loan?.loanType === 'IO') {
      setAmount('');
      setInterestAmount(String(balance || Number(loan.collectionAmount) || Number(loan.interestAmount) || 0));
      setPrincipalAmount('0');
    } else {
      setAmount(String(balance || row.dueAmount || 0));
      setInterestAmount('');
      setPrincipalAmount('0');
    }
    setFine(String(row.status === 'Overdue' ? row.fine || 0 : 0));
    setPaymentMode('Cash');
  };

  const closePay = () => {
    setPaying(null);
    setAmount('');
    setInterestAmount('');
    setPrincipalAmount('0');
    setFine('0');
    setPaymentMode('Cash');
    setPaymentError('');
  };

  const submitPayment = async () => {
    if (!paying) return;
    const isIo = paying.loan?.loanType === 'IO';
    const total = isIo ? Number(interestAmount || 0) + Number(principalAmount || 0) : Number(amount || 0);
    if (total <= 0) return;
    setPaymentError('');
    try {
      const saved = isIo
        ? await recordLoanPayment(paying.loanId, {
            interestAmount,
            principalAmount,
            fine,
            paymentDate: toInputDate(),
            paymentMode,
          })
        : await recordLoanPayment(paying.loanId, {
            amount,
            fine,
            paymentDate: toInputDate(),
            paymentMode,
          });
      if (saved) closePay();
    } catch (apiError) {
      setPaymentError(apiError?.message || 'Could not save the payment to the database.');
    }
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
                const loan = loans.find((item) => item.id === row.loanId);
                const loanClosed = !loan || loan.status === 'Closed' || Number(loan.outstanding) <= 0;
                return (
                  <tr key={row.id}>
                    <td>{row.customerId}</td>
                    <td>{row.customerName}</td>
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
            const loan = loans.find((item) => item.id === row.loanId);
            const loanClosed = !loan || loan.status === 'Closed' || Number(loan.outstanding) <= 0;
            return (
              <article className="mobile-collection-row" key={row.id}>
                <div className="mobile-row-top">
                  <div><strong>{row.customerName}</strong><span>{row.customerId}</span></div>
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

      {paying && (
        <div className="dashboard-pay-backdrop" onMouseDown={closePay}>
          <div className="dashboard-pay-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dashboard-pay-head">
              <div>
                <strong>Record Payment</strong>
                <span>{paying.customerName} · {paying.customerId}</span>
              </div>
              <IconButton label="Close payment" size="sm" onClick={closePay}><X size={17} /></IconButton>
            </div>

            <div className="dashboard-pay-due">
              <span>{paying.loan?.loanType === 'IO' ? 'Interest due today' : "Today's due"}</span>
              <strong>{formatCurrency(paying.dueAmount)}</strong>
              <small>{paying.loan?.loanType === 'IO' ? `Principal outstanding ${formatCurrency(paying.loan?.outstanding)}. Interest does not reduce principal.` : 'Partial payment and overpayment are allowed. Fine stays separate.'}</small>
            </div>

            <div className="dashboard-pay-fields">
              {paying.loan?.loanType === 'IO' ? <>
                <label>
                  <span>Interest Paid</span>
                  <input autoFocus type="number" min="0" value={interestAmount} onChange={(event) => setInterestAmount(event.target.value)} />
                </label>
                <label>
                  <span>Principal Paid</span>
                  <input type="number" min="0" max={Number(paying.loan?.outstanding) || undefined} value={principalAmount} onChange={(event) => setPrincipalAmount(event.target.value)} />
                </label>
              </> : <label>
                <span>Amount Paid</span>
                <input autoFocus type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>}
              <label>
                <span>Fine Paid</span>
                <input type="number" min="0" value={fine} onChange={(event) => setFine(event.target.value)} />
              </label>
              <label>
                <span>Payment Mode</span>
                <select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
                  <option>Cash</option><option>UPI</option><option>Bank</option><option>Cheque</option><option>Other</option>
                </select>
              </label>
            </div>

            {paymentError && <div className="form-error">{paymentError}</div>}

            <button className="dashboard-save-payment" onClick={submitPayment} disabled={paying.loan?.loanType === 'IO' ? (Number(interestAmount || 0) + Number(principalAmount || 0) <= 0) : Number(amount) <= 0}>
              <Check size={17} />
              <span>Save Payment</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
