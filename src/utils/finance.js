export const CYCLE_DEFAULTS = {
  Daily: { duration: 100, label: 'days' },
  Weekly: { duration: 10, label: 'weeks' },
  Monthly: { duration: 10, label: 'months' },
};


export function normalizeIndianMobile(value = '') {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  return digits.slice(0, 10);
}

export function formatIndianMobileLocal(value = '') {
  const digits = normalizeIndianMobile(value);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function formatIndianMobile(value = '') {
  const digits = normalizeIndianMobile(value);
  if (!digits) return '—';
  return `+91 - ${formatIndianMobileLocal(digits)}`;
}

export function isValidIndianMobile(value = '') {
  return normalizeIndianMobile(value).length === 10;
}

export function formatCurrency(value = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function formatDate(date) {
  if (!date) return '—';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export function toInputDate(date = new Date()) {
  const value = new Date(date);
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function getFirstDueDate(startDate, cycle) {
  const due = new Date(`${startDate}T12:00:00`);
  if (cycle === 'Daily') due.setDate(due.getDate() + 1);
  if (cycle === 'Weekly') due.setDate(due.getDate() + 7);
  if (cycle === 'Monthly') {
    const originalDay = due.getDate();
    due.setDate(1);
    due.setMonth(due.getMonth() + 1);
    const lastDay = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate();
    due.setDate(Math.min(originalDay, lastDay));
  }
  return toInputDate(due);
}

export function calculateLoan({
  amount = 0,
  cycle = 'Daily',
  loanType = 'EMI',
  interestRate = 0,
  duration,
  interestUpfront = false,
}) {
  const principal = Number(amount) || 0;
  const rate = Number(interestRate) || 0;
  const cycles = Math.max(1, Number(duration) || CYCLE_DEFAULTS[cycle]?.duration || 1);
  const interestPerCycle = principal * (rate / 100);

  if (loanType === 'IO') {
    // Upfront interest affects only the amount handed to the customer.
    // It does NOT consume one of the configured collection cycles.
    const upfrontInterest = interestUpfront ? interestPerCycle : 0;
    const scheduledInterest = interestPerCycle * cycles;

    return {
      principal,
      duration: cycles,
      interestAmount: interestPerCycle,
      interestPerCycle,
      // Total interest earned at full term includes the upfront interest
      // plus every scheduled IO interest installment.
      totalInterest: scheduledInterest + upfrontInterest,
      upfrontInterest,
      disbursedAmount: Math.max(0, principal - upfrontInterest),
      collectionAmount: interestPerCycle,
      initialOutstanding: principal,
      principalOutstanding: principal,
      // Projected Repayment = amount expected after disbursement:
      // principal + all configured scheduled interest installments.
      totalRepayment: principal + scheduledInterest,
    };
  }

  const totalInterest = principal * (rate / 100);
  const disbursedAmount = interestUpfront ? Math.max(0, principal - totalInterest) : principal;
  const totalRepayment = interestUpfront ? principal : principal + totalInterest;

  return {
    principal,
    duration: cycles,
    interestAmount: totalInterest,
    totalInterest,
    upfrontInterest: interestUpfront ? totalInterest : 0,
    disbursedAmount,
    collectionAmount: cycles ? totalRepayment / cycles : 0,
    totalRepayment,
    initialOutstanding: totalRepayment,
    principalOutstanding: principal,
  };
}

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
