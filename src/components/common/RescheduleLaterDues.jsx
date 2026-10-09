import { formatDate } from '../../utils/finance';
import './RescheduleLaterDues.css';

const DONE = new Set(['Paid', 'Fine', 'Cancelled']);
const dayNumber = (value) => {
  const [y, m, d] = String(value || '').slice(0, 10).split('-').map(Number);
  return y ? Date.UTC(y, m - 1, d) / 86400000 : NaN;
};
const addDays = (value, days) => new Date((dayNumber(value) + days) * 86400000).toISOString().slice(0, 10);

/** Unpaid dues of the same loan that come after this one. */
export function laterDuesFor(collections = [], entry) {
  if (!entry?.loanId) return [];
  return collections
    .filter((item) => item.loanId === entry.loanId && item.id !== entry.id)
    .filter((item) => String(item.date) > String(entry.date) && !DONE.has(item.status))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** True when nothing of this loan is scheduled before this entry (it is installment #1). */
export function isFirstInstallment(collections = [], entry) {
  if (!entry?.loanId) return false;
  return !collections.some((item) => item.loanId === entry.loanId && item.id !== entry.id && String(item.date) < String(entry.date));
}

/**
 * Reschedule option: "Also move the later dues". Shows what the next dates become,
 * e.g. moving a weekly due from Friday to Sunday turns every later due into a Sunday.
 */
export default function RescheduleLaterDues({ collections, entry, newDate, checked, onChange }) {
  const later = laterDuesFor(collections, entry);
  if (!later.length) return null;
  const shift = newDate ? dayNumber(newDate) - dayNumber(entry.date) : 0;
  const preview = shift ? later.slice(0, 3).map((item) => formatDate(addDays(item.date, shift))) : [];
  const shiftText = `${Math.abs(shift)} day${Math.abs(shift) === 1 ? '' : 's'} ${shift > 0 ? 'later' : 'earlier'}`;

  return (
    <label className={`reschedule-later-dues ${checked ? 'on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>Also move the {later.length} later {later.length === 1 ? 'due' : 'dues'}</strong>
        <small>
          {!shift
            ? 'They keep the same gap as this one, so the whole schedule follows the new date.'
            : checked
              ? `Each moves ${shiftText}: ${preview.join(', ')}${later.length > 3 ? ', …' : ''}`
              : `Only this due moves. Next due stays ${formatDate(later[0].date)}.`}
        </small>
      </span>
    </label>
  );
}
