import { apiRequest } from './api';

// Chits page (Owner only): chit groups and their members.
export const listChits = () => apiRequest('/chits');
export const getChit = (id) => apiRequest(`/chits/${encodeURIComponent(id)}`);
export const createChit = (payload) => apiRequest('/chits', { method: 'POST', body: JSON.stringify(payload) });
export const updateChit = (id, payload) =>
  apiRequest(`/chits/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteChit = (id) => apiRequest(`/chits/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const listChitMembers = (chitId) => apiRequest(`/chits/${encodeURIComponent(chitId)}/members`);

function memberForm({ name, phone, address, photo }) {
  const form = new FormData();
  form.append('name', name);
  form.append('phone', phone);
  if (address) form.append('address', address);
  if (photo) form.append('photo', photo);
  return form;
}

export const addChitMember = (chitId, member) =>
  apiRequest(`/chits/${encodeURIComponent(chitId)}/members`, { method: 'POST', body: memberForm(member) });
export const updateChitMember = (chitId, memberId, member) =>
  apiRequest(`/chits/${encodeURIComponent(chitId)}/members/${encodeURIComponent(memberId)}`, { method: 'PUT', body: memberForm(member) });
export const deleteChitMember = (chitId, memberId) =>
  apiRequest(`/chits/${encodeURIComponent(chitId)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
