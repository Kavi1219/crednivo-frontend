import { Banknote, CalendarDays, Check, Coins, CreditCard, ReceiptText, WalletCards, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './RecordLoanPaymentModal.css';

export default function RecordLoanPaymentModal({
  open,
  loan,
  customerName = '',
  customerId = '',
  scheduledAmount = null,
  scheduleDate = null,
  initialAmount = null,
  initialFine = 0,
  title = 'Record Collection',
  onClose,
  onSaved,
}) {
  const { recordLoanPayment, getIoSettlementPreview } = useCrednivo();
  const { hasPermission } = useAuth();

  const [amount, setAmount] = useState('');
  const [interestAmount, setInterestAmount] = useState('');
  const [principalAmount, setPrincipalAmount] = useState('0');
  const [fine, setFine] = useState('0');
  const [paymentDate, setPaymentDate] = useState(() => toInputDate());
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [ioSettlementPreview, setIoSettlementPreview] = useState(null);
  const [ioSettlementLoading, setIoSettlementLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitLockRef = useRef(false);

  const isIo = loan?.loanType === 'IO';
  const canFine = hasPermission('collections.fine');

  const loadIoSettlementPreview = async (paymentDateValue) => {
    if (!loan || loan.loanType !== 'IO') {
      setIoSettlementPreview(null);
      return null;
    }

    setIoSettlementLoading(true);
    try {
      const preview = await getIoSettlementPreview(loan.id, paymentDateValue);
      setIoSettlementPreview(preview);
      return preview;
    } catch (apiError) {
      setIoSettlementPreview(null);
      setError(apiError?.message || 'Could not calculate the IO settlement amount.');
      return null;
    } finally {
      setIoSettlementLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !loan) return;

    const today = toInputDate();
    const fallbackAmount = Math.min(
      Math.max(0, Number(loan.collectionAmount || 0)),
      Math.max(0, Number(loan.outstanding || 0)),
    );
    const startingAmount = initialAmount === null || initialAmount === undefined
      ? (fallbackAmount || Number(loan.outstanding || 0) || 0)
      : Number(initialAmount || 0);

    setAmount(isIo ? '' : String(startingAmount));
    setInterestAmount(isIo ? String(startingAmount || Number(loan.collectionAmount || loan.interestAmount || 0)) : '');
    setPrincipalAmount('0');
    setFine(String(Number(initialFine || 0)));
    setPaymentDate(today);
    setPaymentMode('Cash');
    setError('');
    setSaving(false);
    submitLockRef.current = false;
    setIoSettlementPreview(null);

    if (isIo) {
      loadIoSettlementPreview(today);
    }
    // Reset only when a new payment session is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loan?.id, initialAmount, initialFine]);

  if (!open || !loan) return null;

  const close = () => {
    if (saving) return;
    onClose?.();
  };

  const applyFullIoSettlement = async () => {
    if (!isIo) return;
    const preview = ioSettlementPreview || await loadIoSettlementPreview(paymentDate);
    if (!preview) return;

    setInterestAmount(String(Number(preview.pendingInterest || 0)));
    setPrincipalAmount(String(Number(preview.principalOutstanding || loan.outstanding || 0)));
  };

  const submit = async () => {
    if (submitLockRef.current || saving) return;

    const normalTotal = isIo
      ? Number(interestAmount || 0) + Number(principalAmount || 0)
      : Number(amount || 0);
    const fineTotal = Number(fine || 0);

    if (normalTotal <= 0 && fineTotal <= 0) {
      setError('Enter an amount paid or a fine amount before saving.');
      return;
    }

    if (!paymentDate) {
      setError('Select the payment date.');
      return;
    }

    if (paymentDate > toInputDate()) {
      setError('Payment date cannot be in the future.');
      return;
    }

    const loanStartDate = loan.startDate || loan.disbursedDate || loan.loanDate || '';
    if (loanStartDate && paymentDate < loanStartDate) {
      setError(`Payment date cannot be before the loan disbursed date (${formatDate(loanStartDate)}).`);
      return;
    }

    submitLockRef.current = true;
    setSaving(true);
    setError('');

    try {
      const saved = isIo
        ? await recordLoanPayment(loan.id, {
            interestAmount,
            principalAmount,
            fine: canFine ? fine : 0,
            paymentDate,
            paymentMode,
          })
        : await recordLoanPayment(loan.id, {
            amount,
            fine: canFine ? fine : 0,
            paymentDate,
            paymentMode,
          });

      if (saved) {
        onSaved?.(saved);
        onClose?.();
      }
    } catch (apiError) {
      setError(apiError?.message || 'Could not save the collection to the database.');
    } finally {
      submitLockRef.current = false;
      setSaving(false);
    }
  };

  const displayAmount = scheduledAmount === null || scheduledAmount === undefined
    ? Number(loan.collectionAmount || 0)
    : Number(scheduledAmount || 0);

  const subtitle = [
    loan.id,
    loan.cycle,
  ].filter(Boolean).join(' · ');

  const displayCustomerName = customerName || customerId || title;
  const customerInitials = String(displayCustomerName || 'C')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const isEarlyPayment = Boolean(scheduleDate && scheduleDate > toInputDate());

  return (
    <div className="record-payment-backdrop" onMouseDown={close}>
      {error && (
        <div className="record-payment-error-toast" role="alert" aria-live="assertive">
          <span className="record-payment-error-icon">!</span>
          <span>{error}</span>
        </div>
      )}
      <section className="record-payment-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="record-payment-head">
          <div className="record-payment-customer">
            <div className="record-payment-avatar" aria-hidden="true">{customerInitials}</div>
            <div>
              <h2>{displayCustomerName}</h2>
              <p>{subtitle}</p>
            </div>
          </div>
          <button type="button" className="record-payment-close" onClick={close} disabled={saving} title="Close">
            <X size={22} />
          </button>
        </header>

        <div className="record-payment-body">
          <div className="record-payment-summary">
            <div className="record-payment-summary-card record-payment-summary-card-collection">
              <div className="record-payment-summary-icon"><Coins size={22} /></div>
              <div>
                <span>{isIo ? 'Interest / Cycle' : 'Collection / Cycle'}</span>
                <strong>{formatCurrency(displayAmount)}</strong>
              </div>
            </div>
            <div className="record-payment-summary-card record-payment-summary-card-outstanding">
              <div className="record-payment-summary-icon"><WalletCards size={22} /></div>
              <div>
                <span>{isIo ? 'Principal Outstanding' : 'Outstanding'}</span>
                <strong>{formatCurrency(loan.outstanding)}</strong>
              </div>
            </div>
          </div>

          <div className="record-payment-info-note">
            <span className="record-payment-info-icon">i</span>
            <span>{isIo
              ? 'Interest and principal are separate. Fine can also be collected by itself.'
              : 'Partial payment, overpayment, and fine-only payment are allowed. Fine is recorded separately.'}</span>
          </div>
          {isEarlyPayment && (
            <div className="record-payment-schedule-note">
              Scheduled for {formatDate(scheduleDate)}. Use the actual date the money was received.
            </div>
          )}

          <div className="record-payment-fields">
            <label className="record-payment-date">
              <span className="record-payment-label"><CalendarDays size={16} /> Payment Date</span>
              <input
                type="date"
                min={loan.startDate || undefined}
                max={toInputDate()}
                value={paymentDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setPaymentDate(value);
                  setError('');
                  if (isIo) loadIoSettlementPreview(value);
                }}
              />
              <small>Use the actual received date.</small>
            </label>

            {isIo ? (
              <>
                <label>
                  <span className="record-payment-label"><Banknote size={16} /> Interest Paid</span>
                  <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.]?[0-9]*"
                    value={interestAmount}
                    onChange={(event) => {
                    setInterestAmount(event.target.value);
                    setError('');
                  }}
                  />
                </label>

                <label>
                  <span className="record-payment-label"><Coins size={16} /> Principal Paid</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.]?[0-9]*"
                    value={principalAmount}
                    onChange={(event) => {
                    setPrincipalAmount(event.target.value);
                    setError('');
                  }}
                  />
                  <small>Maximum principal: {formatCurrency(loan.outstanding)}</small>
                </label>

                {Number(principalAmount || 0) > 0
                  && Number(principalAmount || 0) < Number(loan.outstanding || 0) && (
                  <div className="record-payment-reprice">
                    <div>
                      <span>Remaining Principal</span>
                      <strong>{formatCurrency(Math.max(0, Number(loan.outstanding || 0) - Number(principalAmount || 0)))}</strong>
                    </div>
                    <div>
                      <span>Next Interest / Cycle</span>
                      <strong>
                        {formatCurrency(
                          Math.max(0, Number(loan.outstanding || 0) - Number(principalAmount || 0))
                          * (Number(loan.interestRate || 0) / 100),
                        )}
                      </strong>
                    </div>
                    <small>Only future cycles use the new interest. Already-due interest stays unchanged.</small>
                  </div>
                )}
              </>
            ) : (
              <label>
                <span className="record-payment-label"><Banknote size={16} /> Amount Paid</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError('');
                  }}
                />
                <small>Set this to 0 or leave it blank when collecting only a fine.</small>
              </label>
            )}

            {canFine && (
              <label>
                <span className="record-payment-label"><ReceiptText size={16} /> Fine Paid</span>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.]?[0-9]*"
                  value={fine}
                  onChange={(event) => {
                    setFine(event.target.value);
                    setError('');
                  }}
                />
              </label>
            )}

            <label>
              <span className="record-payment-label"><CreditCard size={16} /> Payment Mode</span>
              <select
                value={paymentMode}
                onChange={(event) => {
                  setPaymentMode(event.target.value);
                  setError('');
                }}
              >
                <option>Cash</option>
                <option>UPI</option>
                <option>Bank</option>
                <option>Cheque</option>
                <option>Other</option>
              </select>
            </label>
          </div>

          {isIo && (
            <div className="record-payment-settlement">
              <div className="record-payment-settlement-head">
                <div>
                  <strong>Full Principal Settlement</strong>
                  <small>Principal + only interest already due/pending. Future interest is cancelled.</small>
                </div>
                <button type="button" onClick={applyFullIoSettlement} disabled={ioSettlementLoading || saving}>
                  {ioSettlementLoading ? 'Calculating…' : 'Use Settlement Amount'}
                </button>
              </div>

              {ioSettlementPreview && (
                <div className="record-payment-settlement-grid">
                  <div>
                    <span>Principal</span>
                    <strong>{formatCurrency(ioSettlementPreview.principalOutstanding)}</strong>
                  </div>
                  <div>
                    <span>Pending Interest</span>
                    <strong>{formatCurrency(ioSettlementPreview.pendingInterest)}</strong>
                    <small>{ioSettlementPreview.pendingInterestCycles || 0} cycle(s)</small>
                  </div>
                  <div>
                    <span>Amount to Close</span>
                    <strong>{formatCurrency(ioSettlementPreview.settlementAmount)}</strong>
                  </div>
                  <div>
                    <span>Future Interest Cancelled</span>
                    <strong>{formatCurrency(ioSettlementPreview.futureInterestCancelled)}</strong>
                    <small>{ioSettlementPreview.futureInterestCyclesCancelled || 0} cycle(s)</small>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="record-payment-footer">
          <button type="button" className="record-payment-cancel" onClick={close} disabled={saving}>
            <X size={17} />
            <span>Cancel</span>
          </button>
          <button type="button" className="record-payment-save" onClick={submit} disabled={saving}>
            <Check size={18} />
            <span>{saving ? 'Saving…' : 'Save Collection'}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
