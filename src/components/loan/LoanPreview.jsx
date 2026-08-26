import { Landmark } from 'lucide-react';
import { CYCLE_DEFAULTS, formatCurrency } from '../../utils/finance';

export default function LoanPreview({ form, terms, children }) {
  return (
    <section className="loan-preview module-card">
      <div className="loan-preview-title"><span><Landmark size={20}/></span><div><strong>Automatic Loan Calculation</strong><small>Required amount, interest and repayment update instantly</small></div></div>
      <div className="loan-preview-grid">
        <div><span>Required Amount</span><strong>{formatCurrency(terms.principal)}</strong></div>
        <div><span>{form.loanType === 'IO' ? 'Interest / Cycle' : 'Interest Amount'}</span><strong>{formatCurrency(terms.interestAmount)}</strong></div>
        <div><span>Given Amount</span><strong>{formatCurrency(terms.disbursedAmount)}</strong></div>
        <div><span>Collection / Cycle</span><strong>{formatCurrency(terms.collectionAmount)}</strong></div>
        {form.loanType === 'IO' && <div><span>Principal Outstanding</span><strong>{formatCurrency(terms.initialOutstanding)}</strong></div>}
        <div><span>Total Repayment</span><strong>{formatCurrency(terms.totalRepayment)}</strong></div>
        <div><span>Duration</span><strong>{terms.duration} {CYCLE_DEFAULTS[form.cycle]?.label}</strong></div>
      </div>
      {children}
    </section>
  );
}
