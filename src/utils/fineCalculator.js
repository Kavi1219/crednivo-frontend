import { toInputDate } from './finance';

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * How many of this loan's installments are currently unpaid and due (date
 * has arrived, balance still > 0) — each one counts as one missed period,
 * regardless of how many days late it's been.
 */
function pendingDueCount(collectionEntries, today) {
  return (collectionEntries || []).filter((item) => {
    const dueDate = String(item.date || '').slice(0, 10);
    if (!dueDate || dueDate > today) return false;
    const balance = Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount));
    return balance > 0;
  }).length;
}

/**
 * Total fine accrued for one loan: a flat fineAmount charged for EACH
 * currently-pending due period — not based on days late, not based on the
 * due's own balance. E.g. fineAmount=500, 4 pending dues (4 months behind)
 * -> 500 x 4 = 2000. A due that's only slightly late still counts as one
 * full missed period, the same as one that's very late.
 */
export function calculateLoanAccruedFine(loan, collectionEntries, today = toInputDate()) {
  if (!loan?.fineEnabled) return 0;
  const fineRate = numberValue(loan.fineAmount);
  if (fineRate <= 0) return 0;
  const count = pendingDueCount(collectionEntries, today);
  return Math.round(fineRate * count * 100) / 100;
}

/** Sum of fine amounts already recorded as paid against a set of payments. */
export function sumFinePaid(paymentsForLoan) {
  return (paymentsForLoan || []).reduce((sum, p) => sum + Math.max(0, numberValue(p.fineAmount)), 0);
}

/**
 * Net fine still pending for one loan: what's accrued (flat rate x missed
 * periods), minus what's already been paid toward it. Never negative.
 */
export function calculateLoanPendingFine(loan, collectionEntries, paymentsForLoan, today = toInputDate()) {
  const accrued = calculateLoanAccruedFine(loan, collectionEntries, today);
  const paid = sumFinePaid(paymentsForLoan);
  return Math.max(0, Math.round((accrued - paid) * 100) / 100);
}
