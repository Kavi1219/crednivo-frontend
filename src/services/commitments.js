import { apiRequest } from './api';

// Expenses → Commitments (salary, EMI, interest, rent, chit saving, ...)
export const listCommitments = () => apiRequest('/expenses/commitments');
export const createCommitment = (payload) =>
  apiRequest('/expenses/commitments', { method: 'POST', body: JSON.stringify(payload) });
export const updateCommitment = (id, payload) =>
  apiRequest(`/expenses/commitments/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteCommitment = (id) =>
  apiRequest(`/expenses/commitments/${encodeURIComponent(id)}`, { method: 'DELETE' });
