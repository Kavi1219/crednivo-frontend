import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BadgeIndianRupee, CalendarRange, ChevronRight, CircleDollarSign, FileText,
  HandCoins, PiggyBank, ReceiptText, Scale, TrendingUp, UserCheck, UserPlus, UsersRound, WalletCards,
} from 'lucide-react';
import { calculateCycleTargets } from '../../utils/collectionTargets';
import { calculateActualProfit } from '../../utils/profit';
import { formatCurrency, toInputDate } from '../../utils/finance';
import './ReportActivityBoard.css';

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const loanDate = (loan) => String(loan.startDate || loan.loanDate || loan.disbursedDate || loan.createdAt || '').slice(0, 10);
const isActiveLoan = (loan) => loan.status !== 'Closed' && num(loan.outstanding) > 0;

/** How many times a given weekday (0-6) falls inside year-month. */
function weekdayCount(year, monthIndex, weekday) {
  const days = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= days; day += 1) if (new Date(year, monthIndex, day).getDay() === weekday) count += 1;
  return count;
}

/**
 * Whole-month collection target across every cycle for the current month:
 * daily amount × days in month, each weekly loan × the number of times its
 * due weekday occurs this month, plus every monthly loan's amount.
 */
function monthTarget(loans, today) {
  const [year, month] = today.split('-').map(Number);
  const monthIndex = month - 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cycles = calculateCycleTargets(loans);
  const weekly = loans
    .filter((loan) => isActiveLoan(loan) && loan.cycle === 'Weekly')
    .reduce((sum, loan) => {
      const anchor = String(loan.nextDueDate || loanDate(loan) || today).slice(0, 10);
      const weekday = new Date(`${anchor}T00:00:00`).getDay();
      return sum + num(loan.collectionAmount) * weekdayCount(year, monthIndex, Number.isNaN(weekday) ? 0 : weekday);
    }, 0);
  return {
    amount: cycles.daily.amount * daysInMonth + weekly + cycles.monthly.amount,
    customers: new Set(loans.filter(isActiveLoan).map((loan) => loan.customerId)).size,
  };
}

function Row({ icon: Icon, tone, title, note, value, onOpen }) {
  return (
    <button type="button" className={`report-activity-row tone-${tone}`} onClick={onOpen}>
      <span className="report-activity-icon"><Icon size={18} /></span>
      <span className="report-activity-copy"><b>{title}</b><small>{note}</small></span>
      <strong>{value}</strong>
      <ChevronRight size={16} className="report-activity-go" aria-hidden="true" />
    </button>
  );
}

function Panel({ title, note, wide = false, children }) {
  return (
    <section className={`report-activity-panel ${wide ? 'wide' : ''}`.trim()} aria-label={title}>
      <div className="report-activity-heading"><span>{title}</span><small>{note}</small></div>
      <div className="report-activity-list">{children}</div>
    </section>
  );
}

/**
 * Four clickable activity panels on the Reports overview. Every figure is
 * all-time unless its note says "this month"; every row opens the matching
 * list (Loans, Customers, Collection, History, Capital, Savings, Expenses or
 * the Reports detail pages for fine and document charges).
 */
export default function ReportActivityBoard({ customers = [], loans = [], collections = [], payments = [], expenses = [], savings = [], capitalMetrics = {} }) {
  const navigate = useNavigate();
  const today = toInputDate();
  const monthKey = today.slice(0, 7);

  const data = useMemo(() => {
    const given = loans.reduce((sum, loan) => sum + num(loan.disbursedAmount ?? loan.principal), 0);
    const newLoans = loans.filter((loan) => loanDate(loan).slice(0, 7) === monthKey);
    const newLoanAmount = newLoans.reduce((sum, loan) => sum + num(loan.disbursedAmount ?? loan.principal), 0);

    const activeCustomerIds = new Set(loans.filter(isActiveLoan).map((loan) => String(loan.customerId)));
    const activeCustomers = customers.filter((customer) => activeCustomerIds.has(String(customer.id))).length;
    const newCustomers = customers.filter((customer) => String(customer.date || '').slice(0, 7) === monthKey).length;

    const collectionPayments = payments.filter((item) => item.type === 'Collection' && item.direction === 'in');
    const fine = collectionPayments.reduce((sum, item) => sum + num(item.fineAmount), 0);
    const collected = collectionPayments.reduce((sum, item) => (
      sum + (item.collectionAmount != null ? num(item.collectionAmount) : Math.max(0, num(item.amount) - num(item.fineAmount)))
    ), 0);
    const documentPayments = payments.filter((item) => item.type === 'Document Charge' && item.direction === 'in');
    const documents = documentPayments.reduce((sum, item) => sum + num(item.amount), 0);
    const outstanding = loans.filter(isActiveLoan).reduce((sum, loan) => sum + num(loan.outstanding), 0);

    const pendingRows = collections.filter((item) => {
      const status = String(item.status || '').toLowerCase();
      const due = String(item.date || '').slice(0, 10);
      return due && due <= today && status !== 'cancelled' && num(item.dueAmount) - num(item.paidAmount) > 0;
    });
    const pending = pendingRows.reduce((sum, item) => sum + Math.max(0, num(item.dueAmount) - num(item.paidAmount)), 0);

    const expensesPaid = capitalMetrics.expensesPaid ?? expenses.reduce((sum, item) => sum + num(item.amount), 0);
    const profit = calculateActualProfit({ loans, payments, expensesPaid }).actualProfit;
    const savingsTotal = capitalMetrics.savingsTotal ?? savings.reduce((sum, item) => sum + num(item.amount), 0);

    return {
      given, loanCount: loans.length, newLoanAmount, newLoanCount: newLoans.length,
      customerCount: customers.length, activeCustomers, newCustomers,
      target: monthTarget(loans, today), collected, collectedCount: collectionPayments.length,
      fine, documents, documentCount: documentPayments.length,
      outstanding, activeLoanCount: loans.filter(isActiveLoan).length,
      pending, pendingCount: pendingRows.length,
      profit, savingsTotal, savingsCount: savings.length,
      expensesPaid, expenseCount: expenses.length,
    };
  }, [customers, loans, collections, payments, expenses, savings, capitalMetrics, monthKey, today]);

  const monthName = new Date(`${today}T00:00:00`).toLocaleDateString('en-IN', { month: 'long' });
  const go = (url) => () => {
    navigate(url);
    // Fine / Document Charges open a detail view on this same /reports page.
    if (url.startsWith('/reports')) window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div className="report-activity-board">
      <Panel title="Loan Activity" note="Loans given out">
        <Row icon={CircleDollarSign} tone="blue" title="Loans" note={`${plural(data.loanCount, 'loan', 'loans')} · total given`} value={formatCurrency(data.given)} onOpen={go('/loans')} />
        <Row icon={CalendarRange} tone="green" title="New Loans" note={`${plural(data.newLoanCount, 'loan', 'loans')} in ${monthName}`} value={formatCurrency(data.newLoanAmount)} onOpen={go('/loans?period=this-month')} />
        <Row icon={WalletCards} tone="purple" title="Outstanding" note={plural(data.activeLoanCount, 'active loan', 'active loans')} value={formatCurrency(data.outstanding)} onOpen={go('/loans?status=Active')} />
      </Panel>

      <Panel title="Customer Activity" note="Customer base">
        <Row icon={UsersRound} tone="blue" title="Customers" note="All registered customers" value={data.customerCount} onOpen={go('/customers')} />
        <Row icon={UserCheck} tone="green" title="Active" note="With a running loan" value={data.activeCustomers} onOpen={go('/customers?status=active')} />
        <Row icon={UserPlus} tone="purple" title="New Customers" note={`Added in ${monthName}`} value={data.newCustomers} onOpen={go('/customers?period=this-month')} />
      </Panel>

      <Panel title="Other Activity" note="Profit, savings and spending">
        <Row icon={TrendingUp} tone={data.profit < 0 ? 'red' : 'green'} title="Profit" note="Actual profit earned" value={formatCurrency(data.profit)} onOpen={go('/capital')} />
        <Row icon={PiggyBank} tone="purple" title="Savings" note={plural(data.savingsCount, 'entry', 'entries')} value={formatCurrency(data.savingsTotal)} onOpen={go('/savings')} />
        <Row icon={ReceiptText} tone="orange" title="Expenses" note={plural(data.expenseCount, 'expense', 'expenses')} value={formatCurrency(data.expensesPaid)} onOpen={go('/expenses')} />
      </Panel>

      <Panel title="Collection Activity" note="Money coming in" wide>
        <Row icon={BadgeIndianRupee} tone="blue" title="Monthly Target" note={`All cycles · ${plural(data.target.customers, 'customer', 'customers')}`} value={formatCurrency(data.target.amount)} onOpen={go('/collection?view=all')} />
        <Row icon={HandCoins} tone="green" title="Collected" note={plural(data.collectedCount, 'payment', 'payments')} value={formatCurrency(data.collected)} onOpen={go('/payments?filter=Collection')} />
        <Row icon={Scale} tone="orange" title="Fine" note="Fines collected" value={formatCurrency(data.fine)} onOpen={go('/reports?activity=fine')} />
        <Row icon={FileText} tone="purple" title="Document Charges" note={plural(data.documentCount, 'charge', 'charges')} value={formatCurrency(data.documents)} onOpen={go('/reports?activity=documents')} />
        <Row icon={AlertTriangle} tone="red" title="Collection Pending" note={`Today + overdue · ${plural(data.pendingCount, 'due', 'dues')}`} value={formatCurrency(data.pending)} onOpen={go('/collection?view=all')} />
      </Panel>
    </div>
  );
}
