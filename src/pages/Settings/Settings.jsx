import { useState } from 'react';
import { Check, KeyRound, Languages, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import ActionButton from '../../components/common/ActionButton';
import ModuleHeader from '../../components/common/ModuleHeader';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import './Settings.css';

const themeOptions = [
  { value: 'light', label: 'Light', description: 'Bright and clean interface', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Comfortable in low light', icon: Moon },
  { value: 'system', label: 'System Default', description: 'Follow your device theme', icon: Monitor },
];

const languageOptions = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

export default function Settings() {
  const { uiSettings, resolvedTheme, updateUiSettings } = useCrednivo();
  const { isOwner, changePassword } = useAuth();
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (passwords.newPassword.length < 8) return setPasswordError('New password must contain at least 8 characters.');
    if (passwords.newPassword !== passwords.confirmPassword) return setPasswordError('New password and confirm password do not match.');
    try {
      setPasswordBusy(true);
      await changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      window.location.assign('/login');
    } catch (error) {
      setPasswordError(error?.message || 'Could not change password.');
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div className="module-page settings-page">
      <ModuleHeader
        eyebrow="Personal Settings"
        title="Settings"
        description="Theme, language and your own account security are available to every signed-in user."
      />

      <section className="settings-card module-card">
        <div className="settings-section">
          <div className="settings-section-head">
            <span className="settings-section-icon"><Sun size={20} /></span>
            <div><h2>App Theme</h2><p>Choose Light, Dark or let CREDNIVO follow your device automatically.</p></div>
          </div>
          <div className="settings-option-grid theme-option-grid">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = uiSettings.theme === option.value;
              return <button key={option.value} type="button" className={`settings-option ${active ? 'active' : ''}`} onClick={() => updateUiSettings({ theme: option.value })} aria-pressed={active}>
                <span className="settings-option-icon"><Icon size={22} /></span>
                <span className="settings-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
                <span className={`settings-check ${active ? 'show' : ''}`}><Check size={16} /></span>
              </button>;
            })}
          </div>
          <div className="settings-current-theme">Current appearance: <strong>{resolvedTheme === 'dark' ? 'Dark' : 'Light'}</strong>{uiSettings.theme === 'system' && <span> · following system</span>}</div>
        </div>

        <div className="settings-section">
          <div className="settings-section-head">
            <span className="settings-section-icon language"><Languages size={20} /></span>
            <div><h2>App Language</h2><p>Select the preferred language for CREDNIVO.</p></div>
          </div>
          <div className="settings-option-grid language-option-grid">
            {languageOptions.map((option) => {
              const active = uiSettings.language === option.value;
              return <button key={option.value} type="button" className={`settings-option language-option ${active ? 'active' : ''}`} onClick={() => updateUiSettings({ language: option.value })} aria-pressed={active}>
                <span className="language-mark">{option.value === 'ta' ? 'த' : 'A'}</span>
                <span className="settings-option-copy"><strong>{option.label}</strong><small>{option.native}</small></span>
                <span className={`settings-check ${active ? 'show' : ''}`}><Check size={16} /></span>
              </button>;
            })}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-head">
            <span className="settings-section-icon"><KeyRound size={20} /></span>
            <div><h2>Change Password</h2><p>Change the password for your own {isOwner ? 'Owner' : 'Agent'} account.</p></div>
          </div>
          <form className="settings-password-form" onSubmit={savePassword}>
            <label><span>Current Password</span><input type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(e) => setPasswords((c) => ({ ...c, currentPassword: e.target.value }))} required /></label>
            <label><span>New Password</span><input type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(e) => setPasswords((c) => ({ ...c, newPassword: e.target.value }))} required /></label>
            <label><span>Confirm New Password</span><input type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(e) => setPasswords((c) => ({ ...c, confirmPassword: e.target.value }))} required /></label>
            {passwordError && <div className="settings-password-error">{passwordError}</div>}
            <div className="settings-password-actions"><ActionButton type="submit" icon={KeyRound} disabled={passwordBusy}>{passwordBusy ? 'Changing...' : 'Change Password'}</ActionButton></div>
          </form>
        </div>

        <div className="settings-access-note">
          <ShieldCheck size={18}/><div><strong>{isOwner ? 'Owner Administration' : 'Agent Access'}</strong><span>{isOwner ? 'Business permissions are managed from Agents → Permissions. Company administration remains Owner-only.' : 'Theme, language and your own password stay available even when business permissions are restricted by the Owner.'}</span></div>
        </div>
      </section>
    </div>
  );
}
