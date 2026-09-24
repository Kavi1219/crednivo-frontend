import { ChevronRight } from 'lucide-react';
import './StatCard.css';

export default function StatCard({ title, value, note, icon: Icon, tone, progress = 0, showProgress = true, onDetails }) {
  const numericProgress = Number(progress);
  const safeProgress = Number.isFinite(numericProgress)
    ? Math.max(0, Math.min(100, numericProgress))
    : 0;

  return (
    <button
      type="button"
      className={`stat-card app-card stat-${tone}`}
      onClick={onDetails}
      disabled={!onDetails}
      aria-label={`${title}: ${value}. ${note}.`}
    >
      <span className="stat-chevron" aria-hidden="true"><ChevronRight size={16} /></span>

      <div className="stat-main">
        <span className="stat-icon"><Icon size={22} strokeWidth={2} /></span>
        <div className="stat-copy">
          <p>{title}</p>
          <strong>{value}</strong>
          <small>{note}</small>
        </div>
      </div>

      <span className="stat-card-decoration" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
      <span className="stat-card-orb" aria-hidden="true" />

      {showProgress && (
        <div
          className={`stat-progress ${safeProgress === 0 ? 'is-empty' : ''}`}
          role="progressbar"
          aria-label={`${title} indicator`}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(safeProgress)}
        >
          <span style={{ width: `${safeProgress}%` }} />
        </div>
      )}
    </button>
  );
}
