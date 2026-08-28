import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CalendarDays, Check, ExternalLink, FileText, HandCoins, Pencil, Phone, Save, ShieldCheck, Star, TrendingUp, Trash2, UserRound, WalletCards, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import ActionButton from '../../components/common/ActionButton';
import MediaUploader from '../../components/common/MediaUploader';
import ModuleHeader from '../../components/common/ModuleHeader';
import RecordLoanPaymentModal from '../../components/payments/RecordLoanPaymentModal';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatIndianMobile, toInputDate } from '../../utils/finance';
import './CustomerDetails.css';

function openDocument(document) {
  if (!document?.data) return;
  const popup = window.open();
  if (popup) popup.location.href = document.data;
}

function DetailRow({ label, value }) {
  return <div><dt>{label}</dt><dd>{value || '—'}</dd></div>;
}

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, loans, collections, payments, extendIoLoan, updatePayment, deletePayment, deleteCustomer, saveCustomerMedia, saveCustomerProfile, saveJaminProfile } = useCrednivo();
  const { hasPermission, isOwner } = useAuth();
  const [photoViewer, setPhotoViewer] = useState(null);
  const [payingLoan, setPayingLoan] = useState(null);
  const [extensionLoan, setExtensionLoan] = useState(null);
  const [extensionCycles, setExtensionCycles] = useState('1');
  const [extensionReason, setExtensionReason] = useState('');
  const [extensionSaving, setExtensionSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mediaEditor, setMediaEditor] = useState(null);
  const [mediaDraft, setMediaDraft] = useState({ photo: '', document: null });
  const [mediaSaving, setMediaSaving] = useState(false);
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({
    name: '',
    mobile: '',
    fatherName: '',
    date: '',
    work: '',
    address: '',
  });
  const [customerSaving, setCustomerSaving] = useState(false);
  const [jaminEditorOpen, setJaminEditorOpen] = useState(false);
  const [jaminDraft, setJaminDraft] = useState({
    jaminName: '',
    jaminMobile: '',
    jaminFatherName: '',
    jaminWork: '',
    jaminAddress: '',
  });
  const [jaminSaving, setJaminSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [transactionDraft, setTransactionDraft] = useState({
    amount: '0',
    interestAmount: '0',
    fine: '0',
    paymentDate: toInputDate(),
    paymentMode: 'Cash',
    note: '',
  });
  const [transactionBusy, setTransactionBusy] = useState(false);
  const customer = customers.find((item) => item.id === id);

  const canCorrectTransaction = (item) => (
    isOwner
    && item?.type === 'Collection'
    && !(item?.loanType === 'IO' && Number(item?.principalPaid || 0) > 0)
  );

  const openTransactionEditor = (item) => {
    if (!canCorrectTransaction(item)) return;
    setActionError('');
    setEditingTransaction(item);
    setTransactionDraft({
      amount: String(Number(item.collectionAmount || 0)),
      interestAmount: String(Number(item.interestPaid || 0)),
      fine: String(Number(item.fineAmount || 0)),
      paymentDate: item.date || toInputDate(),
      paymentMode: item.paymentMode || 'Cash',
      note: item.note || '',
    });
  };

  const closeTransactionEditor = () => {
    if (transactionBusy) return;
    setEditingTransaction(null);
  };

  const saveTransactionEdit = async () => {
    if (!editingTransaction || transactionBusy) return;
    const isIoTransaction = editingTransaction.loanType === 'IO';
    const received = isIoTransaction
      ? Number(transactionDraft.interestAmount || 0)
      : Number(transactionDraft.amount || 0);
    const fineReceived = Number(transactionDraft.fine || 0);

    if (received <= 0 && fineReceived <= 0) {
      setActionError('Enter an amount paid or a fine amount before saving.');
      return;
    }

    try {
      setTransactionBusy(true);
      setActionError('');
      await updatePayment(editingTransaction.id, {
        amount: isIoTransaction ? 0 : received,
        interestAmount: isIoTransaction ? received : 0,
        principalAmount: 0,
        fine: fineReceived,
        paymentDate: transactionDraft.paymentDate,
        paymentMode: transactionDraft.paymentMode,
        note: transactionDraft.note,
      });
      setEditingTransaction(null);
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not update the transaction.');
    } finally {
      setTransactionBusy(false);
    }
  };

  const confirmDeleteTransaction = async () => {
    if (!deletingTransaction || transactionBusy) return;
    try {
      setTransactionBusy(true);
      setActionError('');
      await deletePayment(deletingTransaction.id);
      setDeletingTransaction(null);
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not delete the transaction.');
    } finally {
      setTransactionBusy(false);
    }
  };

  if (!customer) {
    return <div className="empty-state module-card"><div><UserRound size={32}/><strong>Customer not found</strong><p>The requested customer is not available in this frontend data.</p></div></div>;
  }

  const customerLoans = loans.filter((loan) => loan.customerId === id);
  const activeCustomerLoans = customerLoans.filter((loan) => loan.status !== 'Closed' && Number(loan.outstanding) > 0);
  const customerLoanIds = new Set(customerLoans.map((loan) => loan.id));

  const paymentsForLoan = (loanId) => (payments || []).filter(
    (payment) => payment.loanId === loanId && payment.type === 'Collection' && payment.direction === 'in',
  );

  const upfrontInterestForLoan = (loan) => {
    if (!loan?.interestUpfront) return 0;
    if (loan.loanType === 'IO') return Number(loan.interestAmount || 0);
    return Number(loan.totalInterest ?? loan.interestAmount ?? 0);
  };

  const realizedLoanFigures = (loan) => {
    const loanPayments = paymentsForLoan(loan.id);
    const collectionCash = loanPayments.reduce((sum, payment) => sum + Number(payment.collectionAmount || 0), 0);
    const fineCollected = loanPayments.reduce((sum, payment) => sum + Number(payment.fineAmount || 0), 0);
    const upfrontInterest = upfrontInterestForLoan(loan);

    let interestFromPayments = 0;
    if (loan.loanType === 'IO') {
      interestFromPayments = loanPayments.reduce((sum, payment) => sum + Number(payment.interestPaid || 0), 0);
    } else if (!loan.interestUpfront) {
      const totalInterest = Math.max(0, Number(loan.totalInterest ?? loan.interestAmount ?? 0));
      const plannedRepayment = Math.max(0, Number(loan.principal || 0) + totalInterest);
      const interestShare = plannedRepayment > 0 ? totalInterest / plannedRepayment : 0;
      interestFromPayments = Math.min(totalInterest, collectionCash * interestShare);
    }

    const interestEarned = upfrontInterest + interestFromPayments;
    const profitEarned = interestEarned + fineCollected;

    // EMI upfront interest is deducted before disbursement, so it must not be
    // added again to the amount the customer actually repaid through collections.
    // Example: principal 5,000, upfront interest 1,000, collections 5,000
    // => Actual Repayment = 5,000 (not 6,000), Profit = 1,000.
    // IO keeps its existing realized-cash treatment because upfront IO interest
    // is a separate earned interest cycle in the IO settlement flow.
    const actualRepayment = loan.loanType === 'IO'
      ? upfrontInterest + collectionCash
      : collectionCash;

    const principalRepaid = loan.loanType === 'IO'
      ? loanPayments.reduce((sum, payment) => sum + Number(payment.principalPaid || 0), 0)
      : Math.min(
          Number(loan.principal || 0),
          Math.max(0, collectionCash - (loan.interestUpfront ? 0 : interestFromPayments)),
        );

    // Cancelled schedule entries are intentionally hidden from the live
    // Collection list after sync, so derive cancelled IO interest from the
    // loan's projected post-disbursement interest minus interest actually paid.
    // This also works after Owner extensions because totalRepayment is increased
    // by each added IO interest cycle.
    const projectedPostDisbursementInterest = loan.loanType === 'IO'
      ? Math.max(0, Number(loan.totalRepayment || 0) - Number(loan.principal || 0))
      : 0;
    const persistedCancelledInterest = Number(loan.cancelledInterestAmount || 0);
    const futureInterestCancelled = loan.loanType === 'IO' && loan.status === 'Closed'
      ? (persistedCancelledInterest > 0
          ? persistedCancelledInterest
          : Math.max(0, projectedPostDisbursementInterest - interestFromPayments))
      : 0;

    return {
      collectionCash,
      upfrontInterest,
      interestEarned,
      fineCollected,
      profitEarned,
      actualRepayment,
      principalRepaid,
      futureInterestCancelled,
    };
  };

  const customerProfitFigures = customerLoans.reduce(
    (summary, loan) => {
      const figures = realizedLoanFigures(loan);
      summary.interest += figures.interestEarned;
      summary.fine += figures.fineCollected;
      summary.profit += figures.profitEarned;
      return summary;
    },
    { interest: 0, fine: 0, profit: 0 },
  );

  const todayKey = toInputDate();
  const customerPendingDue = (collections || [])
    .filter((entry) => (entry.customerId === id || customerLoanIds.has(entry.loanId)) && entry.date <= todayKey)
    .reduce((sum, entry) => {
      const balance = Math.max(0, Number(entry.dueAmount || 0) - Number(entry.paidAmount || 0));
      return sum + balance;
    }, 0);
  const history = payments
    .filter((payment) => payment.customerId === id)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 8);

  // Customer-level figures must come from every active loan.
  // The customer record keeps some legacy summary fields, but those can become
  // stale when a second loan is created. Deriving here keeps multi-loan totals correct.
  const totalOutstanding = activeCustomerLoans.reduce((sum, loan) => sum + (Number(loan.outstanding) || 0), 0);
  const collectionByCycle = activeCustomerLoans.reduce((summary, loan) => {
    const cycle = loan.cycle || 'Other';
    summary[cycle] = (summary[cycle] || 0) + (Number(loan.collectionAmount) || 0);
    return summary;
  }, {});
  const cycleUnit = (cycle) => cycle === 'Daily' ? 'day' : cycle === 'Weekly' ? 'week' : cycle === 'Monthly' ? 'month' : cycle.toLowerCase();
  const collectionSummary = Object.entries(collectionByCycle)
    .map(([cycle, amount]) => `${formatCurrency(amount)} / ${cycleUnit(cycle)}`)
    .join(' + ');
  const nextCollectionDate = activeCustomerLoans
    .map((loan) => loan.nextDueDate)
    .filter(Boolean)
    .sort()[0] || customer.nextDueDate;

  const currentIoInterestPerCycle = (loan) => {
    if (!loan || loan.loanType !== 'IO') return Number(loan?.collectionAmount || 0);
    const principalBase = Number(loan.outstanding ?? loan.principalOutstanding ?? loan.principal ?? 0);
    return Math.max(0, principalBase * (Number(loan.interestRate || 0) / 100));
  };

  const currentIoProjectedRemaining = (loan) => {
    if (!loan || loan.loanType !== 'IO' || loan.status === 'Closed') return 0;
    const remainingInterest = (collections || [])
      .filter((entry) => entry.loanId === loan.id && String(entry.status || '').toLowerCase() !== 'cancelled')
      .reduce((sum, entry) => sum + Math.max(0, Number(entry.dueAmount || 0) - Number(entry.paidAmount || 0)), 0);
    return Number(loan.outstanding || 0) + remainingInterest;
  };

  const canEditMedia = hasPermission('customers.edit');

  const openCustomerEditor = () => {
    setCustomerDraft({
      name: customer.name || '',
      mobile: customer.mobile || '',
      fatherName: customer.fatherName || '',
      date: customer.date || toInputDate(),
      work: customer.work || '',
      address: customer.address || customer.area || '',
    });
    setCustomerEditorOpen(true);
    setActionError('');
  };

  const closeCustomerEditor = () => {
    if (customerSaving) return;
    setCustomerEditorOpen(false);
  };

  const saveCustomerDetails = async () => {
    if (customerSaving) return;
    if (!String(customerDraft.name || '').trim()) {
      setActionError('Customer name is required.');
      return;
    }
    const mobileDigits = String(customerDraft.mobile || '').replace(/\D/g, '');
    if (mobileDigits.length !== 10) {
      setActionError('Customer mobile must contain exactly 10 digits.');
      return;
    }

    setCustomerSaving(true);
    setActionError('');
    try {
      await saveCustomerProfile({
        ...customerDraft,
        mobile: mobileDigits,
        area: customerDraft.address,
        photo: customer.photo || '',
        customerDocument: customer.customerDocument || null,
      }, customer.id);
      setCustomerEditorOpen(false);
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not update the customer details.');
    } finally {
      setCustomerSaving(false);
    }
  };

  const openJaminEditor = () => {
    setJaminDraft({
      jaminName: customer.jaminName || '',
      jaminMobile: customer.jaminMobile || '',
      jaminFatherName: customer.jaminFatherName || '',
      jaminWork: customer.jaminWork || '',
      jaminAddress: customer.jaminAddress || '',
    });
    setJaminEditorOpen(true);
    setActionError('');
  };

  const closeJaminEditor = () => {
    if (jaminSaving) return;
    setJaminEditorOpen(false);
  };

  const saveJaminDetails = async () => {
    if (jaminSaving) return;

    if (!String(jaminDraft.jaminName || '').trim()) {
      setActionError('Jamin name is required.');
      return;
    }

    const mobileDigits = String(jaminDraft.jaminMobile || '').replace(/\D/g, '');
    if (mobileDigits.length !== 10) {
      setActionError('Jamin mobile must contain exactly 10 digits.');
      return;
    }

    setJaminSaving(true);
    setActionError('');

    try {
      await saveJaminProfile(customer.id, {
        ...jaminDraft,
        jaminMobile: mobileDigits,
        jaminPhoto: customer.jaminPhoto || '',
        jaminDocument: customer.jaminDocument || null,
      });
      setJaminEditorOpen(false);
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not update the Jamin details.');
    } finally {
      setJaminSaving(false);
    }
  };

  const openMediaEditor = (kind) => {
    const isJamin = kind === 'jamin';
    setMediaDraft({
      photo: isJamin ? (customer.jaminPhoto || '') : (customer.photo || ''),
      document: isJamin ? (customer.jaminDocument || null) : (customer.customerDocument || null),
    });
    setMediaEditor(kind);
    setActionError('');
  };

  const closeMediaEditor = () => {
    if (mediaSaving) return;
    setMediaEditor(null);
    setMediaDraft({ photo: '', document: null });
  };

  const saveMediaChanges = async () => {
    if (!mediaEditor || mediaSaving) return;
    const photoChanged = String(mediaDraft.photo || '').startsWith('data:');
    const documentChanged = String(mediaDraft.document?.data || '').startsWith('data:');
    if (!photoChanged && !documentChanged) {
      closeMediaEditor();
      return;
    }
    setMediaSaving(true);
    setActionError('');
    try {
      await saveCustomerMedia(customer.id, mediaEditor, mediaDraft);
      setMediaEditor(null);
      setMediaDraft({ photo: '', document: null });
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not save the customer media to the database.');
    } finally {
      setMediaSaving(false);
    }
  };

  const openLoanPayment = (loan) => {
    if (!loan || Number(loan.outstanding) <= 0 || loan.status === 'Closed') return;
    setActionError('');
    setPayingLoan(loan);
  };

  const closeLoanPayment = () => {
    setPayingLoan(null);
  };

  const openIoExtension = (loan) => {
    if (!isOwner || !loan || loan.loanType !== 'IO' || loan.status === 'Closed') return;
    setExtensionLoan(loan);
    setExtensionCycles('1');
    setExtensionReason('');
    setActionError('');
  };

  const closeIoExtension = () => {
    if (extensionSaving) return;
    setExtensionLoan(null);
    setExtensionCycles('1');
    setExtensionReason('');
  };

  const saveIoExtension = async () => {
    if (!extensionLoan || extensionSaving) return;
    const cycles = Math.max(0, Number(extensionCycles) || 0);
    if (cycles <= 0) {
      setActionError('Enter at least 1 extension cycle.');
      return;
    }
    if (!String(extensionReason || '').trim()) {
      setActionError('Enter the reason for extending this IO loan.');
      return;
    }

    setExtensionSaving(true);
    setActionError('');
    try {
      await extendIoLoan(extensionLoan.id, cycles, extensionReason);
      setExtensionLoan(null);
      setExtensionCycles('1');
      setExtensionReason('');
    } catch (apiError) {
      setActionError(apiError?.message || 'Could not extend the IO loan.');
    } finally {
      setExtensionSaving(false);
    }
  };


  return <div className="module-page customer-details-page">
    <ModuleHeader
      eyebrow={customer.id}
      title={customer.name}
      description={`${formatIndianMobile(customer.mobile)} · ${customer.work || customer.area || 'Customer'}`}
      actions={<>
        <ActionButton tone="secondary" icon={ArrowLeft} onClick={()=>navigate('/customers')}>Customers</ActionButton>
        {hasPermission('loans.create') && <ActionButton icon={WalletCards} onClick={()=>navigate('/loans/create',{state:{customerId:id}})}>New Loan</ActionButton>}
      </>}
    />

    {actionError && <div className="form-error">{actionError}</div>}

    <section className="customer-hero module-card">
      <div className="customer-hero-main">
        <button
          type="button"
          className={`customer-big-avatar ${customer.photo?'with-photo':''}`}
          onClick={()=>customer.photo&&setPhotoViewer({src:customer.photo,label:'Customer Photo'})}
          title={customer.photo?'View customer photo':'Customer profile'}
        >
          {customer.photo ? <img src={customer.photo} alt={customer.name}/> : customer.name.charAt(0)}
        </button>
        <div className="customer-hero-copy">
          <div className="customer-name-line"><h2>{customer.name}</h2><span className="soft-chip green">{customer.status}</span></div>
          <p><Phone size={15}/>{formatIndianMobile(customer.mobile)}</p>
          <p><CalendarDays size={15}/>Next collection {formatDate(nextCollectionDate)}</p>
        </div>
      </div>

      <div className="customer-rating">
        <Star size={18} fill="currentColor"/>
        <strong>{customer.rating}</strong>
        <span>Customer rating</span>
      </div>

      <div className="customer-finance-summary">
        <div className={`customer-finance-primary ${isOwner ? 'with-profit' : ''}`}>
          <div className="customer-outstanding">
            <span>Total Outstanding</span>
            <strong>{formatCurrency(totalOutstanding)}</strong>
            <small>Current collection {collectionSummary || 'No active collection'}</small>
          </div>

          {isOwner && <div className="customer-profit-card" title="Owner only">
            <div className="customer-profit-title">
              <TrendingUp size={15}/>
              <span>Profit Earned</span>
              <small>Owner only</small>
            </div>
            <strong>{formatCurrency(customerProfitFigures.profit)}</strong>
            <p>Interest {formatCurrency(customerProfitFigures.interest)} · Fine {formatCurrency(customerProfitFigures.fine)}</p>
          </div>}
        </div>

        <div className="customer-loan-summary-grid">
          <div>
            <span>Active Loans</span>
            <strong>{activeCustomerLoans.length}</strong>
          </div>
          <div>
            <span>Pending Due</span>
            <strong>{formatCurrency(customerPendingDue)}</strong>
          </div>
          <div>
            <span>All Loans</span>
            <strong>{customerLoans.length}</strong>
          </div>
        </div>
      </div>
    </section>

    <section className="detail-grid">
      <article className="detail-card module-card">
        <div className="detail-card-title detail-card-title-with-action">
          <div><UserRound size={19}/><h2>Customer Details</h2></div>
          {canEditMedia && <div className="detail-card-actions">
            <button type="button" className="detail-profile-edit-button" onClick={openCustomerEditor}>
              <Pencil size={14}/><span>Edit Details</span>
            </button>
            <button type="button" className="detail-media-edit-button" onClick={()=>openMediaEditor('customer')}>Add / Edit Media</button>
          </div>}
        </div>
        <dl>
          <DetailRow label="Customer ID" value={customer.id}/>
          <DetailRow label="Name" value={customer.name}/>
          <DetailRow label="Mobile" value={formatIndianMobile(customer.mobile)}/>
          <DetailRow label="Father’s Name" value={customer.fatherName}/>
          <DetailRow label="Date" value={customer.date ? formatDate(customer.date) : '—'}/>
          <DetailRow label="Work" value={customer.work}/>
          <DetailRow label="Address" value={customer.address || customer.area}/>
        </dl>
        <div className="detail-media-row">
          <button type="button" className={`detail-photo-tile ${!customer.photo&&canEditMedia?'can-add':''}`} onClick={()=>customer.photo?setPhotoViewer({src:customer.photo,label:'Customer Photo'}):canEditMedia&&openMediaEditor('customer')} disabled={!customer.photo&&!canEditMedia}>
            {customer.photo?<img src={customer.photo} alt="Customer"/>:<UserRound size={21}/>}<span>{customer.photo?'Profile Photo':'Add Profile Photo'}</span>
          </button>
          <button type="button" className={`detail-document-tile ${!customer.customerDocument?.data&&canEditMedia?'can-add':''}`} onClick={()=>customer.customerDocument?.data?openDocument(customer.customerDocument):canEditMedia&&openMediaEditor('customer')} disabled={!customer.customerDocument?.data&&!canEditMedia}>
            <FileText size={21}/><span>{customer.customerDocument?.name || (canEditMedia?'Add Document':'No document')}</span>{customer.customerDocument?.data&&<ExternalLink size={15}/>} 
          </button>
        </div>
      </article>

      <article className="detail-card module-card">
        <div className="detail-card-title detail-card-title-with-action">
          <div><ShieldCheck size={19}/><h2>Jamin Details</h2></div>
          {canEditMedia && <div className="detail-card-actions">
            <button type="button" className="detail-profile-edit-button" onClick={openJaminEditor}>
              <Pencil size={14}/><span>Edit Details</span>
            </button>
            {customer.jaminName && <button type="button" className="detail-media-edit-button" onClick={()=>openMediaEditor('jamin')}>Add / Edit Media</button>}
          </div>}
        </div>
        <dl>
          <DetailRow label="Name" value={customer.jaminName}/>
          <DetailRow label="Mobile" value={formatIndianMobile(customer.jaminMobile)}/>
          <DetailRow label="Father’s Name" value={customer.jaminFatherName}/>
          <DetailRow label="Work" value={customer.jaminWork}/>
          <DetailRow label="Address" value={customer.jaminAddress}/>
        </dl>
        <div className="detail-media-row">
          <button type="button" className={`detail-photo-tile ${!customer.jaminPhoto&&canEditMedia&&customer.jaminName?'can-add':''}`} onClick={()=>customer.jaminPhoto?setPhotoViewer({src:customer.jaminPhoto,label:'Jamin Photo'}):(canEditMedia&&customer.jaminName)&&openMediaEditor('jamin')} disabled={!customer.jaminPhoto&&(!canEditMedia||!customer.jaminName)}>
            {customer.jaminPhoto?<img src={customer.jaminPhoto} alt="Jamin"/>:<ShieldCheck size={21}/>}<span>{customer.jaminPhoto?'Jamin Photo':canEditMedia&&customer.jaminName?'Add Jamin Photo':'Jamin Photo'}</span>
          </button>
          <button type="button" className={`detail-document-tile ${!customer.jaminDocument?.data&&canEditMedia&&customer.jaminName?'can-add':''}`} onClick={()=>customer.jaminDocument?.data?openDocument(customer.jaminDocument):(canEditMedia&&customer.jaminName)&&openMediaEditor('jamin')} disabled={!customer.jaminDocument?.data&&(!canEditMedia||!customer.jaminName)}>
            <FileText size={21}/><span>{customer.jaminDocument?.name || (canEditMedia&&customer.jaminName?'Add Document':'No document')}</span>{customer.jaminDocument?.data&&<ExternalLink size={15}/>} 
          </button>
        </div>
      </article>
    </section>

    <section className="module-card customer-loans-section">
      <div className="detail-section-head"><h2>Loan Details</h2><span>{customerLoans.length} loan(s)</span></div>

      <div className="customer-loan-mobile-list">
        {customerLoans.length === 0 && <div className="customer-mobile-empty">No loans added yet.</div>}
        {customerLoans.map((loan) => {
          const realized = realizedLoanFigures(loan);
          return <article className="customer-loan-mobile-card" key={loan.id}>
          <div className="customer-loan-mobile-head">
            <div><span>Loan ID</span><strong>{loan.id}</strong></div>
            <div className="customer-loan-card-actions">
              <span className={`soft-chip ${loan.status==='Closed'?'gray':loan.status==='Overdue'?'red':'green'}`}>{loan.status}</span>
              {isOwner && loan.loanType === 'IO' && loan.status !== 'Closed' && Number(loan.outstanding) > 0 && <button
                type="button"
                className="customer-loan-extend-button"
                onClick={() => openIoExtension(loan)}
                title={`Extend ${loan.id}`}
              >
                <CalendarDays size={15}/>
                <span>Extend IO</span>
              </button>}
              {hasPermission('payments.record') && <button
                type="button"
                className="customer-loan-pay-button"
                onClick={() => openLoanPayment(loan)}
                disabled={loan.status === 'Closed' || Number(loan.outstanding) <= 0}
                title={loan.status === 'Closed' || Number(loan.outstanding) <= 0 ? 'Loan closed' : `Pay ${loan.id}`}
              >
                <HandCoins size={16}/>
                <span>Pay</span>
              </button>}
            </div>
          </div>
          <div className="customer-loan-mobile-amount">
            <span>Outstanding</span><strong>{formatCurrency(loan.outstanding)}</strong>
          </div>
          <div className="customer-loan-mobile-grid">
            <div><span>Loan Amount</span><strong>{formatCurrency(loan.principal)}</strong></div>
            <div><span>Given Amount</span><strong>{formatCurrency(loan.disbursedAmount)}</strong></div>
            <div><span>Cycle</span><strong>{loan.cycle}</strong></div>
            <div><span>Collection / Cycle</span><strong>{formatCurrency(loan.loanType === 'IO' ? currentIoInterestPerCycle(loan) : loan.collectionAmount)}</strong></div>
            <div><span>Loan Type</span><strong>{loan.loanType}</strong></div>
            <div><span>{loan.loanType === 'IO' ? 'Interest / Cycle' : 'Interest'}</span><strong>{loan.interestRate}% · {formatCurrency(loan.interestAmount ?? (loan.principal * (Number(loan.interestRate) || 0) / 100))}</strong></div>
            <div><span>Interest Taken</span><strong>{loan.interestUpfront?'Yes':'No'}</strong></div>
            <div><span>Fine</span><strong>{loan.fineEnabled ? formatCurrency(loan.fineAmount) : 'No'}</strong></div>
            <div><span>Disbursed</span><strong>{formatDate(loan.startDate)}</strong></div>
            <div><span>Duration</span><strong>{loan.duration} {loan.cycle==='Daily'?'days':loan.cycle==='Weekly'?'weeks':'months'}{loan.extensionCycles > 0 ? ` · +${loan.extensionCycles} extended` : ''}</strong></div>
            <div><span>{loan.loanType === 'IO' ? 'Projected Repayment' : 'Total Repayment'}</span><strong>{formatCurrency(loan.totalRepayment)}</strong></div>
            {loan.loanType === 'IO' && loan.status !== 'Closed' && Number(loan.outstanding) < Number(loan.principal) && <div className="loan-current-projection-item"><span>Current Projected Remaining</span><strong>{formatCurrency(currentIoProjectedRemaining(loan))}</strong></div>}
            {loan.status === 'Closed' && <div className="loan-actual-repayment-item"><span>Actual Repayment</span><strong>{formatCurrency(realized.actualRepayment)}</strong></div>}
          </div>

          {loan.status === 'Closed' && <div className="loan-closure-summary">
            <div className="loan-closure-summary-title">
              <strong>Closure Summary</strong>
              <span>Actual figures after loan closure</span>
            </div>
            <div className="loan-closure-summary-grid">
              <div><span>Actual Repayment</span><strong>{formatCurrency(realized.actualRepayment)}</strong></div>
              {loan.loanType === 'IO' && <div><span>Principal Repaid</span><strong>{formatCurrency(realized.principalRepaid)}</strong></div>}
              {loan.loanType === 'IO' && <div><span>Future Interest Cancelled</span><strong>{formatCurrency(realized.futureInterestCancelled)}</strong></div>}
              {realized.fineCollected > 0 && <div><span>Fine Collected</span><strong>{formatCurrency(realized.fineCollected)}</strong></div>}
              {isOwner && <div className="loan-owner-profit"><span>Profit Earned</span><strong>{formatCurrency(realized.profitEarned)}</strong><small>Interest {formatCurrency(realized.interestEarned)}{realized.fineCollected > 0 ? ` · Fine ${formatCurrency(realized.fineCollected)}` : ''}</small></div>}
            </div>
          </div>}
        </article>;
        })}
      </div>
    </section>

    <section className="module-card customer-payment-section">
      <div className="detail-section-head">
        <h2>Recent Payment History</h2>
        <span>{history.length} transactions</span>
      </div>
      <div className="module-table-wrap customer-detail-desktop-table">
        <table className="module-table">
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Note</th><th>Amount</th>
              {isOwner && <th className="transaction-action-heading">Action</th>}
            </tr>
          </thead>
          <tbody>{history.map((item) => {
            const canCorrect = canCorrectTransaction(item);
            return <tr key={item.id}>
              <td>{formatDate(item.date)}</td>
              <td>{item.type}</td>
              <td>{item.note}</td>
              <td className={item.direction==='in'?'money-in':'money-out'}>
                {item.direction==='in'?'+':'−'} {formatCurrency(item.amount)}
              </td>
              {isOwner && <td className="transaction-actions-cell">
                {canCorrect ? <div className="transaction-row-actions">
                  <button type="button" className="transaction-edit-button" onClick={()=>openTransactionEditor(item)} title="Edit transaction">
                    <Pencil size={14}/><span>Edit</span>
                  </button>
                  <button type="button" className="transaction-delete-button" onClick={()=>setDeletingTransaction(item)} title="Delete transaction">
                    <Trash2 size={14}/><span>Delete</span>
                  </button>
                </div> : <span className="transaction-locked-label">—</span>}
              </td>}
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="customer-payment-mobile-list">
        {history.length === 0 && <div className="customer-mobile-empty">No payment history yet.</div>}
        {history.map((item) => {
          const canCorrect = canCorrectTransaction(item);
          return <article className="customer-payment-mobile-card" key={item.id}>
            <div className="customer-payment-mobile-head">
              <strong>{item.type}</strong>
              <span className={item.direction==='in'?'money-in':'money-out'}>
                {item.direction==='in'?'+':'−'} {formatCurrency(item.amount)}
              </span>
            </div>
            <p>{item.note || 'Transaction'}</p>
            <small>{formatDate(item.date)}</small>
            {canCorrect && <div className="transaction-mobile-actions">
              <button type="button" className="transaction-edit-button" onClick={()=>openTransactionEditor(item)}>
                <Pencil size={14}/><span>Edit</span>
              </button>
              <button type="button" className="transaction-delete-button" onClick={()=>setDeletingTransaction(item)}>
                <Trash2 size={14}/><span>Delete</span>
              </button>
            </div>}
          </article>;
        })}
      </div>
    </section>

    {editingTransaction && <div className="transaction-editor-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&closeTransactionEditor()}>
      <section className="transaction-editor-modal" role="dialog" aria-modal="true" aria-label="Edit transaction">
        <div className="transaction-editor-head">
          <div>
            <strong>Edit Transaction</strong>
            <span>{editingTransaction.id} · {editingTransaction.loanId}</span>
          </div>
          <button type="button" onClick={closeTransactionEditor} disabled={transactionBusy} title="Close"><X size={18}/></button>
        </div>
        <div className="transaction-editor-body">
          <div className="transaction-editor-notice">
            <AlertTriangle size={17}/>
            <span>Saving recalculates the linked loan, collection balances, fine and outstanding automatically.</span>
          </div>
          <div className="transaction-editor-grid">
            <label>
              <span>Payment Date *</span>
              <input type="date" max={toInputDate()} value={transactionDraft.paymentDate}
                onChange={(event)=>setTransactionDraft((current)=>({...current,paymentDate:event.target.value}))}/>
            </label>
            {editingTransaction.loanType === 'IO' ? <label>
              <span>Interest Paid</span>
              <input type="number" min="0" step="0.01" value={transactionDraft.interestAmount}
                onChange={(event)=>setTransactionDraft((current)=>({...current,interestAmount:event.target.value}))}/>
            </label> : <label>
              <span>Amount Paid</span>
              <input type="number" min="0" step="0.01" value={transactionDraft.amount}
                onChange={(event)=>setTransactionDraft((current)=>({...current,amount:event.target.value}))}/>
            </label>}
            <label>
              <span>Fine Paid</span>
              <input type="number" min="0" step="0.01" value={transactionDraft.fine}
                onChange={(event)=>setTransactionDraft((current)=>({...current,fine:event.target.value}))}/>
            </label>
            <label>
              <span>Payment Mode</span>
              <select value={transactionDraft.paymentMode}
                onChange={(event)=>setTransactionDraft((current)=>({...current,paymentMode:event.target.value}))}>
                <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
              </select>
            </label>
            <label className="transaction-editor-note">
              <span>Note</span>
              <input type="text" value={transactionDraft.note}
                onChange={(event)=>setTransactionDraft((current)=>({...current,note:event.target.value}))}
                placeholder="Optional transaction note"/>
            </label>
          </div>
        </div>
        <div className="transaction-editor-actions">
          <button type="button" className="transaction-cancel-button" onClick={closeTransactionEditor} disabled={transactionBusy}>Cancel</button>
          <button type="button" className="transaction-save-button" onClick={saveTransactionEdit} disabled={transactionBusy}>
            <Save size={16}/><span>{transactionBusy?'Saving...':'Save Changes'}</span>
          </button>
        </div>
      </section>
    </div>}

    {deletingTransaction && <div className="transaction-editor-backdrop">
      <section className="transaction-delete-modal" role="dialog" aria-modal="true" aria-label="Delete transaction">
        <span className="transaction-delete-icon"><Trash2 size={22}/></span>
        <h2>Delete this transaction?</h2>
        <p>{formatDate(deletingTransaction.date)} · {deletingTransaction.note || deletingTransaction.type}</p>
        <strong>{formatCurrency(deletingTransaction.amount)}</strong>
        <small>The linked loan and collection balances will be recalculated automatically. This action cannot be undone.</small>
        <div>
          <button type="button" className="transaction-cancel-button" onClick={()=>!transactionBusy&&setDeletingTransaction(null)} disabled={transactionBusy}>Cancel</button>
          <button type="button" className="transaction-confirm-delete-button" onClick={confirmDeleteTransaction} disabled={transactionBusy}>
            <Trash2 size={16}/><span>{transactionBusy?'Deleting...':'Delete Transaction'}</span>
          </button>
        </div>
      </section>
    </div>}

    {hasPermission('customers.delete') && <section className="customer-danger-zone module-card">
      <div className="customer-danger-copy">
        <span className="customer-danger-icon"><Trash2 size={20}/></span>
        <div>
          <h2>Delete Customer</h2>
          <p>Permanently remove this customer and all linked loans, collections, payment history and customer documents.</p>
        </div>
      </div>
      <button type="button" className="customer-delete-button" onClick={()=>setDeleteConfirmOpen(true)}>
        <Trash2 size={17}/><span>Delete Customer</span>
      </button>
    </section>}

    {customerEditorOpen && <div className="customer-profile-editor-backdrop" onMouseDown={closeCustomerEditor}>
      <div className="customer-profile-editor-modal" onMouseDown={(event)=>event.stopPropagation()}>
        <div className="customer-profile-editor-head">
          <div>
            <strong>Edit Customer Details</strong>
            <span>{customer.id} · Changes are saved only after clicking Save Details</span>
          </div>
          <button type="button" onClick={closeCustomerEditor} disabled={customerSaving} title="Close"><X size={18}/></button>
        </div>

        <div className="customer-profile-editor-body">
          <div className="customer-profile-editor-grid">
            <label>
              <span>Name *</span>
              <input
                autoFocus
                type="text"
                value={customerDraft.name}
                onChange={(event)=>setCustomerDraft((current)=>({...current,name:event.target.value}))}
                placeholder="Customer name"
              />
            </label>
            <label>
              <span>Mobile *</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={customerDraft.mobile}
                onChange={(event)=>setCustomerDraft((current)=>({...current,mobile:event.target.value.replace(/\D/g,'').slice(0,10)}))}
                placeholder="10 digit mobile number"
              />
            </label>
            <label>
              <span>Father’s Name</span>
              <input
                type="text"
                value={customerDraft.fatherName}
                onChange={(event)=>setCustomerDraft((current)=>({...current,fatherName:event.target.value}))}
                placeholder="Father's name"
              />
            </label>
            <label>
              <span>Date</span>
              <input
                type="date"
                value={customerDraft.date}
                onChange={(event)=>setCustomerDraft((current)=>({...current,date:event.target.value}))}
              />
            </label>
            <label>
              <span>Work</span>
              <input
                type="text"
                value={customerDraft.work}
                onChange={(event)=>setCustomerDraft((current)=>({...current,work:event.target.value}))}
                placeholder="Work / occupation"
              />
            </label>
            <label className="customer-profile-editor-address">
              <span>Address</span>
              <textarea
                rows="4"
                value={customerDraft.address}
                onChange={(event)=>setCustomerDraft((current)=>({...current,address:event.target.value}))}
                placeholder="Customer address"
              />
            </label>
          </div>
        </div>

        <div className="customer-profile-editor-actions">
          <button type="button" className="customer-profile-editor-cancel" onClick={closeCustomerEditor} disabled={customerSaving}>Cancel</button>
          <button type="button" className="customer-profile-editor-save" onClick={saveCustomerDetails} disabled={customerSaving}>
            <Check size={16}/><span>{customerSaving?'Saving...':'Save Details'}</span>
          </button>
        </div>
      </div>
    </div>}

    {jaminEditorOpen && <div className="customer-profile-editor-backdrop" onMouseDown={closeJaminEditor}>
      <div className="customer-profile-editor-modal" onMouseDown={(event)=>event.stopPropagation()}>
        <div className="customer-profile-editor-head">
          <div>
            <strong>Edit Jamin Details</strong>
            <span>{customer.id} · Changes are saved only after clicking Save Details</span>
          </div>
          <button type="button" onClick={closeJaminEditor} disabled={jaminSaving} title="Close"><X size={18}/></button>
        </div>

        <div className="customer-profile-editor-body">
          <div className="customer-profile-editor-grid">
            <label>
              <span>Name *</span>
              <input
                autoFocus
                type="text"
                value={jaminDraft.jaminName}
                onChange={(event)=>setJaminDraft((current)=>({...current,jaminName:event.target.value}))}
                placeholder="Jamin name"
              />
            </label>

            <label>
              <span>Mobile *</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={jaminDraft.jaminMobile}
                onChange={(event)=>setJaminDraft((current)=>({...current,jaminMobile:event.target.value.replace(/\D/g,'').slice(0,10)}))}
                placeholder="10 digit mobile number"
              />
            </label>

            <label>
              <span>Father’s Name</span>
              <input
                type="text"
                value={jaminDraft.jaminFatherName}
                onChange={(event)=>setJaminDraft((current)=>({...current,jaminFatherName:event.target.value}))}
                placeholder="Father's name"
              />
            </label>

            <label>
              <span>Work</span>
              <input
                type="text"
                value={jaminDraft.jaminWork}
                onChange={(event)=>setJaminDraft((current)=>({...current,jaminWork:event.target.value}))}
                placeholder="Work / occupation"
              />
            </label>

            <label className="customer-profile-editor-address">
              <span>Address</span>
              <textarea
                rows="4"
                value={jaminDraft.jaminAddress}
                onChange={(event)=>setJaminDraft((current)=>({...current,jaminAddress:event.target.value}))}
                placeholder="Jamin address"
              />
            </label>
          </div>
        </div>

        <div className="customer-profile-editor-actions">
          <button type="button" className="customer-profile-editor-cancel" onClick={closeJaminEditor} disabled={jaminSaving}>Cancel</button>
          <button type="button" className="customer-profile-editor-save" onClick={saveJaminDetails} disabled={jaminSaving}>
            <Check size={16}/><span>{jaminSaving?'Saving...':'Save Details'}</span>
          </button>
        </div>
      </div>
    </div>}

    {mediaEditor && <div className="customer-media-editor-backdrop" onMouseDown={closeMediaEditor}>
      <div className="customer-media-editor-modal" onMouseDown={(event)=>event.stopPropagation()}>
        <div className="customer-media-editor-head">
          <div>
            <strong>{mediaEditor==='jamin'?'Jamin':'Customer'} Photo & Document</strong>
            <span>{customer.id} · {mediaEditor==='jamin'?(customer.jaminName||'Jamin'):customer.name}</span>
          </div>
          <button type="button" onClick={closeMediaEditor} disabled={mediaSaving} title="Close"><X size={18}/></button>
        </div>
        <div className="customer-media-editor-body">
          <MediaUploader
            title={mediaEditor==='jamin'?'Jamin':'Customer'}
            photo={mediaDraft.photo}
            document={mediaDraft.document}
            onPhotoChange={(value)=>setMediaDraft((current)=>({...current,photo:value}))}
            onDocumentChange={(value)=>setMediaDraft((current)=>({...current,document:value}))}
          />
        </div>
        <div className="customer-media-editor-actions">
          <button type="button" className="customer-media-editor-cancel" onClick={closeMediaEditor} disabled={mediaSaving}>Cancel</button>
          <button type="button" className="customer-media-editor-save" onClick={saveMediaChanges} disabled={mediaSaving}>
            <Check size={16}/><span>{mediaSaving?'Saving...':'Save Media'}</span>
          </button>
        </div>
      </div>
    </div>}

    {hasPermission('customers.delete') && deleteConfirmOpen && <div className="customer-delete-backdrop" onMouseDown={()=>setDeleteConfirmOpen(false)}>
      <div className="customer-delete-modal" onMouseDown={(event)=>event.stopPropagation()}>
        <div className="customer-delete-modal-icon"><AlertTriangle size={24}/></div>
        <h2>Delete {customer.name}?</h2>
        <p>This will permanently remove <strong>{customer.id}</strong>, {customerLoans.length} loan(s), collection records, payment history and uploaded customer/Jamin documents.</p>
        <div className="customer-delete-modal-actions">
          <button type="button" className="customer-delete-cancel" onClick={()=>setDeleteConfirmOpen(false)}>Cancel</button>
          <button type="button" className="customer-delete-confirm" onClick={async()=>{
            setActionError('');
            try {
              const deleted = await deleteCustomer(customer.id);
              if (deleted) navigate('/customers', { replace: true });
            } catch (apiError) {
              setDeleteConfirmOpen(false);
              setActionError(apiError?.message || 'Could not delete the customer from the database.');
            }
          }}>
            <Trash2 size={16}/><span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>}

    {extensionLoan && <div className="customer-io-extension-backdrop" onMouseDown={()=>!extensionSaving&&closeIoExtension()}>
      <div className="customer-io-extension-modal" onMouseDown={(event)=>event.stopPropagation()}>
        <div className="customer-loan-pay-head">
          <div>
            <strong>Extend IO Loan</strong>
            <span>{extensionLoan.id} · Owner only</span>
          </div>
          <button type="button" className="customer-loan-pay-close" onClick={closeIoExtension} disabled={extensionSaving} title="Close"><X size={18}/></button>
        </div>

        <div className="io-extension-summary">
          <div><span>Current Duration</span><strong>{extensionLoan.duration} {extensionLoan.cycle === 'Daily' ? 'days' : extensionLoan.cycle === 'Weekly' ? 'weeks' : 'months'}</strong></div>
          <div><span>Interest / Cycle</span><strong>{formatCurrency(extensionLoan.collectionAmount)}</strong></div>
          <div><span>Principal Outstanding</span><strong>{formatCurrency(extensionLoan.outstanding)}</strong></div>
        </div>

        <div className="customer-loan-pay-fields">
          <label>
            <span>Extension Cycles *</span>
            <input autoFocus type="number" min="1" max="260" value={extensionCycles} onChange={(event)=>setExtensionCycles(event.target.value)}/>
            <small>New duration: {(Number(extensionLoan.duration) || 0) + (Number(extensionCycles) || 0)} cycles</small>
          </label>
          <label>
            <span>Additional Projected Interest</span>
            <input type="text" readOnly value={formatCurrency((Number(extensionLoan.collectionAmount) || 0) * (Number(extensionCycles) || 0))}/>
          </label>
          <label className="customer-loan-extension-reason">
            <span>Reason *</span>
            <textarea rows="3" value={extensionReason} onChange={(event)=>setExtensionReason(event.target.value)} placeholder="Example: Customer requested more time to return principal"/>
          </label>
        </div>

        <div className="io-extension-rule">
          Extension adds interest cycles only. Principal does not increase. If the customer closes early later, only principal + already-due/pending interest is collected.
        </div>

        <button type="button" className="customer-loan-save-payment" onClick={saveIoExtension} disabled={extensionSaving || Number(extensionCycles)<=0 || !String(extensionReason).trim()}>
          <Check size={17}/><span>{extensionSaving ? 'Extending...' : 'Confirm Extension'}</span>
        </button>
      </div>
    </div>}

    <RecordLoanPaymentModal
      open={Boolean(payingLoan)}
      loan={payingLoan}
      customerName={customer.name}
      customerId={customer.id}
      scheduledAmount={payingLoan?.collectionAmount}
      initialAmount={
        payingLoan
          ? Math.min(
              Number(payingLoan.collectionAmount || 0),
              Number(payingLoan.outstanding || 0),
            ) || Number(payingLoan.outstanding || 0)
          : 0
      }
      initialFine={0}
      title="Record Collection"
      onClose={closeLoanPayment}
    />

    {photoViewer && <div className="customer-photo-viewer" onMouseDown={(event)=>event.target===event.currentTarget&&setPhotoViewer(null)}>
      <button type="button" onClick={()=>setPhotoViewer(null)} title="Close"><X size={21}/></button>
      <div><img src={photoViewer.src} alt={photoViewer.label}/><span>{photoViewer.label}</span></div>
    </div>}
  </div>;
}
