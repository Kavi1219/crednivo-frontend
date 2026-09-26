import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, Bell, ChevronDown, CircleDollarSign, ClipboardList, FileText, HandCoins, House, Landmark,
  LayoutGrid, Menu, PiggyBank, ReceiptText, Search, Settings, Sparkles, UserPlus, UserRound, Users, WalletCards,
} from 'lucide-react';
import { listNotifications, markAllNotificationsRead, markNotificationRead, unreadNotificationCount } from '../../services/work';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCrednivo } from '../../context/CrednivoContext';
import { useAuth } from '../../context/AuthContext';
import { formatIndianMobile } from '../../utils/finance';
import IconButton from '../common/IconButton';
import CustomerAvatar from '../common/CustomerAvatar';
import ProtectedImage from '../common/ProtectedImage';
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

// Title + icon shown in the framed header tab for every page. Order matters:
// more specific paths come before their parents.
const HEADER_PAGES = [
  { prefix: '/overview', title: 'Home', icon: House },
  { prefix: '/today-report', title: "Today's Report", icon: FileText },
  { prefix: '/customers/new', title: 'New Customer', icon: UserPlus },
  { prefix: '/customers', title: 'Customers', icon: UserRound },
  { prefix: '/loans/create', title: 'Create Loan', icon: CircleDollarSign },
  { prefix: '/loans', title: 'Loans', icon: CircleDollarSign },
  { prefix: '/collection', title: 'Collection', icon: HandCoins },
  { prefix: '/work', title: 'Work', icon: ClipboardList },
  { prefix: '/payments', title: 'History', icon: WalletCards },
  { prefix: '/capital', title: 'Capital', icon: Landmark },
  { prefix: '/savings', title: 'Savings', icon: PiggyBank },
  { prefix: '/expenses', title: 'Expenses', icon: ReceiptText },
  { prefix: '/reports', title: 'Reports', icon: BarChart3 },
  { prefix: '/agents', title: 'Agents', icon: Users },
  { prefix: '/settings', title: 'Settings', icon: Settings },
];

function getHeaderIdentity(pathname) {
  const page = HEADER_PAGES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return {
    title: page?.title || 'Business Workspace',
    Icon: page?.icon || LayoutGrid,
    isOverview: page?.prefix === '/overview',
  };
}


function ProfileDetails({ company, user, isOwner, accounts, activeAccountId, onEdit, onSecurity, onChangePassword, onLogout, onSwitchAccount, onAddAccount, onSessions }) {
  const avatar = user?.profilePhoto || company.logo;
  const initial = String(user?.displayName || company.name || 'C').charAt(0);
  const otherAccounts = (accounts || []).filter((account) => account.id !== activeAccountId);
  return (
    <div className="profile-dropdown app-card" role="dialog" aria-label="Signed-in profile details">
      <div className="profile-dropdown-heading">
        <span className="profile-dropdown-avatar">{avatar ? <ProtectedImage src={avatar} alt="" fallback={initial} /> : initial}</span>
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
              <span className="profile-account-avatar">{account.profilePhoto ? <ProtectedImage src={account.profilePhoto} alt="" fallback={String(account.displayName || account.companyName || 'C').charAt(0)} /> : String(account.displayName || account.companyName || 'C').charAt(0)}</span>
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

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const refreshUnread = async () => {
      try {
        const result = await unreadNotificationCount();
        setUnread(Number(result?.count) || 0);
      } catch { /* non-critical, quietly retry next interval */ }
    };
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const list = await listNotifications();
        setItems(Array.isArray(list) ? list : []);
      } catch { /* keep whatever was last shown */ }
      finally { setLoading(false); }
    }
  };

  const markAll = async (event) => {
    event.stopPropagation();
    try { await markAllNotificationsRead(); } catch { return; }
    setItems((current) => current.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const openItem = async (item) => {
    if (!item.read) {
      try { await markNotificationRead(item.id); } catch { /* still navigate even if this fails */ }
      setItems((current) => current.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((current) => Math.max(0, current - 1));
    }
    setOpen(false);
    if (item.workAssignmentId) navigate('/work');
  };

  return (
    <div className="notification-wrap" ref={ref}>
      <IconButton label="Notifications" className="header-icon-btn" onClick={toggle}><Bell size={19} /></IconButton>
      {unread > 0 && <span className="notification-count">{unread > 9 ? '9+' : unread}</span>}
      {open && (
        <div className="notification-dropdown app-card" role="dialog" aria-label="Notifications">
          <div className="notification-dropdown-head">
            <strong>Notifications</strong>
            {unread > 0 && <button type="button" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="notification-dropdown-list">
            {loading && <p className="notification-empty">Loading...</p>}
            {!loading && items.length === 0 && <p className="notification-empty">No notifications yet.</p>}
            {!loading && items.map((item) => (
              <button type="button" key={item.id} className={`notification-item ${item.read ? '' : 'unread'}`} onClick={() => openItem(item)}>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
  const { company, customers } = useCrednivo();
  const { user, isOwner, logout, accounts, activeAccountId, switchAccount } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const greeting = getGreeting();
  const headerIdentity = useMemo(() => getHeaderIdentity(location.pathname), [location.pathname]);
  const { title, Icon: PageIcon, isOverview } = headerIdentity;
  const avatar = user?.profilePhoto || company.logo;
  const profileInitial = String(user?.displayName || company.name || 'C').charAt(0);
  const searchWrapRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return (customers || [])
      .filter((c) => `${c.name} ${c.id} ${c.mobile}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [customers, search]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const handleOutsidePress = (event) => {
      if (!searchWrapRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePress);
    return () => document.removeEventListener('pointerdown', handleOutsidePress);
  }, [searchOpen]);

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
    if (searchResults.length) {
      openSearchResult(searchResults[0].id);
    }
  };

  const openSearchResult = (customerId) => {
    setSearch('');
    setSearchOpen(false);
    navigate(`/customers/${customerId}`);
  };

  const signOut = async () => { setProfileOpen(false); await logout(); navigate('/login', { replace: true }); };
  const editCompany = () => { setProfileOpen(false); if (isOwner) setProfileEditorOpen(true); };
  const editSecurity = () => { setProfileOpen(false); setSecurityEditorOpen(true); };
  const editPassword = () => { setProfileOpen(false); if (user?.emailVerified) setPasswordEditorOpen(true); else setSecurityEditorOpen(true); };
  const addAccount = () => { setProfileOpen(false); navigate('/login?mode=add'); };
  const openSessions = () => { setProfileOpen(false); setSessionsOpen(true); };
  const handleSwitchAccount = async (id) => { setProfileOpen(false); await switchAccount(id); navigate('/', { replace: true }); };

  return (
    <header className={`app-header framed-header ${isOverview ? 'overview-header' : ''}`.trim()}>
      <div className="header-title-wrap">
        <span className="framed-title-orb" aria-hidden="true"><PageIcon size={18} /></span>
        <span className="framed-title-plate" aria-hidden="true" />
        <IconButton label="Open menu" onClick={onOpenMenu} className="mobile-menu-button"><Menu size={22} /></IconButton>
        <div className="mobile-header-brand" aria-label="CREDNIVO"><span className="mobile-header-brand-mark"><CrednivoMark size={37} /></span><span className="mobile-header-brand-copy"><strong>CREDNIVO</strong><small>Finance Management Platform</small></span></div>
        <div className="desktop-header-identity">
          <h1><PageIcon size={22} className="header-title-icon framed-inline-title-icon" aria-hidden="true" />{title}</h1>
          {isOverview ? (
            <p className="overview-greeting"><span>{greeting}, {user?.displayName || company.owner}</span><Sparkles size={14} aria-hidden="true" /><span className="overview-greeting-divider">•</span><span className="overview-greeting-context">Your CREDNIVO snapshot for today</span></p>
          ) : <p className="overview-greeting"><span>{company.name}</span><span className="overview-greeting-divider">•</span><span className="overview-greeting-context">{user?.branch || company.branch}</span></p>}
        </div>
      </div>

      <div className="header-actions">
        <div className="search-box-wrap" ref={searchWrapRef}>
          <form className="search-box" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search customers, loans..."
              aria-label="Search customers and loans"
            />
            <Search size={17} className="search-end" />
          </form>
          {searchOpen && search.trim() && (
            searchResults.length ? (
              <div className="search-results-dropdown">
                {searchResults.map((c) => (
                  <button key={c.id} type="button" className="search-result-row" onClick={() => openSearchResult(c.id)}>
                    <CustomerAvatar photo={c.photo} name={c.name} />
                    <div className="search-result-identity"><strong>{c.name}</strong><span>{c.id} · {c.mobile}</span></div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="search-results-dropdown search-results-empty">No customers match "{search.trim()}".</div>
            )
          )}
        </div>
        <NotificationBell />
        <div className="profile-menu-wrap" ref={desktopProfileRef}>
          <button className="profile-button" onClick={() => setProfileOpen(v => !v)} aria-expanded={profileOpen} aria-label="Open signed-in profile"><span className="company-copy"><strong>{company.name}</strong><small>{user?.displayName || company.owner} · {isOwner ? 'Owner' : 'Agent'}</small></span><span className="profile-avatar">{avatar ? <ProtectedImage src={avatar} alt="" fallback={profileInitial} /> : profileInitial}</span><ChevronDown size={15} className={profileOpen ? 'profile-chevron open' : 'profile-chevron'} /></button>
          {profileOpen && <ProfileDetails company={company} user={user} isOwner={isOwner} accounts={accounts} activeAccountId={activeAccountId} onEdit={editCompany} onSecurity={editSecurity} onChangePassword={editPassword} onLogout={signOut} onSwitchAccount={handleSwitchAccount} onAddAccount={addAccount} onSessions={openSessions} />}
        </div>
      </div>

      <div className="mobile-header-actions">
        <IconButton label="Search" onClick={()=>navigate('/customers')}><Search size={19} /></IconButton>
        <NotificationBell />
        <div className="mobile-profile-menu-wrap" ref={mobileProfileRef}>
          <button className="mobile-avatar" aria-label="Signed-in profile" aria-expanded={profileOpen} onClick={()=>setProfileOpen(v=>!v)}>{avatar ? <ProtectedImage src={avatar} alt="" fallback={profileInitial} /> : profileInitial}</button>
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
