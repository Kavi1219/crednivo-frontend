import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { calculateLoan, getFirstDueDate, normalizeIndianMobile, toInputDate } from '../utils/finance';
import { apiRequest, mediaUrl, uploadAgentPhoto, uploadCompanyLogo, uploadCustomerDocument, uploadProfilePhoto, uploadVaultDocument } from '../services/api';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'crednivo-phase2-data';
const UI_SETTINGS_KEY = 'crednivo-ui-settings';
const SINGLE_CUSTOMER_CLEANUP_KEY = 'crednivo-phase2-22-single-customer-cleanup';
const IO_ACCOUNTING_MIGRATION_KEY = 'crednivo-phase9-0-29-io-principal-reprice-repair';

const defaultUiSettings = { theme: 'system', language: 'en' };

function loadUiSettings() {
  try {
    const saved = localStorage.getItem(UI_SETTINGS_KEY);
    return saved ? { ...defaultUiSettings, ...JSON.parse(saved) } : defaultUiSettings;
  } catch {
    return defaultUiSettings;
  }
}

const seedData = {
  company: {
    name: 'CREDNIVO',
    owner: '',
    branch: '',
    mobile: '',
    email: '',
    address: '',
  },
  customers: [
    { id: 'SFC-0001', name: 'Ravi Kumar', mobile: '98765 21001', area: 'Pallipalayam', cycle: 'Daily', status: 'Active', loanId: 'SFCLN-00001', outstanding: 72000, collectionAmount: 1000, nextDueDate: toInputDate(), rating: 4.8, jaminName: 'Kumar S', jaminMobile: '98765 31001' },
  ],

  loans: [
    { id: 'SFCLN-00001', customerId: 'SFC-0001', customerName: 'Ravi Kumar', cycle: 'Daily', loanType: 'EMI', principal: 80000, disbursedAmount: 80000, interestRate: 25, totalRepayment: 100000, collectionAmount: 1000, outstanding: 72000, duration: 100, startDate: '2026-08-10', nextDueDate: toInputDate(), status: 'Active', interestUpfront: false },
  ],

  collections: [
    { id: 'COL-1001', customerId: 'SFC-0001', customerName: 'Ravi Kumar', loanId: 'SFCLN-00001', cycle: 'Daily', dueAmount: 1000, paidAmount: 0, fine: 0, status: 'Due Today', date: toInputDate() },
  ],

  payments: [
    { id: 'PAY-2001', type: 'New Loan', customerId: 'SFC-0001', customerName: 'Ravi Kumar', loanId: 'SFCLN-00001', amount: 80000, direction: 'out', date: '2026-08-10', note: 'Daily EMI loan disbursement' },
  ],

  capital: [],
  savings: [],
  expenses: [
    { id: 'EXP-3001', purpose: 'Fuel', amount: 1250, date: toInputDate(), category: 'Travel', createdBy: 'Arun Kumar' },
    { id: 'EXP-3002', purpose: 'Office stationery', amount: 850, date: toInputDate(), category: 'Office', createdBy: 'Praveen S' },
    { id: 'EXP-3003', purpose: 'Agent travel', amount: 2550, date: toInputDate(), category: 'Travel', createdBy: 'Mohan R' },
  ],
  agents: [
    { id: 'EMP-001', name: 'Arun Kumar', mobile: '98765 44001', branch: 'Main Branch', status: 'Active', assigned: 42, collected: 68450 },
    { id: 'EMP-002', name: 'Praveen S', mobile: '98765 44002', branch: 'Erode', status: 'Active', assigned: 31, collected: 52700 },
    { id: 'EMP-003', name: 'Mohan R', mobile: '98765 44003', branch: 'Bhavani', status: 'Pending Approval', assigned: 0, collected: 0 },
  ],
  documents: [
    { id: 'DOC-001', name: 'Ravi Kumar - ID Proof', customerId: 'SFC-0001', type: 'Customer KYC', updated: '2026-08-10' },
    { id: 'DOC-003', name: 'Company Registration', customerId: '—', type: 'Company', updated: '2026-06-01' },
  ],

};

const CrednivoContext = createContext(null);

function keepOnlyLatestCustomer(snapshot) {
  const customers = snapshot.customers || [];
  if (customers.length <= 1) return snapshot;

  const customerNumber = (id) => Number(String(id || '').match(/(\d+)$/)?.[1] || 0);
  const keepCustomer = [...customers].sort((a, b) => customerNumber(b.id) - customerNumber(a.id))[0];
  const keepId = keepCustomer?.id;

  if (!keepId) return { ...snapshot, customers: [] };

  return {
    ...snapshot,
    customers: [keepCustomer],
    loans: (snapshot.loans || []).filter((item) => item.customerId === keepId),
    collections: (snapshot.collections || []).filter((item) => item.customerId === keepId),
    payments: (snapshot.payments || []).filter((item) => !item.customerId || item.customerId === '—' || item.customerId === keepId),
    documents: (snapshot.documents || []).filter((item) => !item.customerId || item.customerId === '—' || item.customerId === keepId),
  };
}


function migrateIoAccounting(snapshot) {
  const loans = (snapshot.loans || []).map((loan) => {
    if (loan.loanType !== 'IO' || loan.ioAccountingVersion === 6) return loan;
    const terms = calculateLoan({
      amount: loan.principal,
      cycle: loan.cycle,
      loanType: 'IO',
      interestRate: loan.interestRate,
      duration: loan.duration,
      interestUpfront: loan.interestUpfront,
    });
    const closed = loan.status === 'Closed';
    return {
      ...loan,
      interestAmount: terms.interestAmount,
      interestPerCycle: terms.interestPerCycle,
      totalInterest: terms.totalInterest,
      collectionAmount: Math.round(terms.collectionAmount),
      totalRepayment: terms.totalRepayment,
      outstanding: closed ? 0 : Number(loan.principal) || 0,
      principalOutstanding: closed ? 0 : Number(loan.principal) || 0,
      ioAccountingVersion: 6,
    };
  });

  const loanMap = Object.fromEntries(loans.map((loan) => [loan.id, loan]));
  const collections = (snapshot.collections || []).map((item) => {
    const loan = loanMap[item.loanId];
    if (!loan || loan.loanType !== 'IO') return item;
    const dueAmount = Math.round(Number(loan.collectionAmount) || 0);
    const paidAmount = Math.min(Number(item.paidAmount) || 0, dueAmount);
    return {
      ...item,
      dueAmount,
      paidAmount,
      status: paidAmount >= dueAmount && dueAmount > 0 ? 'Paid' : paidAmount > 0 ? 'Pending' : item.status === 'Overdue' ? 'Overdue' : 'Due Today',
    };
  });

  return { ...snapshot, loans, collections };
}

function withoutPrototypeCoreData(snapshot) {
  return {
    ...snapshot,
    customers: [],
    loans: [],
    collections: [],
    payments: [],
    documents: [],
    agents: [],
  };
}

function loadInitialData(storageKey = STORAGE_KEY) {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      localStorage.setItem(SINGLE_CUSTOMER_CLEANUP_KEY, '1');
      return withoutPrototypeCoreData(seedData);
    }

    const parsed = JSON.parse(saved);
    const seededCreators = Object.fromEntries(seedData.expenses.map((item) => [item.id, item.createdBy]));
    const merged = {
      ...seedData,
      ...parsed,
      expenses: (parsed.expenses || seedData.expenses).map((item) => ({
        ...item,
        createdBy: item.createdBy || seededCreators[item.id] || 'Not recorded',
      })),
    };

    if (!localStorage.getItem(SINGLE_CUSTOMER_CLEANUP_KEY)) {
      const cleaned = migrateIoAccounting(keepOnlyLatestCustomer(merged));
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
      localStorage.setItem(SINGLE_CUSTOMER_CLEANUP_KEY, '1');
      localStorage.setItem(IO_ACCOUNTING_MIGRATION_KEY, '1');
      return withoutPrototypeCoreData(cleaned);
    }

    if (!localStorage.getItem(IO_ACCOUNTING_MIGRATION_KEY)) {
      const migrated = migrateIoAccounting(merged);
      localStorage.setItem(storageKey, JSON.stringify(migrated));
      localStorage.setItem(IO_ACCOUNTING_MIGRATION_KEY, '1');
      return withoutPrototypeCoreData(migrated);
    }

    return withoutPrototypeCoreData(merged);
  } catch {
    return withoutPrototypeCoreData(seedData);
  }
}

function nextId(prefix, list, pad = 4) {
  const highest = list.reduce((max, item) => {
    const match = String(item.id).match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 0);
  return `${prefix}${String(highest + 1).padStart(pad, '0')}`;
}

function normalizePaymentDate(value) {
  const today = toInputDate();
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : today;
  return candidate > today ? today : candidate;
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}


function mapBackendDocument(item) {
  return {
    ...item,
    data: mediaUrl(item.fileUrl),
    file: item.fileUrl ? { name: item.fileName || item.name, type: item.contentType || '', data: mediaUrl(item.fileUrl) } : null,
  };
}

function dedupeMediaDocuments(list = []) {
  const seen = new Set();
  return list.filter(Boolean).filter((doc) => {
    const key = String(doc.data || doc.backendId || `${doc.name || ''}:${doc.type || ''}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mappedCustomerDocuments(item, documents = [], owner = 'customer') {
  const expectedType = owner === 'jamin' ? 'Jamin KYC' : 'Customer KYC';
  const embeddedDocuments = owner === 'jamin' ? item.jaminDocuments : item.customerDocuments;

  const rows = [
    ...(Array.isArray(embeddedDocuments) ? embeddedDocuments : []).map((doc) => ({
      name: doc.documentName || doc.fileName || doc.name || `${owner} document`,
      type: doc.mimeType || doc.contentType || doc.file?.type || '',
      data: mediaUrl(doc.fileUrl || doc.data),
      backendId: doc.id || doc.backendId || null,
    })),
    ...documents
      .filter((doc) => doc.customerId === item.id && doc.type === expectedType)
      .map((doc) => ({
        name: doc.fileName || doc.name || `${owner} document`,
        type: doc.contentType || doc.file?.type || '',
        data: mediaUrl(doc.fileUrl || doc.data),
        backendId: doc.id || doc.backendId || null,
      })),
  ];

  const directUrl = owner === 'jamin' ? item.jaminDocumentUrl : item.customerDocumentUrl;
  if (directUrl) {
    rows.unshift({
      name: (owner === 'jamin' ? item.jaminDocumentName : item.customerDocumentName) || `${owner === 'jamin' ? 'Jamin' : 'Customer'} document`,
      type: (owner === 'jamin' ? item.jaminDocumentContentType : item.customerDocumentContentType) || '',
      data: mediaUrl(directUrl),
      backendId: (owner === 'jamin' ? item.jaminDocumentId : item.customerDocumentId) || null,
    });
  }

  return dedupeMediaDocuments(rows);
}

function mapBackendCustomer(item, documents = []) {
  const customerDocuments = mappedCustomerDocuments(item, documents, 'customer');
  const jaminDocuments = mappedCustomerDocuments(item, documents, 'jamin');
  return {
    ...item,
    mobile: normalizeIndianMobile(item.mobile),
    // Accept both the current API aliases and the original backend field names.
    // This keeps saved customer/Jamin photos visible after media/UI updates.
    photo: mediaUrl(item.photo || item.profilePhotoUrl || item.customerPhoto || item.customerPhotoUrl || item.photoUrl),
    jaminMobile: normalizeIndianMobile(item.jaminMobile),
    jaminPhoto: mediaUrl(item.jaminPhoto || item.jaminProfilePhotoUrl || item.jaminProfilePhoto || item.jaminPhotoUrl),
    outstanding: asNumber(item.outstanding),
    collectionAmount: asNumber(item.collectionAmount),
    rating: item.rating ?? 5,
    customerDocuments,
    jaminDocuments,
    customerDocument: customerDocuments[0] || null,
    jaminDocument: jaminDocuments[0] || null,
  };
}

function mapBackendLoan(item) {
  return {
    ...item,
    // Preserve the API status before UI normalization.
    // Example: backend PRECLOSED becomes display status Closed later,
    // but collection filtering still needs to know it was specifically preclosed.
    rawStatus: item?.rawStatus || item?.status || '',
    principal: asNumber(item.principal),
    disbursedAmount: asNumber(item.disbursedAmount),
    interestRate: asNumber(item.interestRate),
    interestAmount: asNumber(item.interestAmount),
    totalInterest: asNumber(item.totalInterest),
    totalRepayment: asNumber(item.totalRepayment),
    collectionAmount: asNumber(item.collectionAmount),
    outstanding: asNumber(item.outstanding),
    principalOutstanding: asNumber(item.principalOutstanding),
    interestUpfront: Boolean(item.interestUpfront),
    fineEnabled: Boolean(item.fineEnabled),
    fineAmount: asNumber(item.fineAmount),
    documentChargeEnabled: Boolean(item.documentChargeEnabled),
    documentChargeAmount: asNumber(item.documentChargeAmount),
    extensionCycles: Number(item.extensionCycles || 0),
    lastExtensionReason: item.lastExtensionReason || '',
    lastExtendedAt: item.lastExtendedAt || null,
    cancelledInterestAmount: asNumber(item.cancelledInterestAmount),
    ioAccountingVersion: item.loanType === 'IO' ? 6 : undefined,
  };
}

function mapBackendCollection(item) {
  return {
    ...item,
    dueAmount: asNumber(item.dueAmount),
    paidAmount: asNumber(item.paidAmount),
    balance: asNumber(item.balance),
    fine: asNumber(item.fine),
  };
}

function deriveLoanScheduleStatus(loan, collections = []) {
  const rawStatus = String(loan?.status || 'Active');
  const rawStatusLower = rawStatus.toLowerCase();

  // A fully settled/closed loan must never be shown as overdue.
  if (rawStatusLower === 'closed' || rawStatusLower === 'preclosed' || Number(loan?.outstanding || 0) <= 0) {
    return 'Closed';
  }

  const today = toInputDate();
  const hasPastUnpaidBalance = collections.some((entry) => {
    if (String(entry?.loanId || '') !== String(loan?.id || '')) return false;
    if (!entry?.date || entry.date >= today) return false;
    if (String(entry?.status || '').toLowerCase() === 'cancelled') return false;

    const due = asNumber(entry?.dueAmount);
    const paid = asNumber(entry?.paidAmount);
    return Math.max(0, due - paid) > 0;
  });

  return hasPastUnpaidBalance ? 'Overdue' : 'Active';
}

function mapBackendPayment(item) {
  return {
    ...item,
    collectionAmount: asNumber(item.collectionAmount),
    interestPaid: asNumber(item.interestPaid),
    principalPaid: asNumber(item.principalPaid),
    fineAmount: asNumber(item.fineAmount),
    amount: asNumber(item.amount),
  };
}

function mapBackendExpense(item) {
  return {
    ...item,
    amount: asNumber(item.amount),
  };
}

function mapBackendCapital(item) {
  return {
    ...item,
    amount: asNumber(item.amount),
  };
}

function mapBackendSaving(item) {
  return {
    ...item,
    amount: asNumber(item.amount),
  };
}

function mapBackendAgent(item) {
  return {
    ...item,
    mobile: normalizeIndianMobile(item.mobile),
    assigned: asNumber(item.assigned),
    collected: asNumber(item.collected),
    photo: mediaUrl(item.photo),
    loginEnabled: Boolean(item.loginEnabled),
    permissions: item.permissions || {},
  };
}

function mapBackendCompany(item = {}) {
  return {
    name: item.name || 'CREDNIVO',
    owner: item.owner || '',
    branch: item.branch || '',
    mobile: normalizeIndianMobile(item.mobile),
    email: item.email || '',
    address: item.address || '',
    logo: mediaUrl(item.logo),
    companyId: item.companyId || '',
  };
}

function mapBackendDashboard(item = {}) {
  return {
    expected: asNumber(item.expected),
    collected: asNumber(item.collected),
    pending: asNumber(item.pending),
    overdue: asNumber(item.overdue),
    pendingOverdue: asNumber(item.pendingOverdue ?? (asNumber(item.pending) + asNumber(item.overdue))),
    upcoming7Days: asNumber(item.upcoming7Days),
    todayExpenses: asNumber(item.todayExpenses),
    todayNewLoans: asNumber(item.todayNewLoans),
    activeLoans: asNumber(item.activeLoans),
    netCash: asNumber(item.netCash),
    availableCapital: asNumber(item.availableCapital),
    totalEntries: asNumber(item.totalEntries),
    paidEntries: asNumber(item.paidEntries),
    unpaidEntries: asNumber(item.unpaidEntries),
    dueCustomers: asNumber(item.dueCustomers),
    upcomingCustomers: asNumber(item.upcomingCustomers),
    source: 'backend',
  };
}

function mapBackendCapitalMetrics(item = {}) {
  return {
    totalInvestment: asNumber(item.totalInvestment),
    totalWithdrawn: asNumber(item.totalWithdrawn),
    netCapital: asNumber(item.netCapital),
    collectionsReceived: asNumber(item.collectionsReceived),
    loanDisbursed: asNumber(item.loanDisbursed),
    expensesPaid: asNumber(item.expensesPaid),
    loanBookOutstanding: asNumber(item.loanBookOutstanding),
    availableCapital: asNumber(item.availableCapital),
    entries: asNumber(item.entries),
    source: 'backend',
  };
}

export function CrednivoProvider({ children }) {
  const { isOwner, user, hasPermission } = useAuth();
  const companyCacheKey = `${STORAGE_KEY}:${user?.companyId || 'unassigned'}`;
  const [data, setData] = useState(() => loadInitialData(companyCacheKey));
  const [uiSettings, setUiSettings] = useState(loadUiSettings);
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const [backendStatus, setBackendStatus] = useState({ loading: true, connected: false, error: '' });

  const syncCoreData = async () => {
    try {
      // Load loans first. The backend uses the loans read to repair legacy/current
      // IO schedule pricing when principal has changed. Collections are requested
      // only after that repair completes so the UI never mixes fresh loans with
      // stale schedule rows.
      const loanRows = hasPermission('loans.view') ? await apiRequest('/loans') : [];

      const [customerRows, paymentRows, documentRows, expenseRows, capitalRows, dashboardRow, capitalMetricRow, savingImpactRow, savingSummaryRow, agentRows, companyRow] = await Promise.all([
        hasPermission('customers.view') ? apiRequest('/customers') : Promise.resolve([]),
        hasPermission('payments.view') ? apiRequest('/payments') : Promise.resolve([]),
        hasPermission('documents.view') ? apiRequest('/documents') : Promise.resolve([]),
        hasPermission('expenses.view') ? apiRequest('/expenses') : Promise.resolve([]),
        hasPermission('capital.view') ? apiRequest('/capital') : Promise.resolve([]),
        (hasPermission('overview.view') || hasPermission('todayReport.view')) ? apiRequest('/dashboard/today') : Promise.resolve(null),
        hasPermission('capital.view') ? apiRequest('/capital/metrics') : Promise.resolve(null),
        hasPermission('capital.view') ? apiRequest('/capital/savings-impact') : Promise.resolve(null),
        isOwner ? apiRequest('/company/savings') : Promise.resolve(null),
        isOwner ? apiRequest('/agents') : Promise.resolve([]),
        apiRequest('/company'),
      ]);

      const collectionRows = hasPermission('collections.view') ? await apiRequest('/collections') : [];
      const mappedDocuments = (documentRows || []).map(mapBackendDocument);
      const mappedCollections = (collectionRows || [])
        .filter((item) => item.status !== 'Cancelled')
        .map(mapBackendCollection);
      const canDeriveLoanScheduleStatus = hasPermission('collections.view');
      const mappedLoans = (loanRows || []).map(mapBackendLoan).map((loan) => ({
        ...loan,
        status: canDeriveLoanScheduleStatus
          ? deriveLoanScheduleStatus(loan, mappedCollections)
          : loan.status,
      }));
      const core = {
        customers: (customerRows || []).map((item) => mapBackendCustomer(item, documentRows || [])),
        loans: mappedLoans,
        collections: mappedCollections,
        payments: (paymentRows || []).map(mapBackendPayment),
        documents: mappedDocuments,
        expenses: (expenseRows || []).map(mapBackendExpense),
        capital: (capitalRows || []).map(mapBackendCapital),
        savings: isOwner ? (savingSummaryRow?.history || []).map(mapBackendSaving) : [],
        savingsImpactApi: savingImpactRow ? { totalSavings: asNumber(savingImpactRow.totalSavings), source: 'backend' } : null,
        agents: (agentRows || []).map(mapBackendAgent),
        company: mapBackendCompany(companyRow),
        dashboardMetrics: dashboardRow ? mapBackendDashboard(dashboardRow) : null,
        capitalMetricsApi: capitalMetricRow ? mapBackendCapitalMetrics(capitalMetricRow) : null,
      };
      setData((current) => {
        const next = { ...current, ...core };
        localStorage.setItem(companyCacheKey, JSON.stringify(next));
        return next;
      });
      setBackendStatus({ loading: false, connected: true, error: '' });
      return core;
    } catch (error) {
      console.error('CREDNIVO backend sync failed', error);
      setBackendStatus({ loading: false, connected: false, error: error?.message || 'Backend connection failed' });
      throw error;
    }
  };

  useEffect(() => {
    setData(loadInitialData(companyCacheKey));
    syncCoreData().catch(() => {});
  }, [user?.companyId]);

  useEffect(() => {
    // Some browsers/webviews expose matchMedia inconsistently. Never allow a
    // missing MediaQueryList to crash the whole application.
    const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    const applyTheme = () => {
      const systemDark = Boolean(media?.matches);
      const theme = uiSettings.theme === 'system'
        ? (systemDark ? 'dark' : 'light')
        : uiSettings.theme;
      setResolvedTheme(theme);
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };

    applyTheme();

    if (uiSettings.theme === 'system' && media) {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', applyTheme);
        return () => media.removeEventListener?.('change', applyTheme);
      }
      // Safari / older webview fallback.
      if (typeof media.addListener === 'function') {
        media.addListener(applyTheme);
        return () => media.removeListener?.(applyTheme);
      }
    }

    return undefined;
  }, [uiSettings.theme]);

  useEffect(() => {
    document.documentElement.lang = uiSettings.language === 'ta' ? 'ta' : 'en';
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(uiSettings));
  }, [uiSettings]);

  const updateUiSettings = (changes) => {
    setUiSettings((current) => ({ ...current, ...changes }));
  };

  const commit = (updater) => {
    setData((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      localStorage.setItem(companyCacheKey, JSON.stringify(next));
      return next;
    });
  };


  const uploadAdditionalCustomerDocument = async (customerId, type, document) => {
    if (!document?.data || !String(document.data).startsWith('data:')) return null;

    // Customer/Jamin documents always use the customer-owned KYC endpoint.
    // This keeps profile media independent from the removed Documents Vault UI
    // and stores every KYC item as a real JPG/PNG/PDF file on the backend.
    return uploadCustomerDocument(customerId, type, document);
  };

  const saveCustomerProfile = async (form, existingCustomerId = null) => {
    const payload = {
      name: String(form.name || '').trim(),
      mobile: normalizeIndianMobile(form.mobile),
      fatherName: String(form.fatherName || '').trim(),
      date: form.date || toInputDate(),
      work: String(form.work || '').trim(),
      area: String(form.area || form.address || '').trim(),
      address: String(form.address || '').trim(),
      photo: null,
    };

    const saved = await apiRequest(existingCustomerId ? `/customers/${existingCustomerId}` : '/customers', {
      method: existingCustomerId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const customerId = saved.id;

    if (String(form.photo || '').startsWith('data:')) {
      await uploadProfilePhoto(customerId, form.photo, 'customer');
    }

    const customerDocuments = Array.isArray(form.customerDocuments)
      ? form.customerDocuments
      : form.customerDocument ? [form.customerDocument] : [];
    const newCustomerDocuments = customerDocuments.filter((doc) => doc?.data && String(doc.data).startsWith('data:'));
    if (newCustomerDocuments[0]) {
      await uploadCustomerDocument(customerId, 'Customer KYC', newCustomerDocuments[0]);
    }
    for (const extraDocument of newCustomerDocuments.slice(1)) {
      await uploadAdditionalCustomerDocument(customerId, 'Customer KYC', extraDocument);
    }

    await syncCoreData();
    return customerId;
  };

  const saveJaminProfile = async (customerId, form) => {
    if (!customerId) return false;
    const payload = {
      jaminName: String(form.jaminName || '').trim(),
      jaminMobile: normalizeIndianMobile(form.jaminMobile),
      jaminFatherName: String(form.jaminFatherName || '').trim(),
      jaminWork: String(form.jaminWork || '').trim(),
      jaminAddress: String(form.jaminAddress || '').trim(),
      jaminPhoto: null,
    };
    await apiRequest(`/customers/${customerId}/jamin`, { method: 'PUT', body: JSON.stringify(payload) });

    if (String(form.jaminPhoto || '').startsWith('data:')) {
      await uploadProfilePhoto(customerId, form.jaminPhoto, 'jamin');
    }

    const jaminDocuments = Array.isArray(form.jaminDocuments)
      ? form.jaminDocuments
      : form.jaminDocument ? [form.jaminDocument] : [];
    const newJaminDocuments = jaminDocuments.filter((doc) => doc?.data && String(doc.data).startsWith('data:'));
    if (newJaminDocuments[0]) {
      await uploadCustomerDocument(customerId, 'Jamin KYC', newJaminDocuments[0]);
    }
    for (const extraDocument of newJaminDocuments.slice(1)) {
      await uploadAdditionalCustomerDocument(customerId, 'Jamin KYC', extraDocument);
    }

    await syncCoreData();
    return true;
  };

  const saveCustomerMedia = async (customerId, kind, media = {}) => {
    if (!customerId) return false;
    const isJamin = kind === 'jamin';
    const photo = media.photo || '';
    const mediaDocuments = Array.isArray(media.documents)
      ? media.documents
      : media.document ? [media.document] : [];
    const newDocuments = mediaDocuments.filter((doc) => doc?.data && String(doc.data).startsWith('data:'));
    const existingDocuments = mediaDocuments.filter((doc) => doc?.data && !String(doc.data).startsWith('data:'));
    const type = isJamin ? 'Jamin KYC' : 'Customer KYC';

    if (String(photo).startsWith('data:')) {
      await uploadProfilePhoto(customerId, photo, isJamin ? 'jamin' : 'customer');
    }

    if (newDocuments.length > 0) {
      let startIndex = 0;
      // Keep the original customer/jamin direct document field populated when a
      // customer does not have any document yet. Extra documents go to the vault.
      if (existingDocuments.length === 0) {
        await uploadCustomerDocument(customerId, type, newDocuments[0]);
        startIndex = 1;
      }
      for (const extraDocument of newDocuments.slice(startIndex)) {
        await uploadAdditionalCustomerDocument(customerId, type, extraDocument);
      }
    }

    await syncCoreData();
    return true;
  };

  const addCustomer = async (form) => {
    const customerId = await saveCustomerProfile(form);
    await saveJaminProfile(customerId, form);
    await addLoan({ ...form, customerId });
    return customerId;
  };

  const deleteCustomer = async (customerId) => {
    if (!customerId) return false;
    await apiRequest(`/customers/${customerId}`, { method: 'DELETE' });
    await syncCoreData();
    return true;
  };

  const addLoan = async (form) => {
    if (!form.customerId) return null;
    const payload = {
      customerId: form.customerId,
      amount: asNumber(form.amount),
      cycle: form.cycle,
      loanType: form.loanType,
      interestRate: asNumber(form.interestRate),
      duration: Math.max(1, Number(form.duration) || 1),
      interestUpfront: Boolean(form.interestUpfront),
      fineEnabled: Boolean(form.fineEnabled),
      fineAmount: form.fineEnabled ? Math.max(0, asNumber(form.fineAmount)) : 0,
      documentChargeEnabled: Boolean(form.documentChargeEnabled),
      documentChargeAmount: form.documentChargeEnabled ? Math.max(0, asNumber(form.documentChargeAmount)) : 0,
      startDate: form.startDate || toInputDate(),
    };
    const saved = await apiRequest('/loans', { method: 'POST', body: JSON.stringify(payload) });
    await syncCoreData();
    return saved?.id || null;
  };

  const updateLoan = async (loanId, form) => {
    if (!loanId) return null;
    const payload = {
      amount: asNumber(form.amount),
      cycle: form.cycle,
      loanType: form.loanType,
      interestRate: asNumber(form.interestRate),
      duration: Math.max(1, Number(form.duration) || 1),
      interestUpfront: Boolean(form.interestUpfront),
      fineEnabled: Boolean(form.fineEnabled),
      fineAmount: form.fineEnabled ? Math.max(0, asNumber(form.fineAmount)) : 0,
      documentChargeEnabled: Boolean(form.documentChargeEnabled),
      documentChargeAmount: form.documentChargeEnabled ? Math.max(0, asNumber(form.documentChargeAmount)) : 0,
      startDate: form.startDate || toInputDate(),
    };
    const saved = await apiRequest(`/loans/${loanId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await syncCoreData();
    return saved;
  };

  const getIoSettlementPreview = async (loanId, paymentDate = toInputDate()) => {
    if (!loanId) return null;
    const date = normalizePaymentDate(paymentDate);
    return apiRequest(`/loans/${loanId}/io-settlement?paymentDate=${encodeURIComponent(date)}`);
  };

  const extendIoLoan = async (loanId, additionalCycles, reason) => {
    if (!loanId) return null;
    const saved = await apiRequest(`/loans/${loanId}/extend-io`, {
      method: 'POST',
      body: JSON.stringify({
        additionalCycles: Math.max(1, Number(additionalCycles) || 1),
        reason: String(reason || '').trim(),
      }),
    });
    await syncCoreData();
    return saved;
  };

  const recordCollection = async (collectionId, paidAmount, fine = 0) => {
    const source = data.collections.find((item) => item.id === collectionId);
    if (!source) return false;
    return recordLoanPayment(source.loanId, paidAmount, fine, source.date || toInputDate());
  };

  const recordLoanPayment = async (loanId, paymentInput, fine = 0, paymentDate = toInputDate()) => {
    const loanSource = data.loans.find((item) => item.id === loanId);
    if (!loanSource || loanSource.status === 'Closed' || Number(loanSource.outstanding) <= 0) return false;

    const inputObject = typeof paymentInput === 'object' && paymentInput !== null ? paymentInput : null;
    const effectiveDate = normalizePaymentDate(inputObject?.paymentDate ?? paymentDate);
    if (loanSource.startDate && effectiveDate < loanSource.startDate) return false;

    const isIo = loanSource.loanType === 'IO';
    const payload = {
      amount: isIo ? 0 : Math.max(0, Number(inputObject?.amount ?? paymentInput) || 0),
      interestAmount: isIo ? Math.max(0, Number(inputObject?.interestAmount) || 0) : 0,
      principalAmount: isIo ? Math.max(0, Number(inputObject?.principalAmount) || 0) : 0,
      fine: Math.max(0, Number(inputObject?.fine ?? fine) || 0),
      paymentDate: effectiveDate,
      paymentMode: inputObject?.paymentMode || 'Cash',
      note: inputObject?.note || '',
    };

    const cashReceived = isIo ? payload.interestAmount + payload.principalAmount : payload.amount;
    const fineReceived = payload.fine;
    if (cashReceived <= 0 && fineReceived <= 0) return false;

    await apiRequest(`/payments/loan/${loanId}`, { method: 'POST', body: JSON.stringify(payload) });
    await syncCoreData();
    return true;
  };

  const updatePayment = async (paymentId, changes) => {
    if (!paymentId) return null;
    const payload = {
      amount: Math.max(0, Number(changes?.amount) || 0),
      interestAmount: Math.max(0, Number(changes?.interestAmount) || 0),
      principalAmount: Math.max(0, Number(changes?.principalAmount) || 0),
      fine: Math.max(0, Number(changes?.fine) || 0),
      paymentDate: normalizePaymentDate(changes?.paymentDate || toInputDate()),
      paymentMode: changes?.paymentMode || 'Cash',
      note: String(changes?.note || '').trim(),
    };
    const saved = await apiRequest(`/payments/${paymentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await syncCoreData();
    return saved;
  };

  const deletePayment = async (paymentId) => {
    if (!paymentId) return false;
    await apiRequest(`/payments/${paymentId}`, { method: 'DELETE' });
    await syncCoreData();
    return true;
  };

  const saveCapitalEntry = async (entry, existingId = null) => {
    const payload = {
      investorName: String(entry.investorName || '').trim(),
      amount: Math.max(0, Number(entry.amount) || 0),
      date: entry.date || toInputDate(),
      paymentMode: entry.paymentMode || 'Bank',
      type: entry.type || 'Investment',
      note: String(entry.note || '').trim(),
      createdBy: String(entry.createdBy || '').trim() || data.company.owner || 'Not recorded',
    };

    if (!payload.investorName || payload.amount <= 0 || !payload.createdBy) return null;

    const saved = await apiRequest(existingId ? `/capital/${existingId}` : '/capital', {
      method: existingId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    await syncCoreData();
    return saved?.id || null;
  };

  const deleteCapitalEntry = async (id) => {
    if (!id) return false;
    await apiRequest(`/capital/${id}`, { method: 'DELETE' });
    await syncCoreData();
    return true;
  };

  const saveSavingEntry = async (entry, existingId = null) => {
    if (!isOwner) throw new Error('Owner access is required for Savings.');
    const payload = {
      amount: Math.max(0, Number(entry?.amount) || 0),
      date: entry?.date || toInputDate(),
      note: String(entry?.note || '').trim(),
    };
    if (payload.amount <= 0) return null;

    const saved = await apiRequest(existingId ? `/company/savings/${existingId}` : '/company/savings', {
      method: existingId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    await syncCoreData();
    return saved?.id || null;
  };

  const deleteSavingEntry = async (id) => {
    if (!isOwner) throw new Error('Owner access is required for Savings.');
    if (!id) return false;
    await apiRequest(`/company/savings/${id}`, { method: 'DELETE' });
    await syncCoreData();
    return true;
  };

  const addExpense = async (expense) => {
    const payload = {
      purpose: String(expense.purpose || '').trim(),
      amount: Math.max(0, Number(expense.amount) || 0),
      category: expense.category || 'General',
      date: expense.date || toInputDate(),
      createdBy: user?.displayName || String(expense.createdBy || '').trim() || 'Not recorded',
    };
    if (!payload.purpose || payload.amount <= 0 || !payload.createdBy) return null;

    const saved = await apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await syncCoreData();
    return saved?.id || null;
  };

  const updateExpense = async (id, changes) => {
    if (!id) return null;
    const payload = {
      purpose: String(changes.purpose || '').trim(),
      amount: Math.max(0, Number(changes.amount) || 0),
      category: changes.category || 'General',
      date: changes.date || toInputDate(),
      createdBy: String(changes.createdBy || '').trim() || 'Not recorded',
    };
    const saved = await apiRequest(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    await syncCoreData();
    return saved?.id || null;
  };

  const deleteExpense = async (id) => {
    if (!id) return false;
    await apiRequest(`/expenses/${id}`, { method: 'DELETE' });
    await syncCoreData();
    return true;
  };

  const saveAgent = async (entry, existingId = null) => {
    const payload = {
      name: String(entry.name || '').trim(),
      mobile: normalizeIndianMobile(entry.mobile),
      branch: String(entry.branch || '').trim(),
      status: String(entry.status || 'Pending Approval').trim(),
      loginPassword: String(entry.loginPassword || ''),
    };
    if (!payload.name || payload.mobile.length !== 10 || !payload.branch) return null;
    const saved = await apiRequest(existingId ? `/agents/${existingId}` : '/agents', {
      method: existingId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const id = saved?.id || existingId;
    if (id && entry.photoFile) await uploadAgentPhoto(id, entry.photoFile);
    await syncCoreData();
    return id || null;
  };

  const setAgentStatus = async (id, status) => {
    if (!id) return false;
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active') {
      await apiRequest(`/agents/${id}/approve`, { method: 'POST' });
      await syncCoreData();
      return true;
    }
    if (normalized === 'rejected') {
      await apiRequest(`/agents/${id}/reject`, { method: 'POST' });
      await syncCoreData();
      return true;
    }
    const source = data.agents.find((item) => item.id === id);
    if (!source) return false;
    await saveAgent({ ...source, status }, id);
    return true;
  };

  const deleteAgent = async (id) => {
    if (!id) return false;
    await apiRequest(`/agents/${id}`, { method: 'DELETE' });
    await syncCoreData();
    return true;
  };

  const saveAgentPermissions = async (id, permissions) => {
    if (!id) return null;
    const saved = await apiRequest(`/agents/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: permissions || {} }),
    });
    await syncCoreData();
    return saved;
  };

  const saveDocument = async ({ customerId = '—', type = 'General', file }) => {
    if (!file) return null;
    const saved = await uploadVaultDocument({ customerId, type, file });
    await syncCoreData();
    return saved?.id || null;
  };

  const deleteDocument = async (id) => {
    if (!id) return false;
    await apiRequest(`/documents/${id}`, { method: 'DELETE' });
    await syncCoreData();
    return true;
  };

  const updateCompany = async (changes) => {
    const payload = {
      name: String(changes.name ?? data.company.name ?? '').trim(),
      owner: String(changes.owner ?? data.company.owner ?? '').trim(),
      branch: String(changes.branch ?? data.company.branch ?? '').trim(),
      mobile: normalizeIndianMobile(changes.mobile ?? data.company.mobile ?? ''),
      email: String(changes.email ?? data.company.email ?? '').trim(),
      address: String(changes.address ?? data.company.address ?? '').trim(),
    };
    const saved = await apiRequest('/company', { method: 'PUT', body: JSON.stringify(payload) });
    if (changes.logoFile) await uploadCompanyLogo(changes.logoFile);
    await syncCoreData();
    return saved;
  };

  const resetDemo = async () => {
    localStorage.removeItem(companyCacheKey);
    setData(withoutPrototypeCoreData(seedData));
    try { await syncCoreData(); } catch { /* backend status already records the error */ }
  };

  const savingsTotal = useMemo(() => {
    if (data.savingsImpactApi?.source === 'backend') {
      return asNumber(data.savingsImpactApi.totalSavings);
    }
    return (data.savings || []).reduce((sum, item) => sum + asNumber(item.amount), 0);
  }, [data.savingsImpactApi, data.savings]);

  const capitalMetrics = useMemo(() => {
    if (data.capitalMetricsApi?.source === 'backend') {
      return {
        ...data.capitalMetricsApi,
        savingsTotal,
        availableCapital: asNumber(data.capitalMetricsApi.availableCapital) - savingsTotal,
      };
    }

    const records = data.capital || [];
    const investments = records.filter((item) => item.type !== 'Capital Withdrawal');
    const withdrawals = records.filter((item) => item.type === 'Capital Withdrawal');
    const totalInvestment = investments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalWithdrawn = withdrawals.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const netCapital = totalInvestment - totalWithdrawn;
    const collectionsReceived = data.payments
      .filter((item) => (
        (item.type === 'Collection' || item.type === 'Document Charge')
        && item.direction === 'in'
      ))
      .reduce((sum, item) => {
        // Collection payment.amount is collection cash + fine.
        // Document Charge is a separate one-time income payment.
        if (item.amount != null) return sum + (Number(item.amount) || 0);
        return sum
          + (Number(item.collectionAmount) || 0)
          + (Number(item.fineAmount) || 0);
      }, 0);
    const loanDisbursed = data.loans.reduce((sum, item) => sum + (Number(item.disbursedAmount) || 0), 0);
    const expensesPaid = data.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const loanBookOutstanding = data.loans
      .filter((item) => item.status !== 'Closed' && Number(item.outstanding) > 0)
      .reduce((sum, item) => sum + (Number(item.outstanding) || 0), 0);
    return {
      totalInvestment,
      totalWithdrawn,
      netCapital,
      collectionsReceived,
      loanDisbursed,
      expensesPaid,
      savingsTotal,
      loanBookOutstanding,
      availableCapital: netCapital + collectionsReceived - loanDisbursed - expensesPaid - savingsTotal,
      entries: records.length,
      source: 'fallback',
    };
  }, [data, savingsTotal]);

  const metrics = useMemo(() => {
    if (data.dashboardMetrics?.source === 'backend') {
      return {
        ...data.dashboardMetrics,
        availableCapital: asNumber(data.dashboardMetrics.availableCapital) - savingsTotal,
      };
    }

    const today = toInputDate();
    const todayCollections = data.collections.filter((item) => item.date === today);
    const expected = todayCollections.reduce((sum, item) => sum + item.dueAmount, 0);
    const collected = todayCollections.reduce((sum, item) => sum + item.paidAmount, 0);
    const pending = todayCollections
      .filter((item) => item.status !== 'Paid')
      .reduce((sum, item) => sum + Math.max(0, item.dueAmount - item.paidAmount), 0);
    const overdue = data.collections
      .filter((item) => item.date < today && item.status !== 'Paid' && item.status !== 'Cancelled')
      .reduce((sum, item) => sum + Math.max(0, item.dueAmount - item.paidAmount), 0);
    const todayExpenses = data.expenses.filter((item) => item.date === today).reduce((sum, item) => sum + item.amount, 0);
    const todayNewLoans = data.payments.filter((item) => item.date === today && item.type === 'New Loan').reduce((sum, item) => sum + item.amount, 0);
    const todayBusinessIncome = data.payments
      .filter((item) => item.date === today && item.direction === 'in' && (item.type === 'Collection' || item.type === 'Document Charge'))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const activeLoans = data.loans.filter((item) => item.status === 'Active' || item.status === 'Overdue').length;
    return {
      expected,
      collected,
      pending,
      overdue,
      pendingOverdue: pending + overdue,
      upcoming7Days: 0,
      todayExpenses,
      todayNewLoans,
      activeLoans,
      netCash: todayBusinessIncome - todayExpenses - todayNewLoans,
      availableCapital: capitalMetrics.availableCapital,
      totalEntries: todayCollections.length,
      paidEntries: todayCollections.filter((item) => item.status === 'Paid').length,
      unpaidEntries: todayCollections.filter((item) => item.status !== 'Paid').length,
      dueCustomers: new Set(todayCollections.map((item) => item.customerId)).size,
      upcomingCustomers: 0,
      source: 'fallback',
    };
  }, [data, capitalMetrics.availableCapital, savingsTotal]);

  return (
    <CrednivoContext.Provider value={{
      ...data,
      metrics,
      capitalMetrics,
      addCustomer,
      deleteCustomer,
      saveCustomerProfile,
      saveJaminProfile,
      saveCustomerMedia,
      addLoan,
      updateLoan,
      getIoSettlementPreview,
      extendIoLoan,
      recordCollection,
      recordLoanPayment,
      updatePayment,
      deletePayment,
      saveCapitalEntry,
      deleteCapitalEntry,
      savingsTotal,
      saveSavingEntry,
      deleteSavingEntry,
      addExpense,
      updateExpense,
      deleteExpense,
      saveAgent,
      setAgentStatus,
      deleteAgent,
      saveAgentPermissions,
      saveDocument,
      deleteDocument,
      updateCompany,
      resetDemo,
      uiSettings,
      resolvedTheme,
      updateUiSettings,
      backendStatus,
      refreshCoreData: syncCoreData,
    }}>
      {children}
    </CrednivoContext.Provider>
  );
}

export function useCrednivo() {
  const value = useContext(CrednivoContext);
  if (!value) throw new Error('useCrednivo must be used inside CrednivoProvider');
  return value;
}
