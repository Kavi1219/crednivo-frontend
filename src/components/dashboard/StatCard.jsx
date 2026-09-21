import './StatCard.css';

export default function StatCard({ title, value, note, icon: Icon, tone, onDetails }) {
  return (
    <button
      type="button"
      className={`stat-card stat-${tone}`}
      onClick={onDetails}
      disabled={!onDetails}
      aria-label={`${title}: ${value}. ${note}.`}
    >
      <span className="stat-badge"><Icon size={17} strokeWidth={2} /></span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-note">{title}{note ? ` · ${note}` : ''}</span>
    </button>
  );
}
