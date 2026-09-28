import { toInputDate } from './finance';

/*
 * CREDNIVO FINE RULE (same for Daily, Weekly and Monthly)
 * -------------------------------------------------------
 *   Fine = pending days × (fine amount ÷ cycle days)
 *
 *   cycle days: Daily = 1, Weekly = 7, Monthly = 30
 *
 * - Only the CURRENT unpaid period counts: pending days run from the oldest
 *   due that is still unpaid today, up to yesterday (today is not counted —
 *   today's fine is added tomorrow).
 * - It counts days, not installments: several unpaid dues at the same time
 *   do not multiply the fine.
 * - Dues that were paid late are finished: their late days add no fine.
 *   Dues settled by a fine-only payment ("Fine" status) are finished too.
 * - Fines already paid during the current unpaid period are subtracted.
 *   Fines paid for earlier (already finished) periods are not.
 *
 * Example (weekly loan, fine ₹500): oldest unpaid due 19-09-2026, today
 * 28-09-2026 → pending days 20–27 Sept = 8 → 500 ÷ 7 × 8 = ₹571.
 */

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function fineCycleDays(loan) {
  const cycle = String(loan?.cycle || '').trim().toLowerCase();
  if (cycle === 'weekly') return 7;
  if (cycle === 'monthly') return 30;
  return 1;
}

function dayNumber(dateKey) {
  const time = new Date(`${String(dateKey).slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isNaN(time) ? null : Math.round(time / 86400000);
}

const isStatus = (entry, status) => String(entry?.status || '').trim().toLowerCase() === status;

/**
 * Replays the loan's collections in date order the same way the backend
 * applies them (oldest due on/before the payment date first, then later dues)
 * and returns, per schedule row, the date it was last paid and whether it is
 * fully settled: Map(entryId -> { paidDate, settledDate }).
 */
export function scheduleSettlement(loan, collectionEntries, paymentsForLoan) {
  const rows = (collectionEntries || [])
    .filter((entry) => !isStatus(entry, 'cancelled'))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const result = new Map(rows.map((entry) => [entry.id, { paidDate: null, settledDate: null }]));
  const filled = new Map(rows.map((entry) => [entry.id, 0]));
  const io = loan?.loanType === 'IO';

  const loanPayments = [...(paymentsForLoan || [])]
    .filter((p) => p.type === 'Collection' && p.direction === 'in')
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id || '').localeCompare(String(b.id || '')));

  loanPayments.forEach((payment) => {
    const payDate = String(payment.date || '').slice(0, 10);
    let credit = numberValue(io ? payment.interestPaid : payment.collectionAmount);
    const fine = numberValue(payment.fineAmount);

    // Fine-only payment settles the next "Fine" row on this date.
    if (!io && credit <= 0 && fine > 0) {
      const fineRow = rows.find((entry) => isStatus(entry, 'fine') && !result.get(entry.id).settledDate);
      if (fineRow) result.set(fineRow.id, { paidDate: payDate, settledDate: payDate });
      return;
    }

    const open = rows
      .filter((entry) => !isStatus(entry, 'fine') && (filled.get(entry.id) || 0) < numberValue(entry.dueAmount))
      .sort((a, b) => {
        const aLater = String(a.date) > payDate ? 1 : 0;
        const bLater = String(b.date) > payDate ? 1 : 0;
        return aLater - bLater || String(a.date).localeCompare(String(b.date));
      });
    for (const entry of open) {
      if (credit <= 0) break;
      const due = numberValue(entry.dueAmount);
      const room = due - (filled.get(entry.id) || 0);
      const applied = Math.min(room, credit);
      if (applied <= 0) continue;
      const total = (filled.get(entry.id) || 0) + applied;
      filled.set(entry.id, total);
      result.set(entry.id, { paidDate: payDate, settledDate: total >= due - 0.005 ? payDate : null });
      credit -= applied;
    }
  });

  // Rows already fully paid per the server but not matched above (older data).
  rows.forEach((entry) => {
    const info = result.get(entry.id);
    if (info.settledDate) return;
    const due = numberValue(entry.dueAmount);
    if (!isStatus(entry, 'fine') && due > 0 && numberValue(entry.paidAmount) >= due) {
      result.set(entry.id, { paidDate: info.paidDate, settledDate: info.paidDate || String(entry.date).slice(0, 10) });
    }
  });
  return result;
}

const isOpenDue = (entry, today) => {
  if (isStatus(entry, 'cancelled') || isStatus(entry, 'fine') || isStatus(entry, 'paid')) return false;
  const dueDate = String(entry?.date || '').slice(0, 10);
  if (!dueDate || dueDate >= today) return false; // due today/future: no fine yet
  return numberValue(entry.dueAmount) - numberValue(entry.paidAmount) > 0.005;
};

/** Oldest due date that is still unpaid (before today), or null. */
export function oldestUnpaidDueDate(collectionEntries, today = toInputDate()) {
  let oldest = null;
  (collectionEntries || []).forEach((entry) => {
    if (!isOpenDue(entry, today)) return;
    const dueDate = String(entry.date).slice(0, 10);
    if (!oldest || dueDate < oldest) oldest = dueDate;
  });
  return oldest;
}

/** Pending days in the current unpaid period, not counting today. */
export function countPendingDays(loan, collectionEntries, paymentsForLoan, today = toInputDate()) {
  const oldest = oldestUnpaidDueDate(collectionEntries, today);
  if (!oldest) return 0;
  const from = dayNumber(oldest);
  const to = dayNumber(today);
  if (from == null || to == null) return 0;
  return Math.max(0, to - from - 1);
}

/** Fine accrued in the current unpaid period: pending days × (fine ÷ cycle days). */
export function calculateLoanAccruedFine(loan, collectionEntries, paymentsForLoan = [], today = toInputDate()) {
  if (!loan?.fineEnabled) return 0;
  const fineRate = numberValue(loan.fineAmount);
  if (fineRate <= 0) return 0;
  const days = countPendingDays(loan, collectionEntries, paymentsForLoan, today);
  if (days < 1) return 0;
  return Math.round(days * (fineRate / fineCycleDays(loan)) * 100) / 100;
}

/** Sum of fine amounts already recorded as paid against a set of payments. */
export function sumFinePaid(paymentsForLoan) {
  return (paymentsForLoan || []).reduce((sum, p) => sum + Math.max(0, numberValue(p.fineAmount)), 0);
}

/**
 * Fine still to collect on the loan: fine accrued in the current unpaid
 * period − fines paid during that period. Never negative.
 */
export function calculateLoanPendingFine(loan, collectionEntries, paymentsForLoan, today = toInputDate()) {
  const accrued = calculateLoanAccruedFine(loan, collectionEntries, paymentsForLoan, today);
  if (accrued <= 0) return 0;
  const oldest = oldestUnpaidDueDate(collectionEntries, today);
  const paidThisPeriod = sumFinePaid((paymentsForLoan || []).filter(
    (p) => String(p.date || '').slice(0, 10) > oldest,
  ));
  return Math.max(0, Math.round((accrued - paidThisPeriod) * 100) / 100);
}

/** Convenience for pop-ups: pending fine for one loan from the global lists. */
export function pendingFineForLoan(loan, allCollections, allPayments, today = toInputDate()) {
  if (!loan) return 0;
  const entries = (allCollections || []).filter((entry) => entry.loanId === loan.id);
  const loanPayments = (allPayments || []).filter((p) => p.loanId === loan.id);
  return calculateLoanPendingFine(loan, entries, loanPayments, today);
}
