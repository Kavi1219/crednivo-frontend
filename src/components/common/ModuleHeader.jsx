import './ModuleHeader.css';

export default function ModuleHeader({ actions }) {
  if (!actions) return null;
  return (
    <div className="module-header module-header-actions-only">
      <div className="module-header-actions">{actions}</div>
    </div>
  );
}
