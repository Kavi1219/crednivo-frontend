import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCrednivo } from '../../context/CrednivoContext';
import { toInputDate } from '../../utils/finance';
import './AddExpenseModal.css';

export default function AddExpenseModal({ open, onClose }) {
  const { addExpense } = useCrednivo();
  const { user } = useAuth();
  const [form, setForm] = useState({ purpose: '', amount: '', category: 'General', date: toInputDate(), createdBy: user?.displayName || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const close = () => {
    setForm({ purpose: '', amount: '', category: 'General', date: toInputDate(), createdBy: user?.displayName || '' });
    setError('');
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.purpose.trim() || !form.amount) {
      setError('Purpose and amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await addExpense(form);
      close();
    } catch (err) {
      setError(err?.message || 'Could not save the expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-expense-backdrop" onMouseDown={close}>
      <div className="add-expense-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="add-expense-head">
          <h2>Add Expense</h2>
          <button type="button" className="add-expense-close" onClick={close}><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="add-expense-form">
          <label>
            <span>Purpose</span>
            <input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} autoFocus required />
          </label>
          <label>
            <span>Amount</span>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
          </label>
          <label>
            <span>Category</span>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              <option>General</option><option>Salary</option><option>Travel</option><option>Office</option><option>Food</option><option>Other</option>
            </select>
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </label>
          <label>
            <span>Created By</span>
            <input value={form.createdBy} onChange={(e) => setForm((f) => ({ ...f, createdBy: e.target.value }))} />
          </label>
          {error && <div className="add-expense-error">{error}</div>}
          <button type="submit" className="add-expense-submit" disabled={saving}>
            <Check size={16} /> {saving ? 'Saving…' : 'Save Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
