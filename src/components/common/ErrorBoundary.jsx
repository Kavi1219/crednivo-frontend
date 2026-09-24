import React from 'react';
import './ErrorBoundary.css';
import { recoverFromStaleChunk } from '../../utils/runtimeRecovery';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (recoverFromStaleChunk(error)) return;
    console.error('CREDNIVO render error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    // Never clear cached business data from a generic render-error screen.
    // Returning home is enough; server data remains the source of truth.
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
            <button type="button" className="secondary" onClick={this.handleReset}>Go to Home</button>
          </div>
        </section>
      </main>
    );
  }
}
