import React from 'react';
import './ErrorBoundary.css';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('CREDNIVO render error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('crednivo-phase2-data');
    } catch {
      // Ignore storage access failures.
    }
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="crednivo-error-screen">
        <section className="crednivo-error-card">
          <div className="crednivo-error-mark">!</div>
          <p className="crednivo-error-eyebrow">CREDNIVO</p>
          <h1>Something stopped this page from loading.</h1>
          <p className="crednivo-error-copy">The app caught the problem instead of showing a blank screen. Open the browser console for the exact technical message.</p>
          <pre>{this.state.error?.message || 'Unknown rendering error'}</pre>
          <div className="crednivo-error-actions">
            <button type="button" onClick={this.handleReload}>Reload Page</button>
            <button type="button" className="secondary" onClick={this.handleReset}>Reset Demo Data</button>
          </div>
        </section>
      </main>
    );
  }
}
