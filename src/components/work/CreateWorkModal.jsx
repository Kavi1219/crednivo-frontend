import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Search, Signal, X } from 'lucide-react';
import IconButton from '../common/IconButton';
import ActionButton from '../common/ActionButton';
import CustomerAvatar from '../common/CustomerAvatar';
import { createWork } from '../../services/work';
import './CreateWorkModal.css';

const PRIORITIES = [
  { value: 'NORMAL', label: 'Normal', icon: Signal, tone: 'blue', hint: 'Whenever it fits' },
  { value: 'IMPORTANT', label: 'Important', icon: Clock3, tone: 'orange', hint: 'Needs attention soon' },
  { value: 'URGENT', label: 'Urgent', icon: AlertTriangle, tone: 'danger', hint: 'Handle right away' },
];

const QUICK_HOURS = [
  { label: '2 hrs', value: 2 },
  { label: '6 hrs', value: 6 },
  { label: '24 hrs', value: 24 },
  { label: '48 hrs', value: 48 },
];

export default function CreateWorkModal({ agents, onClose, onCreated }) {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [agentEmployeeId, setAgentEmployeeId] = useState('');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const eligibleAgents = useMemo(
    () => (agents || []).filter((a) => a.status === 'Active'),
    [agents],
  );
  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return eligibleAgents;
    return eligibleAgents.filter((a) => `${a.name} ${a.id}`.toLowerCase().includes(q));
  }, [eligibleAgents, agentSearch]);

  const selectedAgent = eligibleAgents.find((a) => a.id === agentEmployeeId) || null;

  const showPriority = message.trim().length > 0;
  const showAgents = showPriority && Boolean(priority);
  const showTime = showAgents && Boolean(agentEmployeeId);

  const submit = async () => {
    if (busy) return;
    const hoursNum = Number(hours);
    if (!message.trim() || !priority || !agentEmployeeId || !hoursNum || hoursNum < 1) {
      setError('Fill in every step before assigning the work.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await createWork({
        agentEmployeeId,
        priority,
        message: message.trim(),
        hours: hoursNum,
      });
      onCreated?.(created);
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not assign this work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="work-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="work-modal app-card" role="dialog" aria-modal="true" aria-label="Create work">
        <div className="work-modal-head">
          <div><small>ASSIGN WORK</small><h2>Create Work</h2><p>Describe the task, set its priority, pick an agent, and give it a time limit.</p></div>
          <IconButton label="Close" onClick={onClose}><X size={19} /></IconButton>
        </div>

        <div className="work-modal-body">
          <div className="work-step">
            <span className="work-step-label">1. What needs to be done?</span>
            <textarea
              className="work-message-input"
              rows={3}
              placeholder="e.g. Visit SFC-0051 and collect today's overdue payment"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              autoFocus
            />
          </div>

          {showPriority && (
            <div className="work-step">
              <span className="work-step-label">2. Priority</span>
              <div className="work-priority-grid">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`work-priority-card ${p.tone} ${priority === p.value ? 'active' : ''}`}
                    onClick={() => setPriority(p.value)}
                  >
                    <p.icon size={17} aria-hidden="true" />
                    <strong>{p.label}</strong>
                    <small>{p.hint}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showAgents && (
            <div className="work-step">
              <span className="work-step-label">3. Assign to</span>
              <label className="work-agent-search"><Search size={15} /><input placeholder="Search agent by name or ID..." value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} /></label>
              <div className="work-agent-list">
                {filteredAgents.length === 0 && <p className="work-agent-empty">No active agents match that search.</p>}
                {filteredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    className={`work-agent-row ${agentEmployeeId === agent.id ? 'active' : ''}`}
                    onClick={() => setAgentEmployeeId(agent.id)}
                  >
                    <CustomerAvatar name={agent.name} photo={agent.photo} className="work-agent-avatar" />
                    <span className="work-agent-copy"><strong>{agent.name}</strong><small>{agent.id}</small></span>
                    {agentEmployeeId === agent.id && <CheckCircle2 size={17} className="work-agent-check" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showTime && (
            <div className="work-step">
              <span className="work-step-label">4. Time period</span>
              <div className="work-hours-row">
                {QUICK_HOURS.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    className={`work-hours-chip ${Number(hours) === q.value ? 'active' : ''}`}
                    onClick={() => setHours(String(q.value))}
                  >
                    {q.label}
                  </button>
                ))}
                <label className="work-hours-custom">
                  <input type="number" min="1" placeholder="Custom" value={hours} onChange={(e) => setHours(e.target.value)} />
                  <span>hrs</span>
                </label>
              </div>
              <p className="work-hours-hint">
                {selectedAgent?.name} gets notified now, and reminded if they haven't started within {hours || '—'} hour{hours === '1' ? '' : 's'}.
              </p>
            </div>
          )}

          {error && <div className="work-modal-error">{error}</div>}
        </div>

        <div className="work-modal-actions">
          <ActionButton tone="secondary" onClick={onClose}>Cancel</ActionButton>
          <ActionButton
            icon={CheckCircle2}
            onClick={submit}
            disabled={busy || !showTime || !hours}
          >
            {busy ? 'Assigning...' : 'Assign Work'}
          </ActionButton>
        </div>
      </section>
    </div>
  );
}
