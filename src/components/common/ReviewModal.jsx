import { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import ActionButton from './ActionButton';
import './ReviewModal.css';

export default function ReviewModal({
  open,
  title,
  subtitle,
  badge,
  icon: Icon = CheckCircle2,
  children,
  confirmLabel = 'Confirm & Continue',
  cancelLabel = 'Edit Details',
  onConfirm,
  onClose,
  busy = false,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => event.key === 'Escape' && !busy && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, busy]);

  if (!open) return null;

  return (
    <div className="review-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose?.()}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="review-modal-head">
          <span className="review-modal-icon"><Icon size={21} /></span>
          <div>
            <div className="review-title-row">
              <h2>{title}</h2>
              {badge && <span className="review-id-badge">{badge}</span>}
            </div>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="review-close" onClick={onClose} disabled={busy} title="Close"><X size={18} /></button>
        </header>
        <div className="review-modal-body">{children}</div>
        <footer className="review-modal-actions">
          <ActionButton type="button" tone="secondary" onClick={onClose} disabled={busy}>{cancelLabel}</ActionButton>
          <ActionButton type="button" icon={CheckCircle2} onClick={onConfirm} disabled={busy}>{confirmLabel}</ActionButton>
        </footer>
      </section>
    </div>
  );
}
