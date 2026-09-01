import { useRef, useState } from 'react';
import './ActionButton.css';

export default function ActionButton({ children, icon: Icon, tone = 'primary', className = '', onClick, disabled = false, ...props }) {
  const clickLockRef = useRef(false);
  const [localBusy, setLocalBusy] = useState(false);

  const handleClick = async (event) => {
    if (disabled || clickLockRef.current) {
      event.preventDefault();
      return;
    }
    if (!onClick) return;

    clickLockRef.current = true;
    setLocalBusy(true);
    try {
      await onClick(event);
    } finally {
      clickLockRef.current = false;
      setLocalBusy(false);
    }
  };

  const buttonDisabled = disabled || localBusy;

  return (
    <button
      className={`action-button ${tone} ${className}`}
      {...props}
      disabled={buttonDisabled}
      aria-busy={localBusy || undefined}
      onClick={onClick ? handleClick : undefined}
    >
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </button>
  );
}
