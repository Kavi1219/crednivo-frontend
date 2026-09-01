import { CheckCircle2, Search, UserPlus, UserRound, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import ReviewModal from '../../components/common/ReviewModal';
import LoanPreview from '../../components/loan/LoanPreview';
import LoanSetupFields from '../../components/loan/LoanSetupFields';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { calculateLoan, formatCurrency, formatDate, formatIndianMobile, getFirstDueDate, normalizeIndianMobile, toInputDate } from '../../utils/finance';
import '../Customers/NewCustomer.css';
import './CreateLoan.css';

function cycleSummary(startDate, cycle) {
  const dueDate = getFirstDueDate(startDate, cycle);
  if (!dueDate) return 'Select a valid disbursed date';

  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return 'Select a valid disbursed date';

  if (cycle === 'Weekly') return `Weekly · Every ${new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(due)}`;
  if (cycle === 'Monthly') return `Monthly · Pay date ${due.getDate()}`;
  return `Daily · First pay ${formatDate(dueDate)}`;
}

export default function CreateLoan() {
  const actionLocksRef = useRef(new Set());

  const { customers, loans, addLoan } = useCrednivo();
  const { hasPermission } = useAuth();
  const canAddCustomer = hasPermission('customers.add');
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ customerId: location.state?.customerId || '', amount:10000, cycle:'Weekly', loanType:'EMI', interestRate:15, duration:10, interestUpfront:false, fineEnabled:false, fineAmount:0, startDate:toInputDate() });
  const [customerSearch, setCustomerSearch] = useState('');
  const customerFromProfile = Boolean(location.state?.customerId);
  const [error,setError]=useState('');
  const [reviewOpen,setReviewOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const terms=useMemo(()=>calculateLoan(form),[form]);
  const selectedCustomer=customers.find((item)=>item.id===form.customerId);
  const [loanId,setLoanId]=useState('Generating...');
  const change=(key,value)=>setForm(v=>({...v,[key]:value}));

  useEffect(()=>{
    let active=true;
    apiRequest('/loans/next-id')
      .then((result)=>{ if(active) setLoanId(result?.loanId || 'Generated on save'); })
      .catch(()=>{ if(active) setLoanId('Generated on save'); });
    return ()=>{ active=false; };
  },[loans.length, form.customerId]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;
    const phoneQuery = normalizeIndianMobile(customerSearch);
    return customers.filter((customer) => (
      String(customer.id || '').toLowerCase().includes(query)
      || String(customer.name || '').toLowerCase().includes(query)
      || String(customer.mobile || '').toLowerCase().includes(query)
      || (phoneQuery.length >= 3 && normalizeIndianMobile(customer.mobile).includes(phoneQuery))
    ));
  }, [customers, customerSearch]);

  const handleCustomerSearch = (value) => {
    setCustomerSearch(value);
    const query = value.trim().toLowerCase();
    if (!query) return;
    const phoneQuery = normalizeIndianMobile(value);
    const selectedStillMatches = selectedCustomer && (
      String(selectedCustomer.id || '').toLowerCase().includes(query)
      || String(selectedCustomer.name || '').toLowerCase().includes(query)
      || String(selectedCustomer.mobile || '').toLowerCase().includes(query)
      || (phoneQuery.length >= 3 && normalizeIndianMobile(selectedCustomer.mobile).includes(phoneQuery))
    );
    if (!selectedStillMatches) change('customerId', '');
  };

  const selectCustomer = (customer) => {
    change('customerId', customer.id);
    setCustomerSearch('');
    setError('');
  };

  const requestCreate=async()=>{
    if(!form.customerId||Number(form.amount)<=0||Number(form.duration)<=0||Number(form.interestRate)<0||!form.startDate){setError('Select a customer and enter a valid amount, interest, manual duration and disbursed date.');return;}
    if(form.fineEnabled && Number(form.fineAmount)<=0){setError('Enter a valid Fine Amount or turn Fine off.');return;}
    setError('');
    try {
      const result=await apiRequest('/loans/next-id');
      setLoanId(result?.loanId || 'Generated on save');
    } catch {
      setLoanId('Generated on save');
    }
    setReviewOpen(true);
  };
  const confirmCreate=async()=>{
    if (actionLocksRef.current.has('confirmCreate')) return;
    actionLocksRef.current.add('confirmCreate');
    try {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const id=await addLoan(form);
      setReviewOpen(false);
      if(id) navigate('/loans');
    } catch (apiError) {
      setReviewOpen(false);
      setError(apiError?.message || 'Could not create the loan in the CREDNIVO database.');
    } finally {
      setSaving(false);
    }
  
    } finally {
      actionLocksRef.current.delete('confirmCreate');
    }
  };

  const goToNewCustomer = () => navigate('/customers/new');

  return <div className="module-page create-loan-page">
    <ModuleHeader
      eyebrow="Existing Customer"
      title="Create Loan"
      description="Add another Daily, Weekly or Monthly loan with manual duration and an automatic repayment calculation."
      actions={
        <div className="create-loan-header-actions">
          {canAddCustomer && <ActionButton icon={UserPlus} tone="secondary" type="button" onClick={goToNewCustomer}>New Customer</ActionButton>}
          <ActionButton icon={CheckCircle2} type="button" onClick={requestCreate}>Add Loan</ActionButton>
        </div>
      }
    />
    {error&&<div className="form-error">{error}</div>}
    <section className="form-card module-card">
      <div className="form-section">
        <div className="form-section-head">
          <span className="form-section-icon"><UserRound size={19}/></span>
          <div>
            <h2>{customerFromProfile ? 'Customer' : 'Select Customer'}</h2>
            <p>{customerFromProfile ? 'This loan will be created for the selected customer profile.' : 'Search by Customer ID or customer name, then select the profile'}</p>
          </div>
        </div>

        {customerFromProfile ? (
          <div className="profile-loan-customer">
            <span className="selected-customer-avatar">{String(selectedCustomer?.name || '?').charAt(0).toUpperCase()}</span>
            <div>
              <small>Customer</small>
              <strong>{selectedCustomer?.name || 'Loading customer...'}</strong>
            </div>
          </div>
        ) : (
          <div className="create-loan-customer-picker">
            <label className="create-loan-customer-search-label">Search Customer *</label>
            <div className="create-loan-search create-loan-search-large">
              <Search size={19}/>
              <input
                type="search"
                value={customerSearch}
                onChange={(event)=>handleCustomerSearch(event.target.value)}
                placeholder="Search by customer name, Customer ID or mobile number..."
                autoComplete="off"
                aria-label="Search customer for new loan"
              />
            </div>

            {!customerSearch.trim() && !selectedCustomer && (
              <div className="customer-picker-hint">
                Start typing to find the customer for this loan. No customer is selected by default.
              </div>
            )}

            {customerSearch.trim() && (
              <div className="customer-search-results" role="listbox" aria-label="Matching customers">
                <div className="customer-search-results-head">
                  <span>Search Results</span>
                  <small>{filteredCustomers.length} found</small>
                </div>
                {filteredCustomers.length ? (
                  filteredCustomers.slice(0, 10).map((customer) => (
                    <button
                      type="button"
                      key={customer.id}
                      className="customer-search-result"
                      onClick={()=>selectCustomer(customer)}
                    >
                      <span className="selected-customer-avatar">{String(customer.name || '?').charAt(0).toUpperCase()}</span>
                      <span className="customer-search-result-copy">
                        <strong>{customer.name}</strong>
                        <small>{customer.id}{customer.mobile ? ` · ${formatIndianMobile(customer.mobile)}` : ''}</small>
                      </span>
                      <span className="customer-search-select-text">Select</span>
                    </button>
                  ))
                ) : (
                  <div className="customer-search-empty">
                    No customer matches “{customerSearch}”.
                  </div>
                )}
              </div>
            )}

            {selectedCustomer && (
              <div className="selected-customer-preview selected-customer-preview-confirmed">
                <span className="selected-customer-avatar">{String(selectedCustomer.name || '?').charAt(0).toUpperCase()}</span>
                <div>
                  <small>Selected Customer</small>
                  <strong>{selectedCustomer.name}</strong>
                  <span>{selectedCustomer.id}{selectedCustomer.mobile ? ` · ${formatIndianMobile(selectedCustomer.mobile)}` : ''}</span>
                </div>
                <button type="button" className="change-selected-customer" onClick={()=>{
                  change('customerId','');
                  setCustomerSearch('');
                }}>Change</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-head"><span className="form-section-icon"><WalletCards size={19}/></span><div><h2>Loan Details</h2><p>Cycle, loan type, interest, manual duration and disbursed date</p></div></div>
        <LoanSetupFields form={form} change={change}/>
      </div>
    </section>

    <LoanPreview form={form} terms={terms}>
      <div className="loan-preview-actions">
        {canAddCustomer && <ActionButton icon={UserPlus} tone="secondary" type="button" onClick={goToNewCustomer}>New Customer</ActionButton>}
        <ActionButton icon={CheckCircle2} type="button" className="loan-add-button" onClick={requestCreate}>Add Loan</ActionButton>
      </div>
    </LoanPreview>

    <ReviewModal open={reviewOpen} title="Review Loan Summary" subtitle={`Confirm the loan for ${selectedCustomer?.name || 'selected customer'}.`} badge={loanId} icon={WalletCards} onClose={()=>setReviewOpen(false)} onConfirm={confirmCreate} busy={saving} confirmLabel={saving ? "Saving..." : "Confirm & Add Loan"}>
      <div className="review-summary-grid">
        <div className="review-summary-item accent"><span>Loan ID</span><strong>{loanId}</strong></div>
        <div className="review-summary-item accent"><span>Loan Amount</span><strong>{formatCurrency(terms.principal)}</strong></div>
        <div className="review-summary-item full"><span>Customer</span><strong>{selectedCustomer?.name || '—'}</strong></div>
        <div className="review-summary-item full"><span>Cycle / Pay Schedule</span><strong>{cycleSummary(form.startDate,form.cycle)}</strong></div>
        <div className="review-summary-item"><span>Loan Type</span><strong>{form.loanType}</strong></div>
        <div className="review-summary-item"><span>{form.loanType === 'IO' ? 'Interest / Cycle' : 'Interest'}</span><strong>{form.interestRate}% · {formatCurrency(terms.interestAmount)}</strong></div>
        <div className="review-summary-item"><span>Interest Taken</span><strong>{form.interestUpfront?'Yes':'No'}</strong></div>
        <div className="review-summary-item"><span>Fine</span><strong>{form.fineEnabled ? `Yes · ${formatCurrency(form.fineAmount)}` : 'No'}</strong></div>
        <div className="review-summary-item"><span>Given Amount</span><strong>{formatCurrency(terms.disbursedAmount)}</strong></div>
        <div className="review-summary-item"><span>Collection / Cycle</span><strong>{formatCurrency(terms.collectionAmount)}</strong></div>
        {form.loanType === 'IO' && <div className="review-summary-item"><span>Principal Outstanding</span><strong>{formatCurrency(terms.initialOutstanding)}</strong></div>}
        <div className="review-summary-item"><span>{form.loanType === 'IO' ? 'Projected Repayment' : 'Total Repayment'}</span><strong>{formatCurrency(terms.totalRepayment)}</strong></div>
        <div className="review-summary-item"><span>Duration</span><strong>{terms.duration} {form.cycle==='Daily'?'days':form.cycle==='Weekly'?'weeks':'months'}</strong></div>
        <div className="review-summary-item full"><span>Disbursed Date</span><strong>{formatDate(form.startDate)}</strong></div>
      </div>
    </ReviewModal>
  </div>;
}
