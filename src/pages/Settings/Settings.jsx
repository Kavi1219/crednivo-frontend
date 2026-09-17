import { useEffect, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import ModuleHeader from '../../components/common/ModuleHeader';
import ChangePasswordModal from '../../components/layout/ChangePasswordModal';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { isNativeCrednivoApp, readPinRecord, savePinRecord, deletePinRecord } from '../../services/nativeAppLock';
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
];

export default function Settings() {
  const { uiSettings, resolvedTheme, updateUiSettings } = useCrednivo();
  const { user, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState('appearance');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const native = isNativeCrednivoApp();
  const [lockRecord, setLockRecord] = useState(null);
  const [lockBusy, setLockBusy] = useState(false);
  const lockEnabled = lockRecord ? lockRecord.lockEnabled !== false : true;

  useEffect(() => {
    if (!native) return undefined;
    let cancelled = false;
    readPinRecord(user).then((record) => { if (!cancelled) setLockRecord(record); });
    return () => { cancelled = true; };
  }, [native, user]);

  const categories = native ? [...baseCategories, { id: 'security', label: 'Security' }] : baseCategories;

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
            </>
          )}
          {activeTab === 'security' && (
            <>
              <h2 className="settings-content-title">Security</h2>

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
            </>
          )}
        </div>
      </section>

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}
