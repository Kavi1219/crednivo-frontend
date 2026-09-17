import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, PlayCircle, Plus, Signal, TimerReset } from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import CreateWorkModal from '../../components/work/CreateWorkModal';
import { useAuth } from '../../context/AuthContext';
import { useCrednivo } from '../../context/CrednivoContext';
import { listWork, startWork, completeWork, requestWorkExtension, extendWork, rescheduleWork } from '../../services/work';
import './Work.css';

const PRIORITY_META = {
  NORMAL: { label: 'Normal', tone: 'blue' },
  IMPORTANT: { label: 'Important', tone: 'orange' },
  URGENT: { label: 'Urgent', tone: 'danger' },
};

const STATUS_META = {
  ASSIGNED: { label: 'Not Started', tone: 'orange' },
  STARTED: { label: 'In Progress', tone: 'blue' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  SCHEDULED: { label: 'Scheduled', tone: 'purple' },
};

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function formatDay(value) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function Work() {
  const { isOwner } = useAuth();
  const { agents } = useCrednivo();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [extensionDraft, setExtensionDraft] = useState({});
  const [openRespondId, setOpenRespondId] = useState(null);
  const [extendHours, setExtendHours] = useState('24');
  const [rescheduleDate, setRescheduleDate] = useState('');

  const refresh = async () => {
    try {
      const data = await listWork();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Could not load work items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const sorted = useMemo(() => {
    const rank = { URGENT: 0, IMPORTANT: 1, NORMAL: 2 };
    return [...items].sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));
  }, [items]);

  const runAction = async (id, fn) => {
    setBusyId(id);
    setError('');
    try {
      const updated = await fn();
      setItems((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  const submitExtensionRequest = (id) => {
    const message = extensionDraft[id]?.trim();
    runAction(id, () => requestWorkExtension(id, message));
    setExtensionDraft((current) => ({ ...current, [id]: '' }));
  };

  const submitExtend = (id) => {
    const hours = Number(extendHours);
    if (!hours || hours < 1) return;
    runAction(id, () => extendWork(id, hours));
    setOpenRespondId(null);
  };

  const submitReschedule = (id) => {
    if (!rescheduleDate) return;
    runAction(id, () => rescheduleWork(id, rescheduleDate));
    setOpenRespondId(null);
    setRescheduleDate('');
  };

  return (
    <div className="module-page work-page">
      <ModuleHeader
        eyebrow="Task Assignment"
        title="Work"
        description={isOwner ? 'Assign work to agents and track progress.' : 'Work assigned to you.'}
        actions={isOwner ? <ActionButton icon={Plus} onClick={() => setCreateOpen(true)}>Create Work</ActionButton> : null}
      />

      {error && <div className="work-page-error">{error}</div>}

      {!loading && sorted.length === 0 && (
        <div className="work-empty module-card">
          <Signal size={22} aria-hidden="true" />
          <strong>No work items yet</strong>
          <span>{isOwner ? 'Create work and assign it to an agent to get started.' : "Nothing's been assigned to you yet."}</span>
        </div>
      )}

      <div className="work-list">
        {sorted.map((item) => {
          const priorityMeta = PRIORITY_META[item.priority] || PRIORITY_META.NORMAL;
          const statusMeta = STATUS_META[item.status] || STATUS_META.ASSIGNED;
          const isBusy = busyId === item.id;
          const hasExtensionRequest = Boolean(item.extensionMessage) && item.status !== 'COMPLETED';

          return (
            <article className={`work-card module-card ${item.overdue ? 'overdue' : ''}`} key={item.id}>
              <div className="work-card-top">
                <span className={`work-chip ${priorityMeta.tone}`}>{priorityMeta.label}</span>
                <span className={`work-chip ${statusMeta.tone}`}>{statusMeta.label}</span>
                {item.overdue && <span className="work-chip danger"><AlertTriangle size={11} aria-hidden="true" /> Overdue</span>}
              </div>

              <p className="work-card-message">{item.message}</p>

              <div className="work-card-meta">
                {isOwner && <span><strong>{item.assignedAgentName}</strong> · {item.assignedAgentEmployeeId}</span>}
                {item.status === 'SCHEDULED'
                  ? <span>Starts {formatDay(item.scheduledStartAt)}</span>
                  : <span>Due {formatDateTime(item.deadlineAt)}</span>}
              </div>

              {hasExtensionRequest && (
                <div className="work-extension-banner">
                  <Clock3 size={14} aria-hidden="true" />
                  <span><strong>Asked for more time:</strong> {item.extensionMessage}</span>
                </div>
              )}

              <div className="work-card-actions">
                {!isOwner && item.status === 'ASSIGNED' && (
                  <ActionButton icon={PlayCircle} onClick={() => runAction(item.id, () => startWork(item.id))} disabled={isBusy}>
                    {isBusy ? 'Starting...' : 'Start Work'}
                  </ActionButton>
                )}
                {!isOwner && item.status === 'STARTED' && (
                  <ActionButton icon={CheckCircle2} onClick={() => runAction(item.id, () => completeWork(item.id))} disabled={isBusy}>
                    {isBusy ? 'Completing...' : 'Mark Complete'}
                  </ActionButton>
                )}
                {!isOwner && (item.status === 'ASSIGNED' || item.status === 'STARTED') && !hasExtensionRequest && (
                  <div className="work-inline-request">
                    <input
                      placeholder="Explain why you need more time..."
                      value={extensionDraft[item.id] || ''}
                      onChange={(e) => setExtensionDraft((c) => ({ ...c, [item.id]: e.target.value }))}
                    />
                    <ActionButton tone="secondary" icon={TimerReset} onClick={() => submitExtensionRequest(item.id)} disabled={isBusy}>Request Time</ActionButton>
                  </div>
                )}

                {isOwner && hasExtensionRequest && (
                  openRespondId === item.id ? (
                    <div className="work-inline-respond">
                      <div className="work-inline-respond-row">
                        <span>Extend by</span>
                        <input type="number" min="1" value={extendHours} onChange={(e) => setExtendHours(e.target.value)} />
                        <span>hrs</span>
                        <ActionButton onClick={() => submitExtend(item.id)} disabled={isBusy}>Confirm</ActionButton>
                      </div>
                      <div className="work-inline-respond-row">
                        <span>or restart on</span>
                        <input type="date" value={rescheduleDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setRescheduleDate(e.target.value)} />
                        <ActionButton tone="secondary" onClick={() => submitReschedule(item.id)} disabled={isBusy}>Confirm</ActionButton>
                      </div>
                      <button type="button" className="work-inline-cancel" onClick={() => setOpenRespondId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <ActionButton tone="secondary" icon={TimerReset} onClick={() => { setOpenRespondId(item.id); setExtendHours('24'); setRescheduleDate(''); }}>
                      Respond
                    </ActionButton>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>

      {createOpen && (
        <CreateWorkModal
          agents={agents}
          onClose={() => setCreateOpen(false)}
          onCreated={(created) => setItems((current) => [created, ...current])}
        />
      )}
    </div>
  );
}
