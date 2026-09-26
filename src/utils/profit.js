/**
 * Actual profit earned — one shared definition used by Capital and Reports.
 *
 * Profit = interest earned + fines collected + document charges − expenses
 *
 * Interest earned, per loan:
 *  - interest taken upfront → the full interest counts at loan creation
 *  - IO (interest-only) loans → the interest part of each collection
 *  - other loans → each collection split in the loan's interest ratio
 *    (interest ÷ (principal + interest)), capped at the loan's total interest
 */
export function calculateActualProfit({ loans = [], payments = [], expensesPaid = 0, totalInvestment = 0 }) {
  let interestEarned = 0;
  let finesCollected = 0;
  let documentChargesCollected = 0;

  loans.forEach((loan) => {
    const loanPayments = payments.filter(
      (payment) => payment.loanId === loan.id
        && payment.type === 'Collection'
        && payment.direction === 'in',
    );

    const collectionCash = loanPayments.reduce((sum, payment) => sum + Number(payment.collectionAmount || 0), 0);
    const fineCollected = loanPayments.reduce((sum, payment) => sum + Number(payment.fineAmount || 0), 0);

    const upfrontInterest = loan.interestUpfront
      ? (loan.loanType === 'IO'
          ? Number(loan.interestAmount || 0)
          : Number(loan.totalInterest ?? loan.interestAmount ?? 0))
      : 0;

    let interestFromPayments = 0;
    if (loan.loanType === 'IO') {
      interestFromPayments = loanPayments.reduce((sum, payment) => sum + Number(payment.interestPaid || 0), 0);
    } else if (!loan.interestUpfront) {
      const totalInterest = Math.max(0, Number(loan.totalInterest ?? loan.interestAmount ?? 0));
      const plannedRepayment = Math.max(0, Number(loan.principal || 0) + totalInterest);
      const interestShare = plannedRepayment > 0 ? totalInterest / plannedRepayment : 0;
      interestFromPayments = Math.min(totalInterest, collectionCash * interestShare);
    }

    interestEarned += upfrontInterest + interestFromPayments;
    finesCollected += fineCollected;
    documentChargesCollected += loan.documentChargeEnabled ? Number(loan.documentChargeAmount || 0) : 0;
  });

  const expenses = Number(expensesPaid || 0);
  const actualProfit = interestEarned + finesCollected + documentChargesCollected - expenses;
  const investment = Number(totalInvestment || 0);
  const roiPercent = investment > 0 ? (actualProfit / investment) * 100 : 0;

  return { interestEarned, finesCollected, documentChargesCollected, expensesPaid: expenses, actualProfit, roiPercent };
}
