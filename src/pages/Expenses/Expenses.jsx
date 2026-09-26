import { CalendarClock, Check, ChevronDown, Pencil, Plus, ReceiptText, Search, Trash2, UserRound, X } from 'lucide-react';
import { useMemo, useState, useRef } from 'react';
import ActionButton from '../../components/common/ActionButton';
import SummaryCard from '../../components/common/SummaryCard';
import { PageBackButton } from '../../components/GlobalBackButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Expenses.css';

const EXPENSE_CATEGORIES = ['General', 'Salary', 'Travel', 'Office', 'Food', 'Other'];
const EXPENSE_CATEGORY_FILTERS = ['All', ...EXPENSE_CATEGORIES];

export default function Expenses() {
  const actionLocksRef = useRef(new Set());

  const { expenses, addExpense, updateExpense, deleteExpense } = useCrednivo();
  const { user, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('All');
  const [form, setForm] = useState({ purpose: '', amount: '', category: 'General', date: toInputDate(), createdBy: '' });

  const today = toInputDate();
  const todays = useMemo(() => expenses.filter((item) => item.date === today), [expenses, today]);
  const total = todays.reduce((sum, item) => sum + item.amount, 0);
  const overall = expenses.reduce((sum, item) => sum + item.amount, 0);


  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((item) => {
      const matchesCategory =
        categoryFilter === 'All' ||
        String(item?.category || 'General').trim().toLowerCase() === categoryFilter.toLowerCase();

      if (!matchesCategory) return false;
      if (periodFilter === 'Today' && item.date !== today) return false;
      if (periodFilter === 'This Month' && String(item.date || '').slice(0, 7) !== today.slice(0, 7)) return false;
      if (!query) return true;

      const searchable = [
        item?.purpose,
        item?.category,
        item?.createdBy,
        item?.amount,
        item?.date,
        item?.id,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [expenses, categoryFilter, search, periodFilter, today]);

  const filteredExpenseTotal = useMemo(
    () => filteredExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [filteredExpenses]
  );

  const startAdd = () => {
    setEdit(null);
    setForm({ purpose: '', amount: '', category: 'General', date: today, createdBy: user?.displayName || '' });
    setOpen(true);
  };

  const startEdit = (item) => {
    setEdit(item);
    setForm({ ...item, amount: String(item.amount), createdBy: item.createdBy || '' });
    setOpen(true);
  };

  const save = async () => {
    if (actionLocksRef.current.has('save')) return;
    actionLocksRef.current.add('save');
    try {
    if (!form.purpose || Number(form.amount) <= 0 || saving) return;
    try {
      setSaving(true);
      if (edit) await updateExpense(edit.id, form);
      else await addExpense(form);
      setOpen(false);
      setEdit(null);
    } catch (error) {
      window.alert(error?.message || 'Unable to save expense');
    } finally {
      setSaving(false);
    }
  
    } finally {
      actionLocksRef.current.delete('save');
    }
  };

  const removeExpense = async () => {
    if (actionLocksRef.current.has('removeExpense')) return;
    actionLocksRef.current.add('removeExpense');
    try {
    if (!deleteItem || saving) return;
    try {
      setSaving(true);
      await deleteExpense(deleteItem.id);
      setDeleteItem(null);
    } catch (error) {
      window.alert(error?.message || 'Unable to delete expense');
    } finally {
      setSaving(false);
    }
  
    } finally {
      actionLocksRef.current.delete('removeExpense');
    }
  };

  return (
    <div className="module-page expenses-page">
      <ModuleHeader
        eyebrow="Daily Spending"
        title="Expenses"
        description="Record day-to-day business expenses. Entries can be edited or deleted, and today's total is calculated automatically."
        actions={
          <div className="page-actions-row">
            <PageBackButton />
            {hasPermission('expenses.add') && <ActionButton icon={Plus} onClick={startAdd}>Add Expense</ActionButton>}
          </div>
        }
      />

      <section className="stats-section">
        <div className="expense-summary-grid">
          <SummaryCard title="Today's Expenses" value={formatCurrency(total)} note="Recorded today" icon={ReceiptText} tone="red" />
          <SummaryCard title="Overall Expenses" value={formatCurrency(overall)} note="All-time total" icon={ReceiptText} tone="orange" />
        </div>
      </section>

      <section className="module-card">
        <div className="expense-section-title">
          <div>
            <h2>Expense History</h2>
            <span>Latest entries first</span>
          </div>
          <div className="expense-filter-summary">
            <span>{filteredExpenses.length} {filteredExpenses.length === 1 ? 'entry' : 'entries'}</span>
            <strong>{formatCurrency(filteredExpenseTotal)}</strong>
          </div>
        </div>

        <div className="module-toolbar expense-filter-row">
          <label className="module-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search purpose, category, creator or amount..."
              aria-label="Search expense history"
            />
          </label>
          <div className="expense-quick-select">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Category">
              {EXPENSE_CATEGORY_FILTERS.map((category) => (
                <option key={category} value={category}>
                  {category === 'All' ? 'All Category' : category}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="expense-quick-select">
            <CalendarClock size={15} className="expense-quick-select-lead" />
            <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} aria-label="Date" className="has-lead">
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="This Month">This Month</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table">
            <thead><tr><th>Date</th><th>Purpose</th><th>Category</th><th>Created By</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredExpenses.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td><strong>{item.purpose}</strong></td>
                  <td><span className="soft-chip orange">{item.category}</span></td>
                  <td>
                    <div className="expense-created-by">
                      <span><UserRound size={14} /></span>
                      <strong>{item.createdBy || 'Not recorded'}</strong>
                    </div>
                  </td>
                  <td><strong>{formatCurrency(item.amount)}</strong></td>
                  <td>
                    <div className="row-actions">
                      {hasPermission('expenses.edit') && <IconButton size="sm" label={`Edit ${item.purpose}`} onClick={() => startEdit(item)}><Pencil size={15} /></IconButton>}
                      {hasPermission('expenses.delete') && <IconButton size="sm" label={`Delete ${item.purpose}`} onClick={() => setDeleteItem(item)}><Trash2 size={15} /></IconButton>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td className="expense-filter-empty" colSpan="6">
                    {search
                      ? `No expenses found for “${search}”.`
                      : `No ${categoryFilter === 'All' ? '' : `${categoryFilter} `}expenses found.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mobile-data-list">
          {filteredExpenses.map((item) => (
            <article className="mobile-data-card" key={item.id}>
              <div className="mobile-data-top">
                <div><strong>{item.purpose}</strong><small className="table-sub">{formatDate(item.date)} · {item.category}</small></div>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
              <div className="expense-mobile-created">
                <UserRound size={14} />
                <span>Created by <strong>{item.createdBy || 'Not recorded'}</strong></span>
              </div>
              <div className="expense-mobile-actions">
                {hasPermission('expenses.edit') && <IconButton size="sm" label="Edit expense" onClick={() => startEdit(item)}><Pencil size={15} /></IconButton>}
                {hasPermission('expenses.delete') && <IconButton size="sm" label="Delete expense" onClick={() => setDeleteItem(item)}><Trash2 size={15} /></IconButton>}
              </div>
            </article>
          ))}
          {filteredExpenses.length === 0 && (
            <div className="expense-mobile-filter-empty">
              {search
                ? `No expenses found for “${search}”.`
                : `No ${categoryFilter === 'All' ? '' : `${categoryFilter} `}expenses found.`}
            </div>
          )}
        </div>
      </section>

      {open && (
        <div className="collection-modal-backdrop" onMouseDown={() => setOpen(false)}>
          <div className="collection-modal module-card" onMouseDown={(event) => event.stopPropagation()}>
            <div className="collection-modal-head">
              <div><strong>{edit ? 'Edit Expense' : 'Add Expense'}</strong><span>{edit ? 'Update the selected expense' : 'Record a new business expense'}</span></div>
              <IconButton label="Close" onClick={() => setOpen(false)}><X size={18} /></IconButton>
            </div>
            <div className="form-grid expense-form">
              <div className="form-field span-2">
                <label>Purpose</label>
                <input value={form.purpose} onChange={(event) => setForm((value) => ({ ...value, purpose: event.target.value }))} placeholder="Fuel, stationery, travel..." />
              </div>
              <div className="form-field">
                <label>Amount</label>
                <input type="number" min="1" value={form.amount} onChange={(event) => setForm((value) => ({ ...value, amount: event.target.value }))} />
              </div>
              <div className="form-field">
                <label>Category</label>
                <select value={form.category} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}>
                  {EXPENSE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Created By</label>
                <input value={edit ? (form.createdBy || 'Not recorded') : (user?.displayName || 'Signed-in user')} readOnly />
                <small className="expense-creator-note">Automatically recorded from the signed-in CREDNIVO account.</small>
              </div>
              <div className="form-field">
                <label>Date</label>
                <input type="date" value={form.date} onChange={(event) => setForm((value) => ({ ...value, date: event.target.value }))} />
              </div>
            </div>
            <ActionButton icon={Check} onClick={save} disabled={saving}>{saving ? 'Saving...' : edit ? 'Save Changes' : 'Save Expense'}</ActionButton>
          </div>
        </div>
      )}

      {deleteItem && (
        <div className="collection-modal-backdrop">
          <div className="delete-expense-dialog module-card">
            <span className="delete-expense-icon"><Trash2 size={22} /></span>
            <h2>Delete Expense?</h2>
            <p><strong>{deleteItem.purpose}</strong> · {formatCurrency(deleteItem.amount)}</p>
            <small>This permanently removes the expense and its linked payment-history entry from PostgreSQL.</small>
            <div>
              <ActionButton tone="secondary" onClick={() => setDeleteItem(null)}>Cancel</ActionButton>
              <ActionButton tone="danger" icon={Trash2} onClick={removeExpense} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
