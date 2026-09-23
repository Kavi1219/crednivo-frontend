import { ArrowLeft, Check, CheckCircle2, Pencil, Search, UserPlus, UserRound, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import ReviewModal from '../../components/common/ReviewModal';
import LoanSetupFields from '../../components/loan/LoanSetupFields';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { calculateLoan, formatCurrency, formatDate, formatIndianMobile, getFirstDueDate, normalizeIndianMobile, toInputDate } from '../../utils/finance';
import '../Customers/NewCustomer.css';
import './CreateLoan.css';

function cycleSummary(firstDueDate, cycle) {
  const dueDate = firstDueDate;
  if (!dueDate) return 'Select a valid disbursed date';

  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return 'Select a valid disbursed date';

  if (cycle === 'Weekly') return `Weekly · Every ${new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(due)}`;
  if (cycle === 'Monthly') return `Monthly · Pay date ${due.getDate()}`;
  return `Daily · First pay ${formatDate(dueDate)}`;
}

export default function CreateLoan() {
  const actionLocksRef = useRef(new Set());

  const { customers, loans, addLoan, updateCustomerId } = useCrednivo();
  const { hasPermission } = useAuth();
  const canAddCustomer = hasPermission('customers.add');
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ customerId: location.state?.customerId || '', amount:10000, cycle:'Weekly', loanType:'EMI', interestRate:15, duration:10, interestUpfront:false, fineEnabled:false, fineAmount:0, documentChargeEnabled:false, documentChargeAmount:0, startDate:toInputDate() });
  const [customerSearch, setCustomerSearch] = useState('');
  const customerFromProfile = Boolean(location.state?.customerId);
  const [error,setError]=useState('');
  const [reviewOpen,setReviewOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const terms=useMemo(()=>calculateLoan(form),[form]);
  const selectedCustomer=customers.find((item)=>item.id===form.customerId);
  const [loanId,setLoanId]=useState('Generating...');
  const [editingCustomerId,setEditingCustomerId]=useState(false);
  const [customerIdDraft,setCustomerIdDraft]=useState('');
  const [customerIdSaving,setCustomerIdSaving]=useState(false);
  const change=(key,value)=>setForm(v=>({...v,[key]:value}));
  const regularFirstDueDate = getFirstDueDate(form.startDate, form.cycle);
  const effectiveFirstDueDate = form.firstDueDate || regularFirstDueDate;

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

  const beginCustomerIdEdit = () => {
    if (!selectedCustomer) return;
    setCustomerIdDraft(selectedCustomer.id || form.customerId || '');
    setEditingCustomerId(true);
    setError('');
  };

  const cancelCustomerIdEdit = () => {
    setEditingCustomerId(false);
    setCustomerIdDraft('');
  };

  const saveCustomerIdEdit = async () => {
    if (!selectedCustomer || customerIdSaving) return;
    const nextId = String(customerIdDraft || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (nextId.length < 6) {
      setError('Customer ID must contain at least 6 letters/numbers.');
      return;
    }
    setCustomerIdSaving(true);
    setError('');
    try {
      const savedId = await updateCustomerId(selectedCustomer.id, nextId);
      if (savedId) change('customerId', savedId);
      setEditingCustomerId(false);
      setCustomerIdDraft('');
    } catch (apiError) {
      setError(apiError?.message || 'Could not update the Customer ID.');
    } finally {
      setCustomerIdSaving(false);
    }
  };

  const requestCreate=async()=>{
    if(!form.customerId||Number(form.amount)<=0||Number(form.duration)<=0||Number(form.interestRate)<0||!form.startDate){setError('Select a customer and enter a valid amount, interest, manual duration and disbursed date.');return;}
    if(form.fineEnabled && Number(form.fineAmount)<=0){setError('Enter a valid Fine Amount or turn Fine off.');return;}
    if(form.documentChargeEnabled && Number(form.documentChargeAmount)<=0){setError('Enter a valid Document Charges Amount or turn Document Charges off.');return;}
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
  const goToLoans = () => navigate('/loans');

  return <div className="module-page create-loan-page create-loan-redesign">
    <div className="create-loan-page-header">
      <button type="button" className="create-loan-back-link" onClick={goToLoans}>
        <ArrowLeft size={16}/>
        <span>Back to Loans</span>
      </button>
      <div className="create-loan-page-title">
        <h1>Create Loan</h1>
        <p>Enter the loan details below to create a new loan for your customer.</p>
      </div>
    </div>
    {error&&<div className="form-error">{error}</div>}
    <div className="create-loan-layout">
      <section className="module-card create-loan-main-card">
        <div className="create-loan-main-header">
          <span className="create-loan-main-icon"><WalletCards size={20}/></span>
          <div>
            <h2>Loan Details</h2>
            <p>Enter the loan information and schedule.</p>
          </div>
        </div>

        <div className="create-loan-main-body">
          <div className="create-loan-customer-inline">
            <div className="create-loan-inline-customer-label">Customer</div>
            {customerFromProfile ? (
              <div className="profile-loan-customer create-loan-selected-customer create-loan-selected-customer-compact">
                <span className="selected-customer-avatar">{String(selectedCustomer?.name || '?').charAt(0).toUpperCase()}</span>
                <div className="create-loan-selected-copy">
                  <strong>{selectedCustomer?.name || 'Loading customer...'}</strong>
                  {selectedCustomer && (
                    <div className="create-loan-customer-id-row">
                      <span className="create-loan-customer-id-label">Customer ID</span>
                      {editingCustomerId ? (
                        <div className="create-loan-customer-id-editor">
                          <input value={customerIdDraft} maxLength={30} onChange={(event)=>setCustomerIdDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} autoFocus />
                          <button type="button" onClick={saveCustomerIdEdit} disabled={customerIdSaving} title="Save Customer ID"><Check size={14}/></button>
                          <button type="button" onClick={cancelCustomerIdEdit} disabled={customerIdSaving} title="Cancel"><X size={14}/></button>
                        </div>
                      ) : (
                        <div className="create-loan-customer-id-display">
                          <b>{selectedCustomer.id}</b>
                          <button type="button" onClick={beginCustomerIdEdit} title="Edit Customer ID"><Pencil size={13}/> Edit</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="create-loan-search create-loan-customer-inline-search">
                  <Search size={18}/>
                  <input
                    type="search"
                    value={customerSearch}
                    onChange={(event)=>handleCustomerSearch(event.target.value)}
                    placeholder="Search customer by name, Customer ID or mobile number"
                    autoComplete="off"
                    aria-label="Search customer for new loan"
                  />
                  {!customerSearch && canAddCustomer ? <button type="button" className="create-loan-inline-link" onClick={goToNewCustomer}><UserPlus size={14}/> New Customer</button> : null}
                </div>

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
                  <div className="selected-customer-preview selected-customer-preview-confirmed create-loan-selected-customer-compact">
                    <span className="selected-customer-avatar">{String(selectedCustomer.name || '?').charAt(0).toUpperCase()}</span>
                    <div className="create-loan-selected-copy">
                      <strong>{selectedCustomer.name}</strong>
                      <span>{selectedCustomer.mobile ? formatIndianMobile(selectedCustomer.mobile) : '—'}</span>
                      <div className="create-loan-customer-id-row">
                        <span className="create-loan-customer-id-label">Customer ID</span>
                        {editingCustomerId ? (
                          <div className="create-loan-customer-id-editor">
                            <input value={customerIdDraft} maxLength={30} onChange={(event)=>setCustomerIdDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} autoFocus />
                            <button type="button" onClick={saveCustomerIdEdit} disabled={customerIdSaving} title="Save Customer ID"><Check size={14}/></button>
                            <button type="button" onClick={cancelCustomerIdEdit} disabled={customerIdSaving} title="Cancel"><X size={14}/></button>
                          </div>
                        ) : (
                          <div className="create-loan-customer-id-display">
                            <b>{selectedCustomer.id}</b>
                            <button type="button" onClick={beginCustomerIdEdit} title="Edit Customer ID"><Pencil size={13}/> Edit</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button type="button" className="change-selected-customer" onClick={()=>{ change('customerId',''); setCustomerSearch(''); }}>Change</button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="create-loan-section-divider"/>

          <div className="form-section create-loan-details-block">
            <LoanSetupFields form={form} change={change}/>
          </div>
        </div>

        <div className="create-loan-form-actions">
          <ActionButton tone="secondary" type="button" onClick={goToLoans}>Cancel</ActionButton>
          <ActionButton icon={CheckCircle2} type="button" onClick={requestCreate}>Create Loan</ActionButton>
        </div>
      </section>

      <aside className="module-card create-loan-summary-card create-loan-preview-card">
        <div className="create-loan-preview-top">
          <div className="create-loan-summary-head">
            <span className="create-loan-summary-icon"><WalletCards size={20}/></span>
            <div>
              <h3>Loan Preview</h3>
              <p>Review the details before creating</p>
            </div>
          </div>
          <span className="create-loan-ready-badge"><span className="dot"/>Ready to create</span>
        </div>

        <div className="create-loan-hero-card">
          <div>
            <span className="create-loan-hero-label">Loan Amount</span>
            <strong>{formatCurrency(terms.principal)}</strong>
            <small>{form.loanType} • {form.cycle} • {terms.duration} {form.cycle === 'Daily' ? 'days' : form.cycle === 'Weekly' ? 'weeks' : 'months'}</small>
          </div>
          <span className="create-loan-hero-icon"><WalletCards size={22}/></span>
        </div>

        <div className="create-loan-summary-rows create-loan-preview-rows">
          <div><span>Loan Type</span><strong>{form.loanType}</strong></div>
          <div><span>Cycle</span><strong>{form.cycle}</strong></div>
          <div><span>Interest Rate</span><strong>{form.interestRate}%</strong></div>
          <div><span>Duration</span><strong>{terms.duration} {form.cycle === 'Daily' ? 'days' : form.cycle === 'Weekly' ? 'weeks' : 'months'}</strong></div>
          <div><span>Disbursed Date</span><strong>{form.startDate ? formatDate(form.startDate) : '—'}</strong></div>
          <div><span>First Collection Date</span><strong>{effectiveFirstDueDate ? formatDate(effectiveFirstDueDate) : '—'}</strong></div>
        </div>

        <div className="create-loan-preview-section">
          <h4>Additional Options</h4>
          <div className="create-loan-preview-options">
            <div><span>Interest taken upfront</span><strong>{form.interestUpfront ? 'Yes' : 'No'}</strong></div>
            <div><span>Fine applicable</span><strong>{form.fineEnabled ? 'Yes' : 'No'}</strong></div>
            <div><span>Document Charges applicable</span><strong>{form.documentChargeEnabled ? 'Yes' : 'No'}</strong></div>
          </div>
        </div>

        <div className="create-loan-preview-note">
          <h4>Good to know</h4>
          <p>{effectiveFirstDueDate ? `The first collection date is set to ${cycleSummary(effectiveFirstDueDate, form.cycle).replace(/^\w+\s·\s/, '')}.` : 'Choose a valid disbursed date to calculate the first collection date.'}</p>
        </div>
      </aside>
    </div>

    <ReviewModal open={reviewOpen} title="Review Loan Summary" subtitle={`Confirm the loan for ${selectedCustomer?.name || 'selected customer'}.`} badge={loanId} icon={WalletCards} onClose={()=>setReviewOpen(false)} onConfirm={confirmCreate} busy={saving} confirmLabel={saving ? "Saving..." : "Confirm & Add Loan"}>
      <div className="review-summary-grid">
        <div className="review-summary-item accent"><span>Loan ID</span><strong>{loanId}</strong></div>
        <div className="review-summary-item accent"><span>Loan Amount</span><strong>{formatCurrency(terms.principal)}</strong></div>
        <div className="review-summary-item full"><span>Customer</span><strong>{selectedCustomer?.name || '—'}</strong></div>
        <div className="review-summary-item"><span>Customer ID</span><strong>{form.customerId || '—'}</strong></div>
        <div className="review-summary-item"><span>First Collection Date</span><strong>{formatDate(effectiveFirstDueDate)}</strong></div>
        <div className="review-summary-item full"><span>Cycle / Pay Schedule</span><strong>{cycleSummary(effectiveFirstDueDate,form.cycle)}</strong></div>
        <div className="review-summary-item"><span>Loan Type</span><strong>{form.loanType}</strong></div>
        <div className="review-summary-item"><span>{form.loanType === 'IO' ? 'Interest / Cycle' : 'Interest'}</span><strong>{form.interestRate}% · {formatCurrency(terms.interestAmount)}</strong></div>
        <div className="review-summary-item"><span>Interest Taken</span><strong>{form.interestUpfront?'Yes':'No'}</strong></div>
        <div className="review-summary-item"><span>Fine</span><strong>{form.fineEnabled ? `Yes · ${formatCurrency(form.fineAmount)}` : 'No'}</strong></div>
        <div className="review-summary-item"><span>Document Charges</span><strong>{form.documentChargeEnabled ? `Yes · ${formatCurrency(form.documentChargeAmount)}` : 'No'}</strong></div>
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
