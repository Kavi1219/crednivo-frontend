import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { downloadCsv, formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './TodayReport.css';

export default function TodayReport() {
  const { metrics } = useCrednivo();
  const { hasPermission } = useAuth();
  const reportData = [
    ['Expected Collection', metrics.expected],
    ['Collected Today', metrics.collected],
    ['Pending Today', metrics.pending],
    ['Overdue', metrics.overdue],
    ['Expenses', metrics.todayExpenses],
    ['New Loan Given', metrics.todayNewLoans],
    ['Net Cash', metrics.netCash],
    ...(hasPermission('capital.view') ? [['Available Capital', metrics.availableCapital]] : []),
  ];

  const download = () => downloadCsv(
    `crednivo-todays-report-${toInputDate()}.csv`,
    [['Metric', 'Amount'], ...reportData],
  );

  return (
    <div className="today-report-page">
      <div className="report-heading">
        <div><h1>Today's Report</h1><p>{formatDate(toInputDate())} · Live database summary</p></div>
        <div className="report-actions">
          <button onClick={download} title="Download Excel-compatible CSV"><FileSpreadsheet size={18} /> Download</button>
          <button onClick={() => window.print()} title="Print or save as PDF"><Printer size={18} /></button>
        </div>
      </div>
      <section className="report-grid">
        {reportData.map(([label, value]) => (
          <article className="report-metric app-card" key={label}><span>{label}</span><strong>{formatCurrency(value)}</strong></article>
        ))}
      </section>
      <section className="report-download-card app-card">
        <span className="report-download-icon"><Download size={26} /></span>
        <div><h2>Download today's report</h2><p>These figures come from the Spring Boot/PostgreSQL dashboard calculation.</p></div>
        <button onClick={download}><Download size={17} /> Download CSV</button>
      </section>
    </div>
  );
}
