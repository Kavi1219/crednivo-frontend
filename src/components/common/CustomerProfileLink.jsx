import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './CustomerProfileLink.css';

export default function CustomerProfileLink({
  customerId,
  children,
  className = '',
  title,
}) {
  const { hasPermission } = useAuth();
  const id = String(customerId || '').trim();
  const canOpen = Boolean(id && id !== '—' && hasPermission('customers.view'));

  if (!canOpen) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link
      to={`/customers/${encodeURIComponent(id)}`}
      className={`customer-profile-link ${className}`.trim()}
      title={title || `Open ${children || id} profile`}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </Link>
  );
}
