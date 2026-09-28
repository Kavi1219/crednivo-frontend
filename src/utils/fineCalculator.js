import { toInputDate } from './finance';

/*
 * CREDNIVO FINE RULE (same for Daily, Weekly and Monthly)
 * -------------------------------------------------------
 *   Fine = number of pending days × (fine amount ÷ cycle days)
 *
 *   cycle days: Daily = 1, Weekly = 7, Monthly = 30
 *
 * - It counts DAYS, not installments. Days when several dues are pending at
 *   the same time are counted once (no double counting).
 * - A day is "pending" when some due from an EARLIER date is still unpaid on
 *   that day. So a due that falls today adds nothing today; its fine starts
 *   from tomorrow.
 * - A due stops adding fine on the day it is fully paid. A due settled by a
 *   fine-only payment ("Fine" status) stops on the day that fine was paid.
 * - Pending fine = fine accrued so far − fines already paid on the loan.
 *
 * Example (weekly loan, fine ₹100): first due 20-07-2026, nothing paid,
 * today 28-09-2026 → 70 pending days → 100 ÷ 7 × 70 = ₹1,000.
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

/** Number of distinct pending days for the loan up to and including today. */
export function countPendingDays(loan, collectionEntries, paymentsForLoan, today = toInputDate()) {
  const todayNo = dayNumber(today);
  if (todayNo == null) return 0;
  const settlement = scheduleSettlement(loan, collectionEntries, paymentsForLoan);
  const intervals = [];
  (collectionEntries || []).forEach((entry) => {
    if (isStatus(entry, 'cancelled')) return;
    const dueNo = dayNumber(entry.date);
    if (dueNo == null || dueNo >= todayNo) return; // due today/future: no fine yet
    const isFineRow = isStatus(entry, 'fine');
    if (!isFineRow && numberValue(entry.dueAmount) <= 0) return;
    const settled = settlement.get(entry.id)?.settledDate;
    const endNo = settled ? Math.min(dayNumber(settled), todayNo) : todayNo;
    // Pending days are the days AFTER the due date up to the settle day.
    if (endNo > dueNo) intervals.push([dueNo + 1, endNo]);
  });
  intervals.sort((a, b) => a[0] - b[0]);
  let days = 0;
  let current = null;
  intervals.forEach(([start, end]) => {
    if (!current || start > current[1] + 1) {
      if (current) days += current[1] - current[0] + 1;
      current = [start, end];
    } else {
      current[1] = Math.max(current[1], end);
    }
  });
  if (current) days += current[1] - current[0] + 1;
  return days;
}

/** Total fine accrued so far: pending days × (fine ÷ cycle days). */
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

/** Fine still to collect on the loan: accrued − already paid. Never negative. */
export function calculateLoanPendingFine(loan, collectionEntries, paymentsForLoan, today = toInputDate()) {
  const accrued = calculateLoanAccruedFine(loan, collectionEntries, paymentsForLoan, today);
  const paid = sumFinePaid(paymentsForLoan);
  return Math.max(0, Math.round((accrued - paid) * 100) / 100);
}

/** Convenience for pop-ups: pending fine for one loan from the global lists. */
export function pendingFineForLoan(loan, allCollections, allPayments, today = toInputDate()) {
  if (!loan) return 0;
  const entries = (allCollections || []).filter((entry) => entry.loanId === loan.id);
  const loanPayments = (allPayments || []).filter((p) => p.loanId === loan.id);
  return calculateLoanPendingFine(loan, entries, loanPayments, today);
}
