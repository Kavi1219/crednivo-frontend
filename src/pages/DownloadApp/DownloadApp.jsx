import { Link } from 'react-router-dom';
import { Download, ShieldCheck, Smartphone } from 'lucide-react';
import CrednivoMark from '../../components/brand/CrednivoMark';
import './DownloadApp.css';

// Update this list each time a new APK is published as a GitHub Release
// asset (Settings tab isn't needed — just "Releases" → "Draft a new release"
// on the crednivo-frontend repo, tag it "downloads", and attach the APK).
// Newest entry first; mark exactly one as latest: true.
const RELEASE_BASE = 'https://github.com/Kavi1219/crednivo-frontend/releases/download/downloads';
const APK_VERSIONS = [
  { version: '1.0.3', file: 'Crednivo-v1.0.3.apk', size: '46.2 MB', latest: true },
  { version: '1.0.2', file: 'Crednivo-v1.0.2.apk', size: '23.2 MB' },
  { version: '1.0.1', file: 'Crednivo-v1.0.1.apk', size: '11.8 MB' },
  { version: '1.0.0', file: 'Crednivo-v1.0.0.apk', size: '7.8 MB' },
];

export default function DownloadApp() {
  const latest = APK_VERSIONS.find((v) => v.latest) || APK_VERSIONS[0];

  return (
    <div className="download-page">
      <div className="download-shell">
        <header className="download-head">
          <span className="download-mark"><CrednivoMark size={56} /></span>
          <h1>Get the Crednivo App</h1>
          <p>Manage customers, loans and collections on the go. Install the Android app below.</p>
        </header>

        <a className="download-primary" href={`${RELEASE_BASE}/${latest.file}`} download>
          <Download size={20} aria-hidden="true" />
          <span>
            <strong>Download for Android</strong>
            <small>Version {latest.version} · {latest.size}</small>
          </span>
        </a>

        <div className="download-ios-note">
          <Smartphone size={16} aria-hidden="true" />
          <p>
            On iPhone? There&apos;s no App Store app yet — open <strong>crednivo.in</strong> in Safari, tap
            Share, then <strong>Add to Home Screen</strong> for the same fast, full-screen experience.
          </p>
        </div>

        <section className="download-steps">
          <h2>How to install</h2>
          <ol>
            <li>Tap <strong>Download for Android</strong> above.</li>
            <li>Open the downloaded file from your notifications or Downloads folder.</li>
            <li>If Android warns about installing from an unknown source, tap <strong>Settings</strong> in that prompt and allow installs from this app — normal for apps installed outside the Play Store.</li>
            <li>Tap <strong>Install</strong>, then open Crednivo and sign in.</li>
          </ol>
          <div className="download-safe-note">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Every version here is built and published by Crednivo directly — nothing third-party.</span>
          </div>
        </section>

        <section className="download-versions">
          <h2>All versions</h2>
          <ul>
            {APK_VERSIONS.map((item) => (
              <li key={item.version} className={item.latest ? 'latest' : ''}>
                <div className="download-version-copy">
                  <strong>Version {item.version}</strong>
                  {item.latest && <span className="download-badge">Latest</span>}
                  <small>{item.size}</small>
                </div>
                <a href={`${RELEASE_BASE}/${item.file}`} download>Download</a>
              </li>
            ))}
          </ul>
        </section>

        <footer className="download-foot">
          <Link to="/login">Already have the app? Sign in →</Link>
        </footer>
      </div>
    </div>
  );
}
