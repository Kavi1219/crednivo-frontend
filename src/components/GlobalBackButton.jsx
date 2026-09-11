import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLastInternalRoute, rememberCurrentRouteNow } from './NavigationMemory';
import './GlobalBackButton.css';

const MAIN_PAGES = new Set([
  '/',
  '/overview',
  '/dashboard',
  '/customers',
  '/loans',
  '/collection',
  '/payments',
  '/capital',
  '/savings',
  '/expenses',
  '/reports',
  '/agents',
  '/settings',
]);

function isAuthPage(pathname) {
  return ['/login', '/register', '/auth', '/forgot-password', '/reset-password', '/owner-setup']
    .some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasOwnCustomerBack(pathname) {
  // CustomerDetails V40 already contains Back beside New Loan.
  return /^\/customers\/[^/]+$/.test(pathname)
    || /^\/customers\/profile\/[^/]+$/.test(pathname);
}

function parentFallback(pathname) {
  if (pathname.startsWith('/customers/')) return '/customers';
  if (pathname.startsWith('/loans/')) return '/loans';
  if (pathname.startsWith('/collection/')) return '/collection';
  if (pathname.startsWith('/payments/')) return '/payments';
  if (pathname.startsWith('/capital/')) return '/capital';
  if (pathname.startsWith('/savings/')) return '/savings';
  if (pathname.startsWith('/expenses/')) return '/expenses';
  if (pathname.startsWith('/reports/')) return '/reports';
  if (pathname.startsWith('/agents/')) return '/agents';
  if (pathname.startsWith('/settings/')) return '/settings';
  return '/overview';
}

export function goActualBack(navigate, location) {
  rememberCurrentRouteNow();

  const historyIndex = Number(window.history?.state?.idx);

  // Real browser history is always the first choice.
  if (Number.isFinite(historyIndex) && historyIndex > 0) {
    navigate(-1);
    return;
  }

  // Safe fallback for refreshed/direct URLs.
  const previous = getLastInternalRoute();
  const current = `${location.pathname}${location.search}${location.hash}`;

  if (previous && previous !== current) {
    navigate(previous, { replace: true });
    return;
  }

  navigate(parentFallback(location.pathname), { replace: true });
}

export default function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = String(location.pathname || '/');

  if (MAIN_PAGES.has(pathname) || isAuthPage(pathname) || hasOwnCustomerBack(pathname)) {
    return null;
  }

  return (
    <div className="crednivo-global-back-row">
      <button
        type="button"
        className="crednivo-global-back"
        onClick={() => goActualBack(navigate, location)}
        aria-label="Go back"
        title="Back"
      >
        <ArrowLeft size={17} />
        <span>Back</span>
      </button>
    </div>
  );
}
