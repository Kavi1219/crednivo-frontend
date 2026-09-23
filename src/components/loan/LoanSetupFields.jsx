import { CYCLE_DEFAULTS, formatDate, getFirstDueDate } from '../../utils/finance';

export default function LoanSetupFields({ form, change }) {
  const regularFirstDueDate = getFirstDueDate(form.startDate, form.cycle);
  const effectiveFirstDueDate = form.firstDueDate || regularFirstDueDate;
  const isCustomFirstDueDate = Boolean(form.firstDueDate && regularFirstDueDate && form.firstDueDate !== regularFirstDueDate);

  return (
    <div className="form-grid">
      <div className="form-field"><label>Loan Amount *</label><input type="number" min="1" value={form.amount} onChange={(e)=>change('amount',e.target.value)} /></div>
      <div className="form-field"><label>Cycle *</label><select value={form.cycle} onChange={(e)=>change('cycle',e.target.value)}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></div>
      <div className="form-field"><label>Loan Type *</label><select value={form.loanType} onChange={(e)=>change('loanType',e.target.value)}><option value="EMI">EMI</option><option value="IO">Interest Only (IO)</option></select></div>
      <div className="form-field"><label>Interest Rate (%) *</label><input type="number" min="0" step="0.1" value={form.interestRate} onChange={(e)=>change('interestRate',e.target.value)} /></div>
      <div className="form-field"><label>Duration ({CYCLE_DEFAULTS[form.cycle]?.label}) *</label><input type="number" min="1" value={form.duration} onChange={(e)=>change('duration',e.target.value)} /><small className="field-help">Manual duration — you can enter any number of {CYCLE_DEFAULTS[form.cycle]?.label}.</small></div>
      <div className="form-field"><label>Disbursed Date *</label><input type="date" value={form.startDate} onChange={(e)=>change('startDate',e.target.value)} /></div>
      <div className="form-field loan-first-collection-field">
        <label>First Collection Date *</label>
        <input
          type="date"
          min={form.startDate || undefined}
          value={effectiveFirstDueDate}
          onChange={(e)=>change('firstDueDate',e.target.value)}
        />
        <small className="field-help">
          Regular cycle: {regularFirstDueDate ? formatDate(regularFirstDueDate) : 'Select disbursed date'}
          {isCustomFirstDueDate && (
            <button type="button" className="loan-date-reset" onClick={()=>change('firstDueDate','')}>Use regular date</button>
          )}
        </small>
      </div>
      <div className="form-field full"><div className="toggle-row"><div><strong>Interest taken upfront?</strong><small>{form.interestUpfront ? 'Yes — interest is deducted from the amount given.' : 'No — the full loan amount is given.'}</small></div><button type="button" className={`switch ${form.interestUpfront ? 'on':''}`} onClick={()=>change('interestUpfront',!form.interestUpfront)} aria-label="Toggle interest taken upfront"><span/></button></div></div>

      <div className="form-field full">
        <div className="toggle-row loan-fine-toggle-row">
          <div>
            <strong>Fine applicable?</strong>
            <small>{form.fineEnabled ? 'Yes — this loan has a default fine for missed/overdue collection.' : 'No — no default fine is configured for this loan.'}</small>
          </div>
          <div className="loan-fine-toggle-controls">
            {form.fineEnabled && (
              <label className="loan-fine-amount-field">
                <span>Fine Amount</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.fineAmount}
                  onChange={(e)=>change('fineAmount',e.target.value)}
                  placeholder="Enter fine"
                />
              </label>
            )}
            <button
              type="button"
              className={`switch ${form.fineEnabled ? 'on':''}`}
              onClick={()=>{
                const next = !form.fineEnabled;
                change('fineEnabled', next);
                if (!next) change('fineAmount', 0);
              }}
              aria-label="Toggle loan fine"
            >
              <span/>
            </button>
          </div>
        </div>
      </div>

      <div className="form-field full">
        <div className="toggle-row loan-fine-toggle-row">
          <div>
            <strong>Document Charges applicable?</strong>
            <small>{form.documentChargeEnabled ? 'Yes — this one-time charge is treated as extra income and does not affect repayment.' : 'No — no document charge is configured for this loan.'}</small>
          </div>
          <div className="loan-fine-toggle-controls">
            {form.documentChargeEnabled && (
              <label className="loan-fine-amount-field">
                <span>Document Charges Amount</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.documentChargeAmount}
                  onChange={(e)=>change('documentChargeAmount',e.target.value)}
                  placeholder="Enter document charge"
                />
              </label>
            )}
            <button
              type="button"
              className={`switch ${form.documentChargeEnabled ? 'on':''}`}
              onClick={()=>{
                const next = !form.documentChargeEnabled;
                change('documentChargeEnabled', next);
                if (!next) change('documentChargeAmount', 0);
              }}
              aria-label="Toggle document charges"
            >
              <span/>
            </button>
          </div>
        </div>
      </div>

      {form.loanType === 'IO' && <div className="form-field full"><div className="io-loan-rule-note"><strong>Interest Only rule</strong><small>Collection / Cycle is interest only. The principal remains outstanding until you record a Principal Paid amount.</small></div></div>}
    </div>
  );
}
