import { ArrowLeft } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLastInternalRoute, rememberCurrentRouteNow } from './NavigationMemory';
import './GlobalBackButton.css';

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
  // Web-only control. Android/iOS native app uses the device/app navigation
  // and should never show this browser-style Back button. Home/Overview is the
  // root page, so it should not display a Back button either.
  const customerListRoute = /^\/customers(?:\/(?:daily|weekly|monthly))?\/?$/.test(location.pathname);
  // Pages that place their own <PageBackButton /> in their action row.
  const ownBackButtonRoute = /^\/(?:loans|collection|capital|reports|expenses)\/?$/.test(location.pathname);
  if (Capacitor.isNativePlatform() || location.pathname.startsWith('/overview') || customerListRoute || ownBackButtonRoute) return null;

  return (
    <div className="crednivo-global-back-row">
      <button
        type="button"
        className="page-back-button crednivo-global-back"
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

/** Back button for a page's own action row (e.g. "← Back  + Create Loan"). */
export function PageBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  if (Capacitor.isNativePlatform()) return null;
  return (
    <button type="button" className="page-back-button" onClick={() => goActualBack(navigate, location)}>
      <ArrowLeft size={16} /> Back
    </button>
  );
}
