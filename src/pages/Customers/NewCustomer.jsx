import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Pencil, ShieldCheck, UserRound, WalletCards, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import ReviewModal from '../../components/common/ReviewModal';
import LoanSetupFields from '../../components/loan/LoanSetupFields';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { calculateLoan, formatCurrency, formatDate, formatIndianMobile, formatIndianMobileLocal, getFirstDueDate, isValidIndianMobile, normalizeIndianMobile, toInputDate } from '../../utils/finance';
import '../Loans/CreateLoan.css';
import './NewCustomer.css';

const initial = {
  name: '', mobile: '', fatherName: '', date: toInputDate(), work: '', workAddress: '', area: '', address: '',
  photo: '', customerDocument: null, customerDocuments: [],
  jaminName: '', jaminMobile: '', jaminFatherName: '', jaminWork: '', jaminWorkAddress: '', jaminAddress: '',
  jaminPhoto: '', jaminDocument: null, jaminDocuments: [],
  amount: 10000, cycle: 'Daily', loanType: 'EMI', interestRate: 15,
  duration: 100, interestUpfront: false, fineEnabled: false, fineAmount: 0,
  documentChargeEnabled: false, documentChargeAmount: 0, startDate: toInputDate(),
};

function financialYearCode(dateValue = toInputDate()) {
  const date = new Date(`${dateValue}T12:00:00`);
  const year = date.getFullYear();
  const start = date.getMonth() + 1 >= 4 ? year : year - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

function nextCustomerPreviewId(list, customerDate) {
  const prefix = `SFC-${financialYearCode(customerDate)}-`;
  const used = list
    .map((item) => String(item.id || '').toUpperCase())
    .filter((id) => id.startsWith(prefix) && /^\d{4}$/.test(id.slice(prefix.length)))
    .map((id) => Number(id.slice(prefix.length)));
  let next = 0;
  while (used.includes(next)) next += 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function nextPreviewId(prefix, list, pad) {
  const highest = list.reduce((max, item) => {
    const match = String(item.id || '').match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefix}${String(highest + 1).padStart(pad, '0')}`;
}

function cycleSummary(firstDueDate, cycle) {
  if (!firstDueDate) return 'Select a valid disbursed date';
  const due = new Date(`${firstDueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return 'Select a valid disbursed date';
  if (cycle === 'Weekly') return `Every ${new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(due)}`;
  if (cycle === 'Monthly') return `Pay date ${due.getDate()}`;
  return `First pay ${formatDate(firstDueDate)}`;
}

function OptionalPhone({ value, onChange, id }) {
  return (
    <div className="registration-phone-input">
      <select aria-label="Country code" defaultValue="+91">
        <option value="+91">🇮🇳 +91</option>
      </select>
      <input
        id={id}
        value={formatIndianMobileLocal(value)}
        onChange={(event) => onChange(normalizeIndianMobile(event.target.value))}
        inputMode="numeric"
        autoComplete="tel"
        placeholder="Phone number"
      />
    </div>
  );
}

export default function NewCustomer() {
  const actionLocksRef = useRef(new Set());
  const { saveCustomerProfile, saveJaminProfile, addLoan, updateCustomerId, customers, loans } = useCrednivo();
  const { hasPermission } = useAuth();
  const canCreateLoan = hasPermission('loans.create');
  const navigate = useNavigate();

  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(null);
  const [savedCustomerId, setSavedCustomerId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customerIdEditing, setCustomerIdEditing] = useState(false);
  const [customerIdDraft, setCustomerIdDraft] = useState('');
  const [customerIdTouched, setCustomerIdTouched] = useState(false);

  const terms = useMemo(() => calculateLoan(form), [form]);
  const effectiveFirstDueDate = form.firstDueDate || getFirstDueDate(form.startDate, form.cycle);
  const previewCustomerId = useMemo(() => nextCustomerPreviewId(customers, form.date), [customers, form.date]);
  const customerId = savedCustomerId || customerIdDraft || previewCustomerId;
  const loanId = useMemo(() => nextPreviewId('SFCLN-', loans, 5), [loans]);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!customerIdTouched && !savedCustomerId) setCustomerIdDraft(previewCustomerId);
  }, [previewCustomerId, customerIdTouched, savedCustomerId]);

  const validateCustomer = () => {
    if (form.mobile && !isValidIndianMobile(form.mobile)) {
      setError('Customer phone number must contain 10 digits when provided.');
      return false;
    }
    setError('');
    return true;
  };

  const validateWitness = () => {
    if (form.jaminMobile && !isValidIndianMobile(form.jaminMobile)) {
      setError('Witness phone number must contain 10 digits when provided.');
      return false;
    }
    setError('');
    return true;
  };

  const validateLoan = () => {
    if (Number(form.amount) <= 0 || Number(form.duration) <= 0 || Number(form.interestRate) < 0 || !form.startDate) {
      setError('Enter a valid Loan Amount, Interest Rate, Duration and Disbursed Date.');
      return false;
    }
    if (form.fineEnabled && Number(form.fineAmount) <= 0) {
      setError('Enter a valid Fine Amount or turn Fine off.');
      return false;
    }
    if (form.documentChargeEnabled && Number(form.documentChargeAmount) <= 0) {
      setError('Enter a valid Document Charges Amount or turn Document Charges off.');
      return false;
    }
    setError('');
    return true;
  };

  const saveCustomerStep = () => {
    if (!validateCustomer()) return;
    setReview('customer');
  };
  const saveWitnessStep = () => {
    if (!validateWitness()) return;
    setReview('witness');
  };
  const addLoanStep = () => {
    if (!validateLoan()) return;
    setReview('loan');
  };

  const confirmReview = async () => {
    if (actionLocksRef.current.has('confirmReview') || saving) return;
    actionLocksRef.current.add('confirmReview');
    setSaving(true);
    setError('');
    try {
      if (review === 'customer') {
        const createdId = await saveCustomerProfile(form, savedCustomerId);
        let finalId = createdId;
        const requestedId = String(customerIdDraft || '').trim().toUpperCase();
        if (requestedId && requestedId !== createdId) {
          finalId = await updateCustomerId(createdId, requestedId);
        }
        setSavedCustomerId(finalId || createdId);
        setCustomerIdDraft(finalId || createdId);
        setReview(null);
        setStep(1);
        return;
      }
      if (review === 'witness') {
        await saveJaminProfile(savedCustomerId, form);
        setReview(null);
        if (canCreateLoan) setStep(2);
        else navigate(`/customers/${savedCustomerId}`);
        return;
      }
      if (review === 'loan') {
        const id = await addLoan({ ...form, customerId: savedCustomerId });
        setReview(null);
        if (id) navigate(`/customers/${savedCustomerId}`);
      }
    } catch (apiError) {
      setError(apiError?.message || 'Could not save to the CREDNIVO database.');
      setReview(null);
    } finally {
      setSaving(false);
      actionLocksRef.current.delete('confirmReview');
    }
  };

  const steps = [
    { label: 'Customer', subtitle: 'Personal Details', icon: UserRound },
    { label: 'Witness', subtitle: 'Account Details', icon: ShieldCheck },
    ...(canCreateLoan ? [{ label: 'Loan', subtitle: 'Loan Details', icon: WalletCards }] : []),
  ];

  const renderCustomerId = () => (
    <div className="registration-id-field">
      <label>Customer ID</label>
      <div className={`registration-id-control ${customerIdEditing ? 'editing' : ''}`}>
        <input
          value={customerIdDraft || previewCustomerId}
          readOnly={!customerIdEditing}
          onChange={(event) => {
            setCustomerIdTouched(true);
            setCustomerIdDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30));
          }}
        />
        {customerIdEditing ? (
          <button type="button" onClick={() => setCustomerIdEditing(false)} title="Done"><Check size={16}/></button>
        ) : (
          <button type="button" onClick={() => setCustomerIdEditing(true)} title="Edit Customer ID"><Pencil size={15}/></button>
        )}
      </div>
    </div>
  );

  return (
    <div className="module-page new-customer-page registration-page-v2">
      <div className="registration-shell module-card">
        <aside className="registration-sidebar">
          <div className="registration-brand-block">
            <span className="registration-brand-mark">SFC</span>
            <div>
              <strong>Customer Registration</strong>
              <small>Sangam Fin Capital</small>
            </div>
          </div>

          <nav className="registration-steps" aria-label="Customer registration progress">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const state = index < step ? 'done' : index === step ? 'active' : '';
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`registration-step ${state}`}
                  onClick={() => index <= step && setStep(index)}
                  disabled={index > step}
                >
                  <span className="registration-step-icon">{index < step ? <Check size={17}/> : <Icon size={17}/>}</span>
                  <span className="registration-step-copy">
                    <small>{item.subtitle}</small>
                    <strong>{item.label}</strong>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="registration-content">
          {error && <div className="form-error">{error}</div>}

          {step === 0 && (
            <section className="registration-panel onboarding-panel">
              <div className="registration-panel-head">
                <span>YOUR CUSTOMER DETAILS</span>
                <h1>Customer</h1>
                <p>Enter the available customer information. All fields on this step are optional.</p>
              </div>

              {renderCustomerId()}

              <div className="registration-section-title">PERSONAL DETAILS</div>
              <div className="registration-grid two-col">
                <div className="registration-field">
                  <label>Name</label>
                  <input value={form.name} onChange={(e) => change('name', e.target.value)} placeholder="Customer name"/>
                </div>
                <div className="registration-field">
                  <label>Father’s Name</label>
                  <input value={form.fatherName} onChange={(e) => change('fatherName', e.target.value)} placeholder="Father's name"/>
                </div>
              </div>

              <div className="registration-section-title">CONTACT DETAILS</div>
              <div className="registration-grid one-col compact-width">
                <div className="registration-field">
                  <label>Phone Number</label>
                  <OptionalPhone id="customer-phone" value={form.mobile} onChange={(value) => change('mobile', value)}/>
                </div>
              </div>

              <div className="registration-section-title">RESIDENTIAL ADDRESS</div>
              <div className="registration-grid one-col">
                <div className="registration-field">
                  <label>Residential Address</label>
                  <textarea value={form.address} onChange={(e) => change('address', e.target.value)} placeholder="Residential address"/>
                </div>
              </div>

              <div className="registration-section-title">WORK DETAILS</div>
              <div className="registration-grid two-col">
                <div className="registration-field">
                  <label>Work</label>
                  <input value={form.work} onChange={(e) => change('work', e.target.value)} placeholder="Occupation / work"/>
                </div>
                <div className="registration-field">
                  <label>Work Address</label>
                  <input value={form.workAddress} onChange={(e) => change('workAddress', e.target.value)} placeholder="Work address"/>
                </div>
              </div>

              <div className="registration-actions">
                <ActionButton tone="secondary" type="button" onClick={() => navigate('/customers')}>Cancel</ActionButton>
                <ActionButton icon={ArrowRight} type="button" onClick={saveCustomerStep}>Next</ActionButton>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="registration-panel onboarding-panel">
              <div className="registration-panel-head">
                <span>WITNESS DETAILS</span>
                <h1>Witness</h1>
                <p>Enter the available witness information. All fields on this step are optional.</p>
              </div>

              <div className="registration-section-title">PERSONAL DETAILS</div>
              <div className="registration-grid two-col">
                <div className="registration-field">
                  <label>Name</label>
                  <input value={form.jaminName} onChange={(e) => change('jaminName', e.target.value)} placeholder="Witness name"/>
                </div>
                <div className="registration-field">
                  <label>Father’s Name</label>
                  <input value={form.jaminFatherName} onChange={(e) => change('jaminFatherName', e.target.value)} placeholder="Father's name"/>
                </div>
              </div>

              <div className="registration-section-title">CONTACT DETAILS</div>
              <div className="registration-grid one-col compact-width">
                <div className="registration-field">
                  <label>Phone Number</label>
                  <OptionalPhone id="witness-phone" value={form.jaminMobile} onChange={(value) => change('jaminMobile', value)}/>
                </div>
              </div>

              <div className="registration-section-title">RESIDENTIAL ADDRESS</div>
              <div className="registration-grid one-col">
                <div className="registration-field">
                  <label>Residential Address</label>
                  <textarea value={form.jaminAddress} onChange={(e) => change('jaminAddress', e.target.value)} placeholder="Residential address"/>
                </div>
              </div>

              <div className="registration-section-title">WORK DETAILS</div>
              <div className="registration-grid two-col">
                <div className="registration-field">
                  <label>Work</label>
                  <input value={form.jaminWork} onChange={(e) => change('jaminWork', e.target.value)} placeholder="Occupation / work"/>
                </div>
                <div className="registration-field">
                  <label>Work Address</label>
                  <input value={form.jaminWorkAddress} onChange={(e) => change('jaminWorkAddress', e.target.value)} placeholder="Work address"/>
                </div>
              </div>

              <div className="registration-actions split">
                <ActionButton type="button" tone="secondary" icon={ArrowLeft} onClick={() => setStep(0)}>Customer</ActionButton>
                <ActionButton type="button" icon={ArrowRight} onClick={saveWitnessStep}>{canCreateLoan ? 'Next' : 'Save'}</ActionButton>
              </div>
            </section>
          )}

          {step === 2 && canCreateLoan && (
            <section className="registration-panel onboarding-panel registration-loan-step">
              <div className="registration-panel-head">
                <span>LOAN DETAILS</span>
                <h1>Loan</h1>
                <p>Use the same loan setup and preview format as the Create Loan page.</p>
              </div>

              <div className="create-loan-layout registration-loan-layout">
                <section className="module-card create-loan-main-card">
                  <div className="create-loan-main-header">
                    <span className="create-loan-main-icon"><WalletCards size={20}/></span>
                    <div><h2>Loan Details</h2><p>Set up the loan terms and schedule.</p></div>
                  </div>
                  <div className="create-loan-main-body">
                    <div className="registration-selected-customer-row">
                      <span>Customer</span>
                      <strong>{form.name || 'Unnamed Customer'}</strong>
                      <small>{savedCustomerId}</small>
                    </div>
                    <div className="create-loan-section-divider"/>
                    <div className="form-section create-loan-details-block">
                      <LoanSetupFields form={form} change={change}/>
                    </div>
                  </div>
                  <div className="create-loan-form-actions">
                    <ActionButton type="button" tone="secondary" icon={ArrowLeft} onClick={() => setStep(1)}>Witness</ActionButton>
                    <ActionButton type="button" icon={CheckCircle2} onClick={addLoanStep}>Create Loan</ActionButton>
                  </div>
                </section>

                <aside className="module-card create-loan-summary-card create-loan-preview-card">
                  <div className="create-loan-preview-top">
                    <div className="create-loan-summary-head">
                      <span className="create-loan-summary-icon"><WalletCards size={20}/></span>
                      <div><h3>Loan Preview</h3><p>Review the details before creating</p></div>
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
                    <div><span>Disbursed Date</span><strong>{formatDate(form.startDate)}</strong></div>
                    <div><span>First Collection Date</span><strong>{formatDate(effectiveFirstDueDate)}</strong></div>
                    <div><span>Given Amount</span><strong>{formatCurrency(terms.disbursedAmount)}</strong></div>
                  </div>

                  <div className="create-loan-preview-section">
                    <h4>Additional Options</h4>
                    <div className="create-loan-preview-options">
                      <div><span>Interest taken ?</span><strong>{form.interestUpfront ? 'Yes' : 'No'}</strong></div>
                      <div><span>Fine applicable ?</span><strong>{form.fineEnabled ? 'Yes' : 'No'}</strong></div>
                      <div><span>Document Charges ?</span><strong>{form.documentChargeEnabled ? 'Yes' : 'No'}</strong></div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          )}
        </main>
      </div>

      <ReviewModal
        open={review === 'customer'}
        title="Review Customer Details"
        subtitle="Check the available details before moving to Witness."
        badge={customerId}
        icon={UserRound}
        onClose={() => setReview(null)}
        onConfirm={confirmReview}
        busy={saving}
        confirmLabel={saving ? 'Saving...' : 'Confirm & Continue to Witness'}
      >
        <div className="review-summary-grid">
          <div className="review-summary-item accent"><span>Customer ID</span><strong>{customerId}</strong></div>
          <div className="review-summary-item"><span>Name</span><strong>{form.name || '—'}</strong></div>
          <div className="review-summary-item"><span>Father’s Name</span><strong>{form.fatherName || '—'}</strong></div>
          <div className="review-summary-item"><span>Phone</span><strong>{form.mobile ? formatIndianMobile(form.mobile) : '—'}</strong></div>
          <div className="review-summary-item full"><span>Residential Address</span><strong>{form.address || '—'}</strong></div>
          <div className="review-summary-item"><span>Work</span><strong>{form.work || '—'}</strong></div>
          <div className="review-summary-item"><span>Work Address</span><strong>{form.workAddress || '—'}</strong></div>
        </div>
      </ReviewModal>

      <ReviewModal
        open={review === 'witness'}
        title="Review Witness Details"
        subtitle="Check the available witness details before moving to Loan."
        badge={savedCustomerId}
        icon={ShieldCheck}
        onClose={() => setReview(null)}
        onConfirm={confirmReview}
        busy={saving}
        confirmLabel={saving ? 'Saving...' : canCreateLoan ? 'Confirm & Continue to Loan' : 'Confirm & Save'}
      >
        <div className="review-summary-grid">
          <div className="review-summary-item"><span>Name</span><strong>{form.jaminName || '—'}</strong></div>
          <div className="review-summary-item"><span>Father’s Name</span><strong>{form.jaminFatherName || '—'}</strong></div>
          <div className="review-summary-item"><span>Phone</span><strong>{form.jaminMobile ? formatIndianMobile(form.jaminMobile) : '—'}</strong></div>
          <div className="review-summary-item full"><span>Residential Address</span><strong>{form.jaminAddress || '—'}</strong></div>
          <div className="review-summary-item"><span>Work</span><strong>{form.jaminWork || '—'}</strong></div>
          <div className="review-summary-item"><span>Work Address</span><strong>{form.jaminWorkAddress || '—'}</strong></div>
        </div>
      </ReviewModal>

      <ReviewModal
        open={review === 'loan'}
        title="Review Loan Summary"
        subtitle="Confirm the repayment setup before adding the first loan."
        badge={loanId}
        icon={WalletCards}
        onClose={() => setReview(null)}
        onConfirm={confirmReview}
        busy={saving}
        confirmLabel={saving ? 'Saving...' : 'Confirm & Add Loan'}
      >
        <div className="review-summary-grid">
          <div className="review-summary-item accent"><span>Loan ID</span><strong>{loanId}</strong></div>
          <div className="review-summary-item accent"><span>Loan Amount</span><strong>{formatCurrency(terms.principal)}</strong></div>
          <div className="review-summary-item full"><span>Cycle / Pay Schedule</span><strong>{cycleSummary(effectiveFirstDueDate, form.cycle)}</strong></div>
          <div className="review-summary-item"><span>Loan Type</span><strong>{form.loanType}</strong></div>
          <div className="review-summary-item"><span>Interest</span><strong>{form.interestRate}% · {formatCurrency(terms.interestAmount)}</strong></div>
          <div className="review-summary-item"><span>Interest taken ?</span><strong>{form.interestUpfront ? 'Yes' : 'No'}</strong></div>
          <div className="review-summary-item"><span>Fine applicable ?</span><strong>{form.fineEnabled ? `Yes · ${formatCurrency(form.fineAmount)}` : 'No'}</strong></div>
          <div className="review-summary-item"><span>Document Charges ?</span><strong>{form.documentChargeEnabled ? `Yes · ${formatCurrency(form.documentChargeAmount)}` : 'No'}</strong></div>
          <div className="review-summary-item"><span>Given Amount</span><strong>{formatCurrency(terms.disbursedAmount)}</strong></div>
          <div className="review-summary-item"><span>Collection / Cycle</span><strong>{formatCurrency(terms.collectionAmount)}</strong></div>
          <div className="review-summary-item"><span>Total Repayment</span><strong>{formatCurrency(terms.totalRepayment)}</strong></div>
          <div className="review-summary-item"><span>Duration</span><strong>{terms.duration} {form.cycle === 'Daily' ? 'days' : form.cycle === 'Weekly' ? 'weeks' : 'months'}</strong></div>
          <div className="review-summary-item"><span>Disbursed Date</span><strong>{formatDate(form.startDate)}</strong></div>
          <div className="review-summary-item"><span>First Collection Date</span><strong>{formatDate(effectiveFirstDueDate)}</strong></div>
        </div>
      </ReviewModal>
    </div>
  );
}
