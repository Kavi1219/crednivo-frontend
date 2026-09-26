import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { recoverFromStaleChunk } from './utils/runtimeRecovery';
import './styles/variables.css';
import './styles/global.css';
import './styles/modules.css';
import './styles/responsive.css';

// Vite emits this event when an already-open tab references a hashed chunk
// from a previous deployment. Recover automatically instead of leaving a
// page-specific route on the error screen.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    // Only swallow the error when we are actually reloading. Calling
    // preventDefault() without reloading makes the page import resolve to
    // "undefined", which surfaced as the confusing
    // "Cannot read properties of undefined (reading 'default')" screen.
    // Letting it through shows the real reason (e.g. which file failed).
    if (recoverFromStaleChunk(event?.payload || event)) event.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
