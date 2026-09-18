import { numberValue, toInputDate } from './finance';

// Uniform across Daily / Weekly / Monthly loans: 3 full days of grace after
// the due date before any fine is shown, then it climbs daily from there.
const GRACE_DAYS = 3;

function daysLate(dueDate, today) {
  const due = new Date(`${dueDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(now.getTime())) return 0;
  return Math.floor((now - due) / 86400000);
}

/**
 * Fine currently owed for ONE overdue due date, given a loan's configured
 * weekly-equivalent fine rate (loan.fineAmount, e.g. 200 = "Rs 200/week").
 * Grace covers days 0-3 past the due date. Day 4 first shows 3 days' worth
 * (200/7 * 3 = 85.71); each day's own portion only reflects in the total
 * starting the following day, so it keeps climbing by ~28.57/day after that.
 */
export function calculateFineForDue(loan, dueDate, today = toInputDate()) {
  if (!loan?.fineEnabled) return 0;
  const weeklyRate = numberValue(loan.fineAmount);
  if (weeklyRate <= 0 || !dueDate) return 0;

  const late = daysLate(dueDate, today);
  if (late < GRACE_DAYS + 1) return 0;

  const dailyRate = weeklyRate / 7;
  return Math.round((late - 1) * dailyRate * 100) / 100;
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
