import { TrendingUp } from 'lucide-react';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency } from '../../utils/finance';
import './CollectionSummary.css';

export default function CollectionSummary() {
  const { metrics } = useCrednivo();
  const dueToday = Math.max(0, Number(metrics.pending) || 0);
  const overdue = Math.max(0, Number(metrics.overdue) || 0);
  const collected = Math.max(0, Number(metrics.collected) || 0);
  const total = Math.max(0, collected + dueToday + overdue);
  const denominator = total || 1;

  const collectedPct = total ? Math.min(100, (collected / denominator) * 100) : 0;
  const duePct = total ? Math.min(100 - collectedPct, (dueToday / denominator) * 100) : 0;
  const overduePct = total ? Math.max(0, 100 - collectedPct - duePct) : 0;
  const hasWorkload = total > 0;

  const donutBackground = hasWorkload
    ? `conic-gradient(
        var(--success) 0 ${collectedPct}%,
        var(--blue-600) ${collectedPct}% ${collectedPct + duePct}%,
        var(--danger) ${collectedPct + duePct}% 100%
      )`
    : 'var(--line)';

  const rows = [
    { label: 'Collected', amount: formatCurrency(collected), pct: `${collectedPct.toFixed(1)}%`, tone: 'green' },
    { label: 'Due Today', amount: formatCurrency(dueToday), pct: `${duePct.toFixed(1)}%`, tone: 'blue' },
    { label: 'Overdue', amount: formatCurrency(overdue), pct: `${overduePct.toFixed(1)}%`, tone: 'red' },
  ];

  return (
    <section className="summary-card old-summary-card app-card" aria-labelledby="collection-summary-heading">
      <h2 id="collection-summary-heading">Collection Summary (Today)</h2>

      <div className="summary-body old-summary-body">
        <div className="donut-wrap">
          <div className="donut-chart old-donut-chart" style={{ background: donutBackground }}>
            <div className="donut-center">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
          </div>
        </div>

        <div className="summary-legend old-summary-legend">
          {rows.map((row) => (
            <div className="legend-row" key={row.label}>
              <span className={`legend-dot ${row.tone}`} />
              <div>
                <span>{row.label}</span>
                <strong>{row.amount} <small>({row.pct})</small></strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="motivation old-summary-motivation">
        <span><TrendingUp size={18} /></span>
        {hasWorkload ? 'Keep going! You’re doing great.' : 'No collection workload is recorded for today.'}
      </div>
    </section>
  );
}
