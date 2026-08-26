import Tooltip from './Tooltip';
import './IconButton.css';

export default function IconButton({ label, children, onClick, className = '', type = 'button', size = 'md' }) {
  return (
    <Tooltip label={label}>
      <button
        type={type}
        onClick={onClick}
        className={`icon-btn icon-btn-${size} ${className}`}
        aria-label={label}
      >
        {children}
      </button>
    </Tooltip>
  );
}
