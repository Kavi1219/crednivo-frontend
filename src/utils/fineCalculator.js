import { toInputDate } from './finance';

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// How many days one fine-rate period covers, by the loan's own cycle. A
// Weekly loan's fineAmount is "per week" (/7); a Monthly loan's is "per
// month" (/30, a flat approximation, not the exact days in that calendar
// month); a Daily loan's fineAmount already IS the per-day amount (/1).
function cycleDays(loan) {
  const cycle = String(loan?.cycle || '').trim().toLowerCase();
  if (cycle === 'weekly') return 7;
  if (cycle === 'monthly') return 30;
  return 1;
}

function daysBetween(dateKey, today) {
  const from = new Date(`${dateKey}T00:00:00`);
  const to = new Date(`${today}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.floor((to - from) / 86400000);
}

/**
 * The earliest due date that's currently unpaid (date has arrived, balance
 * still > 0) for one loan — the single starting point the whole pending
 * period is measured from. Returns null if nothing is currently pending.
 */
function oldestPendingDueDate(collectionEntries, today) {
  let oldest = null;
  (collectionEntries || []).forEach((item) => {
    const dueDate = String(item.date || '').slice(0, 10);
    if (!dueDate || dueDate > today) return;
    const balance = Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount));
    if (balance <= 0) return;
    if (!oldest || dueDate < oldest) oldest = dueDate;
  });
  return oldest;
}

/**
 * Total fine accrued for one loan: ONE continuous calculation, not summed
 * per-due (summing per-due would double-count overlapping days across
 * multiple pending installments). Finds the oldest currently-unpaid due
 * date, counts days from there to today, and multiplies by the loan's
 * daily rate (fineAmount / cycle length). No grace period, no cap — keeps
 * growing for as long as the loan stays pending, even across many months.
 */
export function calculateLoanAccruedFine(loan, collectionEntries, today = toInputDate()) {
  if (!loan?.fineEnabled) return 0;
  const fineRate = numberValue(loan.fineAmount);
  if (fineRate <= 0) return 0;

  const oldest = oldestPendingDueDate(collectionEntries, today);
  if (!oldest) return 0;

  const daysPending = daysBetween(oldest, today);
  if (daysPending < 1) return 0;

  const dailyRate = fineRate / cycleDays(loan);
  return Math.round(daysPending * dailyRate * 100) / 100;
}

/** Sum of fine amounts already recorded as paid against a set of payments. */
export function sumFinePaid(paymentsForLoan) {
  return (paymentsForLoan || []).reduce((sum, p) => sum + Math.max(0, numberValue(p.fineAmount)), 0);
}

/**
 * Net fine still pending for one loan: what's accrued, minus what's
 * already been paid toward it. Never negative.
 */
export function calculateLoanPendingFine(loan, collectionEntries, paymentsForLoan, today = toInputDate()) {
  const accrued = calculateLoanAccruedFine(loan, collectionEntries, today);
  const paid = sumFinePaid(paymentsForLoan);
  return Math.max(0, Math.round((accrued - paid) * 100) / 100);
}
