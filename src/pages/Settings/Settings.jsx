import { useEffect, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import ModuleHeader from '../../components/common/ModuleHeader';
import ChangePasswordModal from '../../components/layout/ChangePasswordModal';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { isNativeCrednivoApp, readPinRecord, savePinRecord, deletePinRecord } from '../../services/nativeAppLock';
import { isPushSupported, getPushPermission, getCurrentSubscription, enableWebPush, disableWebPush } from '../../services/push';
import { apiRequest } from '../../services/api';
import './Settings.css';

const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
];

const baseCategories = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'account', label: 'Account' },
  { id: 'security', label: 'Security' },
];

export default function Settings() {
  const { uiSettings, resolvedTheme, updateUiSettings } = useCrednivo();
  const { user, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState('appearance');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [coOwnerForm, setCoOwnerForm] = useState({ ownerName: '', ownerMobile: '', email: '', username: '', password: '' });
  const [coOwnerBusy, setCoOwnerBusy] = useState(false);
  const [coOwnerMessage, setCoOwnerMessage] = useState('');
  const [coOwnerError, setCoOwnerError] = useState('');

  const submitCoOwner = async (event) => {
    event.preventDefault();
    setCoOwnerBusy(true);
    setCoOwnerError('');
    setCoOwnerMessage('');
    try {
      const result = await apiRequest('/auth/add-owner', {
        method: 'POST',
        body: JSON.stringify(coOwnerForm),
      });
      setCoOwnerMessage(result?.message || 'Co-owner account created.');
      setCoOwnerForm({ ownerName: '', ownerMobile: '', email: '', username: '', password: '' });
    } catch (err) {
      setCoOwnerError(err?.message || 'Could not create the account.');
    } finally {
      setCoOwnerBusy(false);
    }
  };

  const native = isNativeCrednivoApp();
  const [lockRecord, setLockRecord] = useState(null);
  const [lockBusy, setLockBusy] = useState(false);
  const lockEnabled = lockRecord ? lockRecord.lockEnabled !== false : true;

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const pushSupported = !native && isPushSupported();
  const pushDenied = pushSupported && getPushPermission() === 'denied';

  useEffect(() => {
    if (!native) return undefined;
    let cancelled = false;
    readPinRecord(user).then((record) => { if (!cancelled) setLockRecord(record); });
    return () => { cancelled = true; };
  }, [native, user]);

  useEffect(() => {
    if (!pushSupported) return undefined;
    let cancelled = false;
    getCurrentSubscription().then((sub) => { if (!cancelled) setPushSubscribed(Boolean(sub)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [pushSupported]);

  const categories = baseCategories;

  const toggleLock = async () => {
    setLockBusy(true);
    try {
      if (lockEnabled) {
        const next = {
          ...(lockRecord || { version: 1, salt: '', pinHash: '', biometricEnabled: false }),
          lockEnabled: false,
          updatedAt: new Date().toISOString(),
        };
        await savePinRecord(user, next);
        setLockRecord(next);
      } else if (lockRecord?.pinHash) {
        const next = { ...lockRecord, lockEnabled: true, updatedAt: new Date().toISOString() };
        await savePinRecord(user, next);
        setLockRecord(next);
      } else {
        await deletePinRecord(user);
        setLockRecord(null);
      }
      window.dispatchEvent(new Event('crednivo-lock-settings-changed'));
    } finally {
      setLockBusy(false);
    }
  };

  const toggleWebPush = async () => {
    setPushBusy(true);
    setPushError('');
    try {
      if (pushSubscribed) {
        await disableWebPush();
        setPushSubscribed(false);
      } else {
        await enableWebPush();
        setPushSubscribed(true);
      }
    } catch (err) {
      setPushError(err?.message || 'Could not update browser notifications.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="module-page settings-page">
      <ModuleHeader
        eyebrow="Personal Settings"
        title="Settings"
        description="Theme, language and your own account security are available to every signed-in user."
      />

      <section className="settings-shell module-card">
        <nav className="settings-nav" aria-label="Settings categories">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`settings-nav-item ${activeTab === cat.id ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'appearance' && (
            <>
              <h2 className="settings-content-title">Appearance</h2>

              <div className="settings-row">
                <div className="settings-row-copy">
                  <strong>Theme</strong>
                  <span>Currently {resolvedTheme === 'dark' ? 'dark' : 'light'}{uiSettings.theme === 'system' ? ' · following system' : ''}</span>
                </div>
                <div className="settings-pill-group" role="radiogroup" aria-label="Theme">
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={uiSettings.theme === option.value}
                      className={uiSettings.theme === option.value ? 'active' : ''}
                      onClick={() => updateUiSettings({ theme: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row-copy">
                  <strong>Language</strong>
                  <span>Interface language</span>
                </div>
                <div className="settings-select-wrap">
                  <select
                    className="settings-select"
                    value={uiSettings.language}
                    onChange={(event) => updateUiSettings({ language: event.target.value })}
                    aria-label="Language"
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="settings-select-chevron" aria-hidden="true" />
                </div>
              </div>
            </>
          )}

          {activeTab === 'account' && (
            <>
              <h2 className="settings-content-title">Account</h2>

              <div className="settings-row">
                <div className="settings-row-copy">
                  <strong>Password</strong>
                  <span>Change the password for your own {isOwner ? 'Owner' : 'Agent'} account</span>
                </div>
                <button type="button" className="settings-row-button" onClick={() => setPasswordModalOpen(true)}>
                  Change password
                </button>
              </div>

              <div className="settings-note">
                <ShieldCheck size={16} aria-hidden="true" />
                <div>
                  <strong>{isOwner ? 'Owner Administration' : 'Agent Access'}</strong>
                  <span>{isOwner
                    ? 'Business permissions are managed from Agents → Permissions. Company administration remains Owner-only.'
                    : 'Theme, language and your own password stay available even when business permissions are restricted by the Owner.'}</span>
                </div>
              </div>

              {isOwner && (
                <>
                  <h2 className="settings-content-title" style={{ marginTop: 24 }}>Add Co-Owner / MD</h2>
                  <p className="settings-subtext">
                    Give another person full Owner-level access to this same company. They'll be able to do
                    everything you can — there's no hierarchy between Owner accounts on the same company.
                  </p>
                  <form className="settings-form-grid" onSubmit={submitCoOwner}>
                    <label>
                      <span>Owner / MD Name</span>
                      <input
                        value={coOwnerForm.ownerName}
                        onChange={(e) => setCoOwnerForm((f) => ({ ...f, ownerName: e.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      <span>Mobile</span>
                      <input
                        value={coOwnerForm.ownerMobile}
                        onChange={(e) => setCoOwnerForm((f) => ({ ...f, ownerMobile: e.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      <span>Email (optional)</span>
                      <input
                        type="email"
                        value={coOwnerForm.email}
                        onChange={(e) => setCoOwnerForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Username</span>
                      <input
                        value={coOwnerForm.username}
                        onChange={(e) => setCoOwnerForm((f) => ({ ...f, username: e.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      <span>Password</span>
                      <input
                        type="password"
                        value={coOwnerForm.password}
                        onChange={(e) => setCoOwnerForm((f) => ({ ...f, password: e.target.value }))}
                        required
                      />
                    </label>
                    <button type="submit" className="settings-primary-btn" disabled={coOwnerBusy}>
                      {coOwnerBusy ? 'Adding…' : 'Add Co-Owner'}
                    </button>
                  </form>
                  {coOwnerMessage && <div className="settings-note settings-note-success">{coOwnerMessage}</div>}
                  {coOwnerError && <div className="settings-note settings-note-error">{coOwnerError}</div>}
                </>
              )}
            </>
          )}
          {activeTab === 'security' && (
            <>
              <h2 className="settings-content-title">Security</h2>

              {native && (
                <div className="settings-row">
                  <div className="settings-row-copy">
                    <strong>App PIN & Fingerprint Lock</strong>
                    <span>{lockEnabled
                      ? 'Unlock with your PIN or fingerprint each time you open the app'
                      : "Off — the app opens straight in once you're signed in"}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={lockEnabled}
                    aria-label="App PIN and fingerprint lock"
                    className={`settings-switch ${lockEnabled ? 'on' : ''}`}
                    onClick={toggleLock}
                    disabled={lockBusy}
                  >
                    <span className="settings-switch-thumb" />
                  </button>
                </div>
              )}

              {native && (
                <div className="settings-note">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <div>
                    <strong>Your account stays signed in</strong>
                    <span>
                      Turning this on keeps a quick local PIN or fingerprint check between you and the app instead of
                      asking for your account password every time — the same way most banking apps work. Your account
                      password is only needed again for a brand new device or a fresh install.
                    </span>
                  </div>
                </div>
              )}

              {pushSupported && (
                <div className="settings-row">
                  <div className="settings-row-copy">
                    <strong>Browser Notifications</strong>
                    <span>{pushDenied
                      ? 'Blocked in your browser settings — allow notifications for this site to turn it on here'
                      : pushSubscribed
                        ? "You'll get a popup here even when this tab isn't active"
                        : 'Get a real browser popup for new work and updates'}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={pushSubscribed}
                    aria-label="Browser notifications"
                    className={`settings-switch ${pushSubscribed ? 'on' : ''}`}
                    onClick={toggleWebPush}
                    disabled={pushBusy || pushDenied}
                  >
                    <span className="settings-switch-thumb" />
                  </button>
                </div>
              )}

              {!pushSupported && !native && (
                <div className="settings-note">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <div>
                    <strong>Browser Notifications</strong>
                    <span>Not supported in this browser.</span>
                  </div>
                </div>
              )}

              {pushError && <div className="settings-note"><ShieldCheck size={16} aria-hidden="true" /><div><strong>Couldn't update that</strong><span>{pushError}</span></div></div>}
            </>
          )}
        </div>
      </section>

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}
