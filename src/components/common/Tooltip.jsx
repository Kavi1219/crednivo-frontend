import './Tooltip.css';

export default function Tooltip({ label, children, side = 'top' }) {
  return (
    <span className={`tooltip-wrap tooltip-${side}`}>
      {children}
      <span className="tooltip-bubble" role="tooltip">{label}</span>
    </span>
  );
}
