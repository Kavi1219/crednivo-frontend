import { TrendingUp } from 'lucide-react';
import { useCrednivo } from '../../context/CrednivoContext';
import { formatCurrency } from '../../utils/finance';
import './CollectionSummary.css';

export default function CollectionSummary() {
  const { metrics } = useCrednivo();
  const todayRemaining = Math.max(0, Number(metrics.pending) || 0);
  const overdue = Math.max(0, Number(metrics.overdue) || 0);
  const collected = Math.max(0, Number(metrics.collected) || 0);
  const workloadTotal = Math.max(0, collected + todayRemaining + overdue);
  const denominator = workloadTotal || 1;
  const collectedPct = workloadTotal ? Math.min(100, (collected / denominator) * 100) : 0;
  const duePct = workloadTotal ? Math.min(100 - collectedPct, (todayRemaining / denominator) * 100) : 0;
  const overduePct = workloadTotal ? Math.max(0, 100 - collectedPct - duePct) : 0;
  const hasWorkload = workloadTotal > 0;

  const donutBackground = hasWorkload
    ? `conic-gradient(var(--success) 0 ${collectedPct}%, var(--blue-600) ${collectedPct}% ${collectedPct + duePct}%, var(--danger) ${collectedPct + duePct}% 100%)`
    : 'var(--line)';

  const rows = [
    { label: 'Collected Today', amount: formatCurrency(collected), pct: `${collectedPct.toFixed(1)}%`, tone: 'green' },
    { label: 'Pending Today', amount: formatCurrency(todayRemaining), pct: `${duePct.toFixed(1)}%`, tone: 'blue' },
    { label: 'Overdue', amount: formatCurrency(overdue), pct: `${overduePct.toFixed(1)}%`, tone: 'red' },
  ];

  return (
    <section className="summary-card app-card">
      <h2>Collection Summary (Today)</h2>
      <div className="summary-body">
        <div className="donut-wrap">
          <div className="donut-chart dynamic-donut" style={{ background: donutBackground }}>
            <div className="donut-center"><span>Workload</span><strong>{formatCurrency(workloadTotal)}</strong></div>
          </div>
        </div>
        <div className="summary-legend">
          {rows.map((row) => (
            <div className="legend-row" key={row.label}>
              <span className={`legend-dot ${row.tone}`} />
              <div><span>{row.label}</span><strong>{row.amount} <small>({row.pct})</small></strong></div>
            </div>
          ))}
        </div>
      </div>
      <div className="motivation"><span><TrendingUp size={18} /></span> {hasWorkload ? 'Live figures from the CREDNIVO database.' : 'No collection workload is recorded for today.'}</div>
    </section>
  );
}
