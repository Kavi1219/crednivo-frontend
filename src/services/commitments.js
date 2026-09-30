import { apiRequest } from './api';

// Expenses → Commitments (salary, EMI, interest, rent, chit saving, ...)
export const listCommitments = () => apiRequest('/expenses/commitments');
export const createCommitment = (payload) =>
  apiRequest('/expenses/commitments', { method: 'POST', body: JSON.stringify(payload) });
export const updateCommitment = (id, payload) =>
  apiRequest(`/expenses/commitments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteCommitment = (id) =>
  apiRequest(`/expenses/commitments/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Pay / Paid history. Paying adds an Expense (or Savings for Savings commitments).
export const getCommitmentHistory = (id) => apiRequest(`/expenses/commitments/${encodeURIComponent(id)}/history`);
export const payCommitment = (id, payload) =>
  apiRequest(`/expenses/commitments/${encodeURIComponent(id)}/pay`, { method: 'POST', body: JSON.stringify(payload) });
export const undoCommitmentPayment = (paymentId) =>
  apiRequest(`/expenses/commitments/payments/${encodeURIComponent(paymentId)}`, { method: 'DELETE' });
