import { toInputDate } from './finance';

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

/** Sunday-to-Saturday week containing dateKey — same convention already used in Reports. */
export function getWeekRange(dateKey = toInputDate()) {
  const date = new Date(`${dateKey}T00:00:00`);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const from = toInputDate(start);
  return { from, to: addDays(from, 6) };
}

function isActiveLoan(loan) {
  return loan.status !== 'Closed' && Number(loan.outstanding) > 0;
}

/**
 * Standing per-cycle collection capacity — every active loan of that cycle
 * contributes its own periodic amount, regardless of which day each
 * customer's own due date falls on. A loan drops out the moment it closes;
 * a new loan's amount joins in immediately.
 */
export function calculateCycleTargets(loans) {
  const cycleTarget = (cycleName) => {
    const loansInCycle = (loans || []).filter((loan) => isActiveLoan(loan) && loan.cycle === cycleName);
    const amount = loansInCycle.reduce((sum, loan) => sum + numberValue(loan.collectionAmount), 0);
    const customerCount = new Set(loansInCycle.map((loan) => loan.customerId)).size;
    return { amount, customerCount };
  };
  return {
    daily: cycleTarget('Daily'),
    weekly: cycleTarget('Weekly'),
    monthly: cycleTarget('Monthly'),
  };
}

/**
 * This week's total collection target: every Daily loan's amount × 7 (it
 * recurs every day of the week) + every Weekly loan's amount (already a
 * full week's worth) + only the Monthly loans whose own due date actually
 * falls within this specific week's date range.
 */
export function calculateWeekTarget(loans, weekRange) {
  const dailyLoans = (loans || []).filter((loan) => isActiveLoan(loan) && loan.cycle === 'Daily');
  const weeklyLoans = (loans || []).filter((loan) => isActiveLoan(loan) && loan.cycle === 'Weekly');
  const monthlyLoans = (loans || []).filter((loan) => isActiveLoan(loan) && loan.cycle === 'Monthly');

  const dailyPortion = dailyLoans.reduce((sum, loan) => sum + numberValue(loan.collectionAmount), 0) * 7;
  const weeklyPortion = weeklyLoans.reduce((sum, loan) => sum + numberValue(loan.collectionAmount), 0);
  const monthlyPortion = monthlyLoans
    .filter((loan) => {
      const due = String(loan.nextDueDate || '').slice(0, 10);
      return due && due >= weekRange.from && due <= weekRange.to;
    })
    .reduce((sum, loan) => sum + numberValue(loan.collectionAmount), 0);

  return dailyPortion + weeklyPortion + monthlyPortion;
}

/**
 * How many currently-unpaid, due-or-overdue installments each customer has
 * right now — the same "pending due" definition already used in Reports
 * (excludes cancelled entries, only counts dates up to today with a
 * remaining balance). Returns a Map keyed by customerId.
 */
export function calculatePendingDueCounts(collections, today = toInputDate()) {
  const counts = new Map();
  (collections || []).forEach((item) => {
    if (String(item.status || '').toLowerCase() === 'cancelled') return;
    const dueDate = String(item.date || '').slice(0, 10);
    if (!dueDate || dueDate > today) return;
    const balance = Math.max(0, numberValue(item.dueAmount) - numberValue(item.paidAmount));
    if (balance <= 0) return;
    const key = String(item.customerId || '');
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

/** 0 pending dues = Very Good, 1 = Good, 2 = Normal, 3+ = Risky. */
export function getRiskTier(pendingDueCount) {
  if (pendingDueCount >= 3) return 'Risky';
  if (pendingDueCount === 2) return 'Normal';
  if (pendingDueCount === 1) return 'Good';
  return 'Very Good';
}
