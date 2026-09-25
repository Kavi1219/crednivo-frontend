import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './CustomerProfileLink.css';

const CLICK_SURFACE_SELECTOR = 'tr, article, .risky-overdue-row';
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label, [role="button"], [role="link"], [data-customer-profile-ignore]';

export default function CustomerProfileLink({
  customerId,
  children,
  className = '',
  title,
}) {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const linkRef = useRef(null);
  const id = String(customerId || '').trim();
  const canOpen = Boolean(id && id !== '—' && hasPermission('customers.view'));

  useEffect(() => {
    if (!canOpen || !linkRef.current) return undefined;

    const surface = linkRef.current.closest(CLICK_SURFACE_SELECTOR);
    if (!surface) return undefined;

    const openProfile = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(INTERACTIVE_SELECTOR)) return;
      navigate(`/customers/${encodeURIComponent(id)}`);
    };

    surface.classList.add('customer-profile-click-surface');
    surface.addEventListener('click', openProfile);

    return () => {
      surface.removeEventListener('click', openProfile);
      surface.classList.remove('customer-profile-click-surface');
    };
  }, [canOpen, id, navigate]);

  if (!canOpen) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      ref={linkRef}
      to={`/customers/${encodeURIComponent(id)}`}
      className={`customer-profile-link ${className}`.trim()}
      title={title || `Open ${children || id} profile`}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
