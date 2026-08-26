import { Check, Pencil, Plus, ReceiptText, Trash2, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import ActionButton from '../../components/common/ActionButton';
import IconButton from '../../components/common/IconButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, toInputDate } from '../../utils/finance';
import './Expenses.css';

export default function Expenses() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useCrednivo();
  const { user, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ purpose: '', amount: '', category: 'General', date: toInputDate(), createdBy: '' });

  const today = toInputDate();
  const todays = useMemo(() => expenses.filter((item) => item.date === today), [expenses, today]);
  const total = todays.reduce((sum, item) => sum + item.amount, 0);
  const overall = expenses.reduce((sum, item) => sum + item.amount, 0);

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
  };

  const removeExpense = async () => {
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
  };

  return (
    <div className="module-page expenses-page">
      <ModuleHeader
        eyebrow="Daily Spending"
        title="Expenses"
        description="Record day-to-day business expenses. Entries can be edited or deleted, and today's total is calculated automatically."
        actions={hasPermission('expenses.add') ? <ActionButton icon={Plus} onClick={startAdd}>Add Expense</ActionButton> : null}
      />

      <section className="metric-strip expense-metric-strip">
        <article className="mini-metric module-card">
          <span className="mini-metric-icon"><ReceiptText size={20} /></span>
          <div><span>Today's Expenses</span><strong>{formatCurrency(total)}</strong></div>
        </article>
        <article className="mini-metric module-card">
          <span className="mini-metric-icon"><ReceiptText size={20} /></span>
          <div><span>Overall Expenses</span><strong>{formatCurrency(overall)}</strong></div>
        </article>
      </section>

      <section className="module-card">
        <div className="expense-section-title">
          <h2>Expense History</h2>
          <span>Latest entries first</span>
        </div>

        <div className="module-table-wrap desktop-data-table">
          <table className="module-table">
            <thead><tr><th>Date</th><th>Purpose</th><th>Category</th><th>Created By</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>
              {expenses.map((item) => (
                <tr key={item.id}>
                  <td>{formatDate(item.date)}</td>
                  <td><strong>{item.purpose}</strong><small className="table-sub">{item.id}</small></td>
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
            </tbody>
          </table>
        </div>

        <div className="mobile-data-list">
          {expenses.map((item) => (
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
                  <option>General</option><option>Travel</option><option>Office</option><option>Food</option><option>Other</option>
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
