import { Link, Navigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AuthLoading from '../../components/common/AuthLoading';
import CrednivoMark from '../../components/brand/CrednivoMark';
import './LandingPage.css';

export default function LandingPage() {
  const { loading, user } = useAuth();

  if (loading) return <AuthLoading />;
  // Already signed in — go straight to the workspace instead of the pitch.
  if (user) return <Navigate to="/overview" replace />;

  return (
    <div className="landing-page">
      <span className="landing-ring" aria-hidden="true" />

      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <CrednivoMark size={34} />
          <span>CREDNIVO</span>
        </Link>
        <Link to="/login" className="landing-signin-btn">Sign In</Link>
      </header>

      <main className="landing-hero">
        <span className="landing-kicker">Finance Management Platform</span>
        <h1>Run your lending business<br />from your pocket.</h1>
        <p>Customers, loans, collections and reports — all in one place, built for daily field operations.</p>

        <div className="landing-cta-row">
          <Link to="/download" className="landing-cta-primary">
            <Download size={19} aria-hidden="true" />
            <span>Download for Android</span>
          </Link>
          <Link to="/login" className="landing-cta-secondary">Sign in instead</Link>
        </div>
      </main>
    </div>
  );
}
