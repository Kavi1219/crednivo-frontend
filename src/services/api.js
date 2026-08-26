const explicitBase = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

const AUTH_TOKEN_KEY = 'crednivo-auth-token';

function defaultApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:8080/api';
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:8080/api`;
}

export const API_BASE_URL = explicitBase || defaultApiBase();
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function getAuthToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || ''; } catch { return ''; }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch { /* storage can be unavailable in private environments */ }
}

export function clearAuthToken() { setAuthToken(''); }

export function mediaUrl(value) {
  if (!value) return '';
  const text = String(value);
  if (/^(data:|blob:|https?:\/\/)/i.test(text)) return text;
  if (text.startsWith('/')) return `${BACKEND_ORIGIN}${text}`;
  return `${BACKEND_ORIGIN}/${text}`;
}

function extractMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload.message || payload.error || payload.detail || fallback;
}

export async function apiRequest(path, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const token = skipAuth ? '' : getAuthToken();
  const response = await fetch(url, {
    credentials: 'include',
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (response.status !== 204) {
    payload = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text().catch(() => '');
  }

  if (!response.ok) {
    const authPath = String(path).includes('/auth/login') || String(path).includes('/auth/setup-owner') || String(path).includes('/auth/register-company') || String(path).includes('/auth/register-agent') || String(path).includes('/auth/status');
    if (response.status === 401 && !authPath && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crednivo-auth-expired'));
    }
    throw new Error(extractMessage(payload, `CREDNIVO API request failed (${response.status})`));
  }
  return payload;
}

function dataUrlToFile(dataUrl, fileName = 'upload') {
  if (!String(dataUrl || '').startsWith('data:')) return null;
  const [header, encoded] = String(dataUrl).split(',', 2);
  if (!encoded) return null;
  const mime = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], fileName, { type: mime });
}

export async function uploadProfilePhoto(customerId, dataUrl, kind = 'customer') {
  const file = dataUrlToFile(dataUrl, `${kind}-profile.jpg`);
  if (!file) return null;
  const formData = new FormData();
  formData.append('file', file);
  const path = kind === 'jamin'
    ? `/customers/${customerId}/jamin-profile`
    : `/customers/${customerId}/profile`;
  return apiRequest(path, { method: 'POST', body: formData });
}

export async function uploadCustomerDocument(customerId, type, document) {
  if (!document?.data || !String(document.data).startsWith('data:')) return null;
  const file = dataUrlToFile(document.data, document.name || 'document');
  if (!file) return null;
  const formData = new FormData();
  formData.append('customerId', customerId);
  formData.append('type', type);
  formData.append('file', file);
  return apiRequest(`/customers/${customerId}/document`, { method: 'POST', body: formData });
}

export async function uploadAgentPhoto(agentId, file) {
  if (!agentId || !file) return null;
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest(`/agents/${agentId}/profile`, { method: 'POST', body: formData });
}

export async function uploadCompanyLogo(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/company/logo', { method: 'POST', body: formData });
}

export async function uploadVaultDocument({ customerId = '—', type = 'General', file }) {
  if (!file) return null;
  const formData = new FormData();
  if (customerId && customerId !== '—') formData.append('customerId', customerId);
  formData.append('type', type || 'General');
  formData.append('file', file);
  return apiRequest('/documents/upload', { method: 'POST', body: formData });
}
