import './ActionButton.css';

export default function ActionButton({ children, icon: Icon, tone = 'primary', className = '', ...props }) {
  return (
    <button className={`action-button ${tone} ${className}`} {...props}>
      {Icon && <Icon size={17} />}
      <span>{children}</span>
    </button>
  );
}
