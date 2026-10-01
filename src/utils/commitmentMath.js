/**
 * Shared by Expenses → Commitments and Capital → Add Capital → Loan (borrowed):
 * repayment cycles and the EMI ⇄ interest-rate maths for borrowed loans.
 */
export const CYCLES = [
  { value: 'ONE_TIME', label: 'One time' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BIMONTHLY', label: 'Every 2 months' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];
/** Loans repay on a schedule, so "One time" is not offered for them. */
export const LOAN_CYCLES = CYCLES.filter((cycle) => cycle.value !== 'ONE_TIME');

export const PERIODS_PER_YEAR = { DAILY: 365, WEEKLY: 52, MONTHLY: 12, BIMONTHLY: 6, QUARTERLY: 4, YEARLY: 1, ONE_TIME: 12 };
export const CYCLE_UNIT = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', BIMONTHLY: '2 months', QUARTERLY: 'quarter', YEARLY: 'year', ONE_TIME: 'month' };

export const round2 = (value) => Math.round(value * 100) / 100;

/**
 * EMI for a loan (reducing balance): EMI = P·r·(1+r)^n / ((1+r)^n − 1),
 * r = annual rate ÷ 100 ÷ installments per year. 0% → P ÷ n.
 */
export function emiFromRate(principal, annualRate, n, cycle) {
  if (!(principal > 0) || !(n > 0)) return 0;
  const r = (Number(annualRate) || 0) / 100 / (PERIODS_PER_YEAR[cycle] || 12);
  if (r <= 0) return round2(principal / n);
  const f = (1 + r) ** n;
  return round2((principal * r * f) / (f - 1));
}

/** Yearly interest rate that gives this EMI (inverse of emiFromRate); null if the EMI can't repay the loan. */
export function rateFromEmi(principal, emi, n, cycle) {
  if (!(principal > 0) || !(n > 0) || !(emi > 0)) return null;
  if (emi * n < principal - 0.5) return null; // EMI too small to ever repay the loan
  if (Math.abs(emi * n - principal) < 0.5) return 0;
  let low = 0;
  let high = 1000;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (emiFromRate(principal, mid, n, cycle) > emi) high = mid; else low = mid;
  }
  return round2((low + high) / 2);
}

/**
 * EMI form: the user enters EITHER the EMI or the yearly rate; the other is worked out.
 * `emiDriver` remembers which one was typed last ('emi' | 'rate').
 */
export function recalcEmi(next) {
  if (next.loanKind !== 'EMI') return next;
  const principal = Number(next.amount);
  const n = Number(next.tenure);
  if (next.emiDriver === 'rate') {
    const emi = emiFromRate(principal, Number(next.interestRate), n, next.cycle);
    return { ...next, installmentAmount: emi > 0 && next.interestRate !== '' ? String(emi) : next.installmentAmount };
  }
  const rate = rateFromEmi(principal, Number(next.installmentAmount), n, next.cycle);
  return { ...next, interestRate: rate == null ? '' : String(rate) };
}
