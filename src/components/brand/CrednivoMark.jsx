import './CrednivoMark.css';

export default function CrednivoMark({ className = '', size = 48, title = 'CREDNIVO' }) {
  return (
    <span
      className={`crednivo-final-mark ${className}`.trim()}
      style={{ '--crednivo-mark-size': `${size}px` }}
      role="img"
      aria-label={title}
    >
      <span className="crednivo-final-ring" />
      <span className="crednivo-final-bars">
        <i className="crednivo-final-bar bar-a" />
        <i className="crednivo-final-bar bar-b" />
        <i className="crednivo-final-bar bar-c" />
      </span>
      <span className="crednivo-final-arrow">
        <i className="crednivo-final-arrow-line" />
        <i className="crednivo-final-arrow-head" />
      </span>
    </span>
  );
}
