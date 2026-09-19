import { toInputDate } from './finance';

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Uniform across Daily / Weekly / Monthly loans: 3 full days of grace after
// the due date before any fine is shown, then it climbs daily from there.
const GRACE_DAYS = 3;

// How many days one fine-rate period covers, by the loan's own cycle. A
// Weekly loan's fineAmount is "per week" (÷7); a Monthly loan's is "per
// month" (÷30, a flat approximation, not the exact days in that calendar
// month); a Daily loan's fineAmount already IS the per-day amount (÷1).
function cycleDays(loan) {
  const cycle = String(loan?.cycle || '').trim().toLowerCase();
  if (cycle === 'weekly') return 7;
  if (cycle === 'monthly') return 30;
  return 1;
}

function daysLate(dueDate, today) {
  const due = new Date(`${dueDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(now.getTime())) return 0;
  return Math.floor((now - due) / 86400000);
}

/**
 * Fine currently owed for ONE overdue due date, given a loan's configured
 * fine rate (loan.fineAmount) for one full cycle of that loan (e.g. Rs 1000
 * for a Monthly loan = Rs 1000 per month late). Grace covers days 0-3 past
 * the due date; day 4 first shows 3 days' worth, climbing daily after that
 * — but never past one full cycle's fine amount for that single due, since
 * a due can only ever be "one cycle" fully late before the next one starts.
 */
export function calculateFineForDue(loan, dueDate, today = toInputDate()) {
  if (!loan?.fineEnabled) return 0;
  const cycleRate = numberValue(loan.fineAmount);
  if (cycleRate <= 0 || !dueDate) return 0;

  const late = daysLate(dueDate, today);
  if (late < GRACE_DAYS + 1) return 0;

  const dailyRate = cycleRate / cycleDays(loan);
  const accrued = (late - 1) * dailyRate;
  return Math.round(Math.min(accrued, cycleRate) * 100) / 100;
}

/**
 * Total fine currently accrued across every unpaid, overdue collection
 * entry for one loan (a customer can be late on more than one due at once).
 */
export function calculateLoanAccruedFine(loan, collectionEntries, today = toInputDate()) {
  if (!loan?.fineEnabled) return 0;
  return (collectionEntries || []).reduce((sum, item) => {
    const balance = Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount));
    if (balance <= 0) return sum;
    const dueDate = String(item.date || '').slice(0, 10);
    if (!dueDate || dueDate > today) return sum;
    return sum + calculateFineForDue(loan, dueDate, today);
  }, 0);
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
