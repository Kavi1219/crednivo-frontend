import { ArrowRight } from 'lucide-react';
import './SummaryCard.css';

/**
 * Tinted summary card (icon, value, title, note, bar graphic) shared by the
 * Customers and Loans pages. `trend` is an optional month-over-month % change;
 * when given it replaces the note with "↗ 9% since last month".
 */
export default function SummaryCard({ title, value, note, icon: Icon, tone = 'blue', trend = null }) {
  const hasTrend = typeof trend === 'number';
  const label = hasTrend ? `${title}: ${value}. ${trend >= 0 ? 'Up' : 'Down'} ${Math.abs(trend)}% since last month.` : `${title}: ${value}. ${note}.`;
  return (
    <div className={`customer-home-card tone-${tone}`} aria-label={label}>
      <span className="customer-home-arrow" aria-hidden="true"><ArrowRight size={15} /></span>
      <span className="customer-home-icon"><Icon size={18} strokeWidth={2.1} /></span>
      <div className="customer-home-copy">
        <strong>{value}</strong>
        <p>{title}</p>
        <small>
          {hasTrend
            ? <><em className={`customer-home-trend ${trend >= 0 ? 'up' : 'down'}`}>{trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}%</em> since last month</>
            : note}
        </small>
      </div>
      <span className="customer-home-graphic" aria-hidden="true"><span></span><span></span><span></span></span>
      <span className="customer-home-orb" aria-hidden="true"></span>
    </div>
  );
}
