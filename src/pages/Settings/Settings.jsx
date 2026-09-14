import { useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import ModuleHeader from '../../components/common/ModuleHeader';
import ChangePasswordModal from '../../components/layout/ChangePasswordModal';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
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

const categories = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'account', label: 'Account' },
];

export default function Settings() {
  const { uiSettings, resolvedTheme, updateUiSettings } = useCrednivo();
  const { isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState('appearance');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

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
        </div>
      </section>

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}
