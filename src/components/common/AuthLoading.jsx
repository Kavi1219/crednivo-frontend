import '../../pages/Auth/Auth.css';

export default function AuthLoading() {
  return (
    <main className="auth-loading auth-loading-classic">
      <div className="auth-loading-new-logo" aria-hidden="true">
        <span className="auth-loading-c-shape" />
        <span className="auth-loading-bar auth-loading-bar-1" />
        <span className="auth-loading-bar auth-loading-bar-2" />
        <span className="auth-loading-bar auth-loading-bar-3" />
        <span className="auth-loading-arrow-line" />
        <span className="auth-loading-arrow-head" />
      </div>

      <strong>CREDNIVO</strong>
      <small>Securing workspace...</small>
    </main>
  );
}
