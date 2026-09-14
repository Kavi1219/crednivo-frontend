import { useMemo, useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import MediaUploader from '../../components/common/MediaUploader';
import ModuleHeader from '../../components/common/ModuleHeader';
import ReviewModal from '../../components/common/ReviewModal';
import LoanPreview from '../../components/loan/LoanPreview';
import LoanSetupFields from '../../components/loan/LoanSetupFields';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { calculateLoan, formatCurrency, formatDate, formatIndianMobile, formatIndianMobileLocal, getFirstDueDate, isValidIndianMobile, normalizeIndianMobile, toInputDate } from '../../utils/finance';
import './NewCustomer.css';

const initial = {
  name: '', mobile: '', fatherName: '', date: toInputDate(), work: '', address: '', photo: '', customerDocument: null, customerDocuments: [],
  jaminName: '', jaminMobile: '', jaminFatherName: '', jaminWork: '', jaminAddress: '', jaminPhoto: '', jaminDocument: null, jaminDocuments: [],
  amount: 10000, cycle: 'Daily', loanType: 'EMI', interestRate: 15,
  duration: 100, interestUpfront: false, fineEnabled: false, fineAmount: 0, documentChargeEnabled: false, documentChargeAmount: 0, startDate: toInputDate(),
};

function nextPreviewId(prefix, list, pad) {
  const highest = list.reduce((max, item) => {
    const match = String(item.id || '').match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefix}${String(highest + 1).padStart(pad, '0')}`;
}

function cycleSummary(startDate, cycle) {
  const dueDate = getFirstDueDate(startDate, cycle);
  if (!dueDate) return 'Select a valid disbursed date';

  const due = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(due.getTime())) return 'Select a valid disbursed date';

  if (cycle === 'Weekly') {
    return `Weekly · Every ${new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(due)}`;
  }
  if (cycle === 'Monthly') return `Monthly · Pay date ${due.getDate()}`;
  return `Daily · First pay ${formatDate(dueDate)}`;
}

export default function NewCustomer() {
  const actionLocksRef = useRef(new Set());

  const { saveCustomerProfile, saveJaminProfile, addLoan, customers, loans } = useCrednivo();
  const { hasPermission } = useAuth();
  const canCreateLoan = hasPermission('loans.create');
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(null);
  const [savedCustomerId, setSavedCustomerId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const terms = useMemo(() => calculateLoan(form), [form]);
  const previewCustomerId = useMemo(() => nextPreviewId('SFC-', customers, 4), [customers]);
  const customerId = savedCustomerId || previewCustomerId;
  const loanId = useMemo(() => nextPreviewId('SFCLN-', loans, 5), [loans]);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const validateCustomer = () => {
    if (!form.name.trim() || !isValidIndianMobile(form.mobile) || !form.fatherName.trim() || !form.date || !form.work.trim() || !form.address.trim()) {
      setError('Complete all Customer Details and enter a valid 10-digit Indian mobile number.');
      return false;
    }
    setError('');
    return true;
  };

  const validateJamin = () => {
    if (!form.jaminName.trim() || !isValidIndianMobile(form.jaminMobile) || !form.jaminFatherName.trim() || !form.jaminWork.trim() || !form.jaminAddress.trim()) {
      setError('Complete all Jamin Details and enter a valid 10-digit Indian mobile number.');
      return false;
    }
    setError('');
    return true;
  };

  const validateLoan = () => {
    if (Number(form.amount) <= 0 || Number(form.duration) <= 0 || Number(form.interestRate) < 0 || !form.startDate) {
      setError('Enter a valid Loan Amount, Interest Rate, manual Duration and Disbursed Date.');
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
  const saveJaminStep = () => {
    if (!validateJamin()) return;
    setReview('jamin');
  };
  const addLoanStep = () => {
    if (!validateLoan()) return;
    setReview('loan');
  };

  const confirmReview = async () => {
    if (actionLocksRef.current.has('confirmReview')) return;
    actionLocksRef.current.add('confirmReview');
    try {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      if (review === 'customer') {
        const id = await saveCustomerProfile(form, savedCustomerId);
        setSavedCustomerId(id);
        setReview(null);
        setStep(1);
        return;
      }
      if (review === 'jamin') {
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
      setError(apiError?.message || 'Could not save to the CREDNIVO database. Check that the backend is running.');
      setReview(null);
    } finally {
      setSaving(false);
    }
  
    } finally {
      actionLocksRef.current.delete('confirmReview');
    }
  };

  const steps = [
    { label: 'Customer', icon: UserRound },
    { label: 'Jamin', icon: ShieldCheck },
    ...(canCreateLoan ? [{ label: 'Loan', icon: WalletCards }] : []),
  ];

  return (
    <div className="module-page new-customer-page">
      <ModuleHeader eyebrow="New Customer" title="Customer Onboarding" description={canCreateLoan ? "Save Customer Details, verify Jamin, then add the first loan. Each step has a review before it is confirmed." : "Save Customer Details and verify Jamin. Loan creation is not enabled for this account."} />

      <section className="onboarding-stepper module-card">
        {steps.map((item, index) => {
          const Icon = item.icon;
          const state = index < step ? 'done' : index === step ? 'active' : '';
          return <button key={item.label} type="button" className={`onboarding-step ${state}`} onClick={() => index <= step && setStep(index)} disabled={index > step}>
            <span className="onboarding-step-icon">{index < step ? <CheckCircle2 size={18}/> : <Icon size={18}/>}</span>
            <span><small>Step {index + 1}</small><strong>{item.label}</strong></span>
          </button>;
        })}
      </section>

      {error && <div className="form-error">{error}</div>}

      {step === 0 && <section className="form-card module-card onboarding-panel">
        <div className="form-section">
          <div className="form-section-head"><span className="form-section-icon"><UserRound size={19}/></span><div><h2>Customer Details</h2><p>Customer identity, profile photo and supporting document</p></div></div>
          <div className="onboarding-media-grid">
            <MediaUploader
              mode="photo"
              title="Customer"
              photo={form.photo}
              onPhotoChange={(value) => change('photo', value)}
            />
            <MediaUploader
              mode="document"
              title="Customer"
              documents={form.customerDocuments}
              onDocumentsChange={(value) => setForm((current) => ({ ...current, customerDocuments: value, customerDocument: value[0] || null }))}
            />
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Name *</label><input value={form.name} onChange={(e)=>change('name',e.target.value)} placeholder="Customer full name"/></div>
            <div className="form-field"><label>Mobile *</label><div className="indian-mobile-input"><span>+91 -</span><input value={formatIndianMobileLocal(form.mobile)} onChange={(e)=>change('mobile',normalizeIndianMobile(e.target.value))} inputMode="numeric" autoComplete="tel" placeholder="98765 43210"/></div></div>
            <div className="form-field"><label>Father’s Name *</label><input value={form.fatherName} onChange={(e)=>change('fatherName',e.target.value)} placeholder="Father's name"/></div>
            <div className="form-field"><label>Date *</label><input type="date" value={form.date} onChange={(e)=>change('date',e.target.value)}/></div>
            <div className="form-field span-2"><label>Work *</label><input value={form.work} onChange={(e)=>change('work',e.target.value)} placeholder="Occupation / work"/></div>
            <div className="form-field full"><label>Address *</label><textarea value={form.address} onChange={(e)=>change('address',e.target.value)} placeholder="Full address"/></div>
          </div>
          <div className="onboarding-actions"><ActionButton type="button" icon={ArrowRight} onClick={saveCustomerStep}>Save Customer Details</ActionButton></div>
        </div>
      </section>}

      {step === 1 && <section className="form-card module-card onboarding-panel">
        <div className="form-section">
          <div className="form-section-head"><span className="form-section-icon"><ShieldCheck size={19}/></span><div><h2>Jamin Details</h2><p>Guarantor profile linked to {customerId}</p></div></div>
          <div className="onboarding-media-grid">
            <MediaUploader
              mode="photo"
              title="Jamin"
              photo={form.jaminPhoto}
              onPhotoChange={(value) => change('jaminPhoto', value)}
            />
            <MediaUploader
              mode="document"
              title="Jamin"
              documents={form.jaminDocuments}
              onDocumentsChange={(value) => setForm((current) => ({ ...current, jaminDocuments: value, jaminDocument: value[0] || null }))}
            />
          </div>
          <div className="form-grid">
            <div className="form-field"><label>Name *</label><input value={form.jaminName} onChange={(e)=>change('jaminName',e.target.value)} placeholder="Jamin full name"/></div>
            <div className="form-field"><label>Mobile *</label><div className="indian-mobile-input"><span>+91 -</span><input value={formatIndianMobileLocal(form.jaminMobile)} onChange={(e)=>change('jaminMobile',normalizeIndianMobile(e.target.value))} inputMode="numeric" autoComplete="tel" placeholder="98765 43210"/></div></div>
            <div className="form-field"><label>Father’s Name *</label><input value={form.jaminFatherName} onChange={(e)=>change('jaminFatherName',e.target.value)} placeholder="Father's name"/></div>
            <div className="form-field span-2"><label>Work *</label><input value={form.jaminWork} onChange={(e)=>change('jaminWork',e.target.value)} placeholder="Occupation / work"/></div>
            <div className="form-field full"><label>Address *</label><textarea value={form.jaminAddress} onChange={(e)=>change('jaminAddress',e.target.value)} placeholder="Full address"/></div>
          </div>
          <div className="onboarding-actions split"><ActionButton type="button" tone="secondary" icon={ArrowLeft} onClick={()=>setStep(0)}>Customer</ActionButton><ActionButton type="button" icon={ArrowRight} onClick={saveJaminStep}>Save Jamin Details</ActionButton></div>
        </div>
      </section>}

      {step === 2 && <>
        <section className="form-card module-card onboarding-panel">
          <div className="form-section">
            <div className="form-section-head"><span className="form-section-icon"><WalletCards size={19}/></span><div><h2>Loan Details</h2><p>Manual duration with automatic loan calculations</p></div></div>
            <LoanSetupFields form={form} change={change} />
            <div className="onboarding-actions split"><ActionButton type="button" tone="secondary" icon={ArrowLeft} onClick={()=>setStep(1)}>Jamin</ActionButton></div>
          </div>
        </section>
        <LoanPreview form={form} terms={terms}>
          <ActionButton icon={CheckCircle2} type="button" className="loan-add-button" onClick={addLoanStep}>Add Loan</ActionButton>
        </LoanPreview>
      </>}

      <ReviewModal
        open={review === 'customer'}
        title="Review Customer Details"
        subtitle="Check every detail before saving and moving to Jamin."
        badge={customerId}
        icon={UserRound}
        onClose={()=>setReview(null)}
        onConfirm={confirmReview}
        busy={saving}
        confirmLabel={saving ? "Saving..." : "Confirm & Continue to Jamin"}
      >
        <div className="review-person"><span className="review-person-photo">{form.photo ? <img src={form.photo} alt="Customer"/> : form.name.charAt(0)?.toUpperCase()}</span><div><strong>{form.name}</strong><small>{formatIndianMobile(form.mobile)} · {form.work}</small></div></div>
        <div className="review-summary-grid">
          <div className="review-summary-item accent"><span>Customer ID</span><strong>{customerId}</strong></div>
          <div className="review-summary-item"><span>Father’s Name</span><strong>{form.fatherName}</strong></div>
          <div className="review-summary-item"><span>Date</span><strong>{formatDate(form.date)}</strong></div>
          <div className="review-summary-item"><span>Documents</span><strong>{form.customerDocuments?.length ? `${form.customerDocuments.length} added` : 'Not added'}</strong></div>
          <div className="review-summary-item full"><span>Address</span><strong>{form.address}</strong></div>
        </div>
      </ReviewModal>

      <ReviewModal
        open={review === 'jamin'}
        title="Review Jamin Details"
        subtitle={`Confirm guarantor details linked to ${customerId}.`}
        badge={customerId}
        icon={ShieldCheck}
        onClose={()=>setReview(null)}
        onConfirm={confirmReview}
        busy={saving}
        confirmLabel={saving ? "Saving..." : "Confirm & Continue to Loan"}
      >
        <div className="review-person"><span className="review-person-photo">{form.jaminPhoto ? <img src={form.jaminPhoto} alt="Jamin"/> : form.jaminName.charAt(0)?.toUpperCase()}</span><div><strong>{form.jaminName}</strong><small>{formatIndianMobile(form.jaminMobile)} · {form.jaminWork}</small></div></div>
        <div className="review-summary-grid">
          <div className="review-summary-item"><span>Father’s Name</span><strong>{form.jaminFatherName}</strong></div>
          <div className="review-summary-item"><span>Documents</span><strong>{form.jaminDocuments?.length ? `${form.jaminDocuments.length} added` : 'Not added'}</strong></div>
          <div className="review-summary-item full"><span>Address</span><strong>{form.jaminAddress}</strong></div>
        </div>
      </ReviewModal>

      <ReviewModal
        open={review === 'loan'}
        title="Review Loan Summary"
        subtitle="Confirm the repayment setup before adding the first loan."
        badge={loanId}
        icon={WalletCards}
        onClose={()=>setReview(null)}
        onConfirm={confirmReview}
        busy={saving}
        confirmLabel={saving ? "Saving..." : "Confirm & Add Loan"}
      >
        <div className="review-summary-grid">
          <div className="review-summary-item accent"><span>Loan ID</span><strong>{loanId}</strong></div>
          <div className="review-summary-item accent"><span>Loan Amount</span><strong>{formatCurrency(terms.principal)}</strong></div>
          <div className="review-summary-item full"><span>Cycle / Pay Schedule</span><strong>{cycleSummary(form.startDate, form.cycle)}</strong></div>
          <div className="review-summary-item"><span>Loan Type</span><strong>{form.loanType}</strong></div>
          <div className="review-summary-item"><span>{form.loanType === 'IO' ? 'Interest / Cycle' : 'Interest'}</span><strong>{form.interestRate}% · {formatCurrency(terms.interestAmount)}</strong></div>
          <div className="review-summary-item"><span>Interest Taken</span><strong>{form.interestUpfront ? 'Yes' : 'No'}</strong></div>
          <div className="review-summary-item"><span>Fine</span><strong>{form.fineEnabled ? `Yes · ${formatCurrency(form.fineAmount)}` : 'No'}</strong></div>
          <div className="review-summary-item"><span>Document Charges</span><strong>{form.documentChargeEnabled ? `Yes · ${formatCurrency(form.documentChargeAmount)}` : 'No'}</strong></div>
          <div className="review-summary-item"><span>Given Amount</span><strong>{formatCurrency(terms.disbursedAmount)}</strong></div>
          <div className="review-summary-item"><span>Collection / Cycle</span><strong>{formatCurrency(terms.collectionAmount)}</strong></div>
          {form.loanType === 'IO' && <div className="review-summary-item"><span>Principal Outstanding</span><strong>{formatCurrency(terms.initialOutstanding)}</strong></div>}
          <div className="review-summary-item"><span>{form.loanType === 'IO' ? 'Projected Repayment' : 'Total Repayment'}</span><strong>{formatCurrency(terms.totalRepayment)}</strong></div>
          <div className="review-summary-item"><span>Duration</span><strong>{terms.duration} {form.cycle === 'Daily' ? 'days' : form.cycle === 'Weekly' ? 'weeks' : 'months'}</strong></div>
          <div className="review-summary-item full"><span>Disbursed Date</span><strong>{formatDate(form.startDate)}</strong></div>
        </div>
      </ReviewModal>
    </div>
  );
}
