import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Activity, ArrowRight, BarChart3, Bell, CalendarDays, Check, ChevronsLeft, ClipboardList, KanbanSquare, LayoutDashboard, LogOut, Menu, Search, Settings, Shield, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar, IconButton } from '../common/Primitives';
import api from '../../services/api';
import { formatDate } from '../../utils/format';

const mainNav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/tasks', label: 'My tasks', icon: ClipboardList },
  { to: '/kanban', label: 'Kanban', icon: KanbanSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); }
    catch { toast({ title: 'Could not sign out', description: 'Please try again.', variant: 'error' }); }
  };
  const navLink = (item) => <NavLink key={item.to} to={item.to} onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
    <item.icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span>
  </NavLink>;

  return <>
    <div className="sidebar-brand"><Link to="/dashboard" className="brand-link" aria-label="Taskflow dashboard"><BrandMark /><span>taskflow</span></Link><span className="brand-workspace">WORKSPACE</span></div>
    <nav className="sidebar-nav" aria-label="Primary navigation">
      <div className="nav-section"><span className="nav-section-label">Workspace</span>{mainNav.map(navLink)}
      <NavLink to="/notifications" onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Bell size={18} strokeWidth={1.8} /><span>Notifications</span></NavLink></div>
      {user?.role === 'Admin' && <div className="nav-section"><span className="nav-section-label">Administration</span>
        <NavLink to="/admin" end onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Shield size={18} strokeWidth={1.8} /><span>Admin overview</span></NavLink>
        <NavLink to="/admin/users" onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Users size={18} strokeWidth={1.8} /><span>People</span></NavLink>
        <NavLink to="/admin/activity" onClick={onNavigate} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><Activity size={18} strokeWidth={1.8} /><span>Activity logs</span></NavLink>
      </div>}
    </nav>
    <div className="sidebar-bottom">
      <NavLink to="/profile" onClick={onNavigate} className={({ isActive }) => `side-link settings-link ${isActive ? 'active' : ''}`}><Users size={18} strokeWidth={1.8} /><span>Profile</span></NavLink>
      <NavLink to="/settings" onClick={onNavigate} className={({ isActive }) => `side-link settings-link ${isActive ? 'active' : ''}`}><Settings size={18} strokeWidth={1.8} /><span>Settings</span></NavLink>
      <div className="sidebar-user">
        <button className="user-chip" onClick={() => { onNavigate?.(); navigate('/profile'); }} aria-label="Open profile">
          <Avatar user={user} size="sm" /><span className="user-chip-copy"><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.role || 'User'}</small></span><ChevronsLeft size={14} className="user-chevron" />
        </button>
        <button className="logout-link" onClick={handleLogout}><LogOut size={16} /><span>Sign out</span></button>
      </div>
    </div>
  </>;
}

function HeaderSearch() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useEffect(() => setQuery(searchParams.get('q') || ''), [searchParams]);
  return <form className="top-search" role="search" onSubmit={(event) => { event.preventDefault(); navigate(`/tasks${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`); }}>
    <Search size={16} aria-hidden="true" /><input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} />
  </form>;
}

function NotificationButton() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const container = useRef(null);
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const load = useCallback(() => api.get('/notifications', { params: { limit: 5 } }).then(({ data }) => {
    setUnread(data.data.unread || 0);
    setItems(data.data.items || []);
  }).catch(() => {}), []);
  useEffect(() => {
    let active = true;
    const refresh = async () => { if (!active) return; await load(); };
    void refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!container.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const markRead = async (notification) => {
    if (notification.isRead) return;
    setItems((current) => current.map((item) => item._id === notification._id ? { ...item, isRead: true } : item));
    setUnread((current) => Math.max(0, current - 1));
    try { await api.put(`/notifications/${notification._id}/read`); }
    catch { void load(); }
  };
  const markAllRead = async () => {
    if (!unread) return;
    setLoading(true);
    try { await api.put('/notifications/read-all'); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); setUnread(0); }
    catch { void load(); }
    finally { setLoading(false); }
  };
  const openNotification = (notification) => {
    void markRead(notification);
    setOpen(false);
    if (notification.task?._id) navigate(`/tasks/${notification.task._id}`);
    else navigate('/notifications');
  };

  return <div className="notification-menu-wrap" ref={container}>
    <IconButton className="header-bell" label={`${unread ? `${unread} unread ` : ''}notifications`} aria-expanded={open} aria-controls="notification-dropdown" onClick={() => setOpen((value) => !value)}>
      <Bell size={18} />{unread > 0 && <span className="notification-dot" aria-hidden="true" />}
    </IconButton>
    <AnimatePresence>
      {open && <motion.div id="notification-dropdown" className="notification-dropdown" role="dialog" aria-label="Recent notifications" initial={reduced ? { opacity: 0 } : { opacity: 0, y: 5, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: reduced ? .1 : .16 }}>
        <div className="notification-dropdown-head"><div><strong>Inbox</strong><small>{unread ? `${unread} unread` : 'All caught up'}</small></div><button className="text-button" disabled={!unread || loading} onClick={markAllRead}><Check size={13} />Mark all read</button></div>
        <div className="notification-dropdown-list">{items.length ? items.map((notification) => <button className={`notification-dropdown-item ${notification.isRead ? 'is-read' : 'is-unread'}`} key={notification._id} onClick={() => openNotification(notification)}><span className={`notification-type-icon type-${notification.type}`}><Bell size={14} /></span><span className="notification-dropdown-copy"><strong>{notification.title}</strong><small>{notification.message}</small><time>{formatDate(notification.createdAt, { month: 'short', day: 'numeric' })}</time></span>{!notification.isRead && <span className="unread-indicator" />}</button>) : <div className="notification-dropdown-empty"><Bell size={17} /><span>No notifications yet</span></div>}</div>
        <Link className="notification-dropdown-footer" to="/notifications" onClick={() => setOpen(false)}>View all notifications <ArrowRight size={14} /></Link>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const reduced = useReducedMotion();
  const { user } = useAuth();
  useEffect(() => setDrawerOpen(false), [location.pathname]);
  return <div className="app-frame">
    <aside className="desktop-sidebar"><SidebarContent /></aside>
    <AnimatePresence>
      {drawerOpen && <>
        <motion.button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <motion.aside className="mobile-sidebar" initial={reduced ? { opacity: 0 } : { x: -260 }} animate={{ x: 0, opacity: 1 }} exit={reduced ? { opacity: 0 } : { x: -260 }} transition={{ duration: reduced ? 0.12 : 0.2 }}>
          <IconButton className="mobile-close" label="Close navigation" onClick={() => setDrawerOpen(false)}><X size={18} /></IconButton><SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </motion.aside>
      </>}
    </AnimatePresence>
    <div className="app-main">
      <header className="topbar">
        <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setDrawerOpen(true)}><Menu size={19} /></button>
        <div className="topbar-context"><span className="context-dot" /><span>My workspace</span><ChevronsLeft size={14} className="context-caret" /></div>
        <HeaderSearch />
        <div className="topbar-actions"><NotificationButton /><span className="topbar-divider" /><Link className="header-profile" to="/profile" aria-label="Open profile"><Avatar user={user} size="sm" /></Link></div>
      </header>
      <main className="main-content"><Outlet /></main>
      <footer className="app-footer"><span>Taskflow</span><span>Clear work, steady progress.</span></footer>
    </div>
  </div>;
}
