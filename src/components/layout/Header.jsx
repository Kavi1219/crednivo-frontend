import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronDown, Menu, Search, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatIndianMobile } from '../../utils/finance';
import IconButton from '../common/IconButton';
import CrednivoMark from '../brand/CrednivoMark';
import CompanyProfileModal from './CompanyProfileModal';
import ChangePasswordModal from './ChangePasswordModal';
import AccountSecurityModal from './AccountSecurityModal';
import SessionsModal from './SessionsModal';
import './Header.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getHeaderIdentity(pathname) {
  if (pathname === '/' || pathname.startsWith('/overview')) return { title: 'Overview', isOverview: true };
  return { title: 'Business Workspace', isOverview: false };
}

function ProfileDetails({ company, user, isOwner, accounts, activeAccountId, onEdit, onSecurity, onChangePassword, onLogout, onSwitchAccount, onAddAccount, onSessions }) {
  const avatar = user?.profilePhoto || company.logo;
  const initial = String(user?.displayName || company.name || 'C').charAt(0);
  const otherAccounts = (accounts || []).filter((account) => account.id !== activeAccountId);
  return (
    <div className="profile-dropdown app-card" role="dialog" aria-label="Signed-in profile details">
      <div className="profile-dropdown-heading">
        <span className="profile-dropdown-avatar">{avatar ? <img src={avatar} alt="" /> : initial}</span>
        <div>
          <strong>{user?.displayName || company.owner}</strong>
          <span>{isOwner ? 'Owner' : 'Agent'} · {company.name}</span>
        </div>
      </div>

      <div className="profile-info-grid">
        <div><small>Access</small><strong>{isOwner ? 'Full access' : 'Field access'}</strong></div>
        <div><small>Company ID</small><strong>{company.companyId || '—'}</strong></div>
        <div><small>Mobile</small><strong>{formatIndianMobile(user?.mobile) || '—'}</strong></div>
        <div><small>Email</small><strong className={user?.emailVerified ? 'is-verified' : 'is-pending'}>{user?.emailVerified ? 'Verified' : 'Pending'}</strong></div>
        {isOwner && <div className="profile-info-full"><small>Address</small><strong>{company.address || '—'}</strong></div>}
      </div>

      {otherAccounts.length > 0 && (
        <div className="profile-menu-list">
          <small className="profile-menu-label">Switch account</small>
          {otherAccounts.map((account) => (
            <button key={account.id} type="button" className="profile-menu-item profile-account-item" onClick={() => onSwitchAccount(account.id)}>
              <span className="profile-account-avatar">{account.profilePhoto ? <img src={account.profilePhoto} alt="" /> : String(account.displayName || account.companyName || 'C').charAt(0)}</span>
              <span className="profile-account-copy"><strong>{account.displayName || account.username}</strong><small>{account.companyName}</small></span>
            </button>
          ))}
        </div>
      )}

      <div className="profile-menu-list">
        {isOwner && <button type="button" className="profile-menu-item" onClick={onEdit}>Edit company profile</button>}
        <button type="button" className="profile-menu-item" onClick={onAddAccount}>Add account</button>
        <button type="button" className="profile-menu-item" onClick={onSessions}>Active sessions</button>
        <button type="button" className="profile-menu-item" onClick={onSecurity}>{user?.emailVerified ? 'Account security' : 'Verify email'}</button>
        <button type="button" className="profile-menu-item" onClick={onChangePassword} disabled={!user?.emailVerified} title={!user?.emailVerified ? 'Verify email before changing password' : 'Change password'}>Change password</button>
      </div>

      <div className="profile-menu-list profile-menu-danger">
        <button type="button" className="profile-menu-item danger" onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}

export default function Header({ onOpenMenu }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [passwordEditorOpen, setPasswordEditorOpen] = useState(false);
  const [securityEditorOpen, setSecurityEditorOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const desktopProfileRef = useRef(null);
  const mobileProfileRef = useRef(null);
  const { company } = useCrednivo();
  const { user, isOwner, logout, accounts, activeAccountId, switchAccount } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const greeting = getGreeting();
  const headerIdentity = useMemo(() => getHeaderIdentity(location.pathname), [location.pathname]);
  const { title, isOverview } = headerIdentity;
  const avatar = user?.profilePhoto || company.logo;
  const profileInitial = String(user?.displayName || company.name || 'C').charAt(0);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const handleOutsidePress = (event) => {
      const insideDesktop = desktopProfileRef.current?.contains(event.target);
      const insideMobile = mobileProfileRef.current?.contains(event.target);
      if (!insideDesktop && !insideMobile) setProfileOpen(false);
    };
    const handleEscape = (event) => { if (event.key === 'Escape') setProfileOpen(false); };
    document.addEventListener('pointerdown', handleOutsidePress);
    document.addEventListener('keydown', handleEscape);
    return () => { document.removeEventListener('pointerdown', handleOutsidePress); document.removeEventListener('keydown', handleEscape); };
  }, [profileOpen]);

  useEffect(() => { setProfileOpen(false); }, [location.pathname]);

  const submitSearch = (event) => {
    event.preventDefault();
    if (!search.trim()) return;
    navigate(`/customers?search=${encodeURIComponent(search.trim())}`);
  };

  const signOut = async () => { setProfileOpen(false); await logout(); navigate('/login', { replace: true }); };
  const editCompany = () => { setProfileOpen(false); if (isOwner) setProfileEditorOpen(true); };
  const editSecurity = () => { setProfileOpen(false); setSecurityEditorOpen(true); };
  const editPassword = () => { setProfileOpen(false); if (user?.emailVerified) setPasswordEditorOpen(true); else setSecurityEditorOpen(true); };
  const addAccount = () => { setProfileOpen(false); navigate('/login?mode=add'); };
  const openSessions = () => { setProfileOpen(false); setSessionsOpen(true); };
  const handleSwitchAccount = async (id) => { setProfileOpen(false); await switchAccount(id); navigate('/', { replace: true }); };

  return (
    <header className="app-header">
      <div className="header-title-wrap">
        <IconButton label="Open menu" onClick={onOpenMenu} className="mobile-menu-button"><Menu size={22} /></IconButton>
        <div className="mobile-header-brand" aria-label="CREDNIVO"><span className="mobile-header-brand-mark"><CrednivoMark size={37} /></span><span className="mobile-header-brand-copy"><strong>CREDNIVO</strong><small>Finance Management Platform</small></span></div>
        <div className="desktop-header-identity">
          <h1>{title}</h1>
          {isOverview ? (
            <p className="overview-greeting"><span>{greeting}, {user?.displayName || company.owner}</span><Sparkles size={14} aria-hidden="true" /><span className="overview-greeting-divider">•</span><span className="overview-greeting-context">Your CREDNIVO snapshot for today</span></p>
          ) : <p className="overview-greeting"><span>{company.name}</span><span className="overview-greeting-divider">•</span><span className="overview-greeting-context">{user?.branch || company.branch}</span></p>}
        </div>
      </div>

      <div className="header-actions">
        <form className="search-box" onSubmit={submitSearch}><Search size={17} /><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers, loans..." aria-label="Search customers and loans" /><Search size={17} className="search-end" /></form>
        <div className="notification-wrap"><IconButton label="Notifications" className="header-icon-btn"><Bell size={19} /></IconButton><span className="notification-count">5</span></div>
        <div className="profile-menu-wrap" ref={desktopProfileRef}>
          <button className="profile-button" onClick={() => setProfileOpen(v => !v)} aria-expanded={profileOpen} aria-label="Open signed-in profile"><span className="company-copy"><strong>{company.name}</strong><small>{user?.displayName || company.owner} · {isOwner ? 'Owner' : 'Agent'}</small></span><span className="profile-avatar">{avatar ? <img src={avatar} alt="" /> : profileInitial}</span><ChevronDown size={15} className={profileOpen ? 'profile-chevron open' : 'profile-chevron'} /></button>
          {profileOpen && <ProfileDetails company={company} user={user} isOwner={isOwner} accounts={accounts} activeAccountId={activeAccountId} onEdit={editCompany} onSecurity={editSecurity} onChangePassword={editPassword} onLogout={signOut} onSwitchAccount={handleSwitchAccount} onAddAccount={addAccount} onSessions={openSessions} />}
        </div>
      </div>

      <div className="mobile-header-actions">
        <IconButton label="Search" onClick={()=>navigate('/customers')}><Search size={19} /></IconButton>
        <div className="notification-wrap"><IconButton label="Notifications"><Bell size={19} /></IconButton><span className="notification-count">5</span></div>
        <div className="mobile-profile-menu-wrap" ref={mobileProfileRef}>
          <button className="mobile-avatar" aria-label="Signed-in profile" aria-expanded={profileOpen} onClick={()=>setProfileOpen(v=>!v)}>{avatar ? <img src={avatar} alt="" /> : profileInitial}</button>
          {profileOpen && <ProfileDetails company={company} user={user} isOwner={isOwner} accounts={accounts} activeAccountId={activeAccountId} onEdit={editCompany} onSecurity={editSecurity} onChangePassword={editPassword} onLogout={signOut} onSwitchAccount={handleSwitchAccount} onAddAccount={addAccount} onSessions={openSessions} />}
        </div>
      </div>
      {isOwner && <CompanyProfileModal open={profileEditorOpen} onClose={() => setProfileEditorOpen(false)} />}
      <AccountSecurityModal open={securityEditorOpen} onClose={() => setSecurityEditorOpen(false)} />
      <ChangePasswordModal open={passwordEditorOpen} onClose={() => setPasswordEditorOpen(false)} />
      <SessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </header>
  );
}
