import { apiRequest } from './api';

export const createWork = (payload) => apiRequest('/work', { method: 'POST', body: JSON.stringify(payload) });
export const listWork = () => apiRequest('/work');
export const startWork = (id) => apiRequest(`/work/${id}/start`, { method: 'POST' });
export const completeWork = (id) => apiRequest(`/work/${id}/complete`, { method: 'POST' });
export const requestWorkExtension = (id, message) =>
  apiRequest(`/work/${id}/request-extension`, { method: 'POST', body: JSON.stringify({ message }) });
export const extendWork = (id, hours) =>
  apiRequest(`/work/${id}/extend`, { method: 'POST', body: JSON.stringify({ hours }) });
export const rescheduleWork = (id, date) =>
  apiRequest(`/work/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ date }) });

export const listNotifications = () => apiRequest('/notifications');
export const unreadNotificationCount = () => apiRequest('/notifications/unread-count');
export const markNotificationRead = (id) => apiRequest(`/notifications/${id}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => apiRequest('/notifications/read-all', { method: 'POST' });
