import './ModuleHeader.css';

export default function ModuleHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="module-header">
      <div>
        {eyebrow && <span className="module-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="module-header-actions">{actions}</div>}
    </div>
  );
}
