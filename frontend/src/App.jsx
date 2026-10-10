import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { LoaderCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import AppShell from './components/layout/AppShell';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const TasksPage = lazy(() => import('./pages/tasks/TasksPage'));
const KanbanPage = lazy(() => import('./pages/kanban/KanbanPage'));
const TaskDetailsPage = lazy(() => import('./pages/tasks/TaskDetailsPage'));
const TaskEditorPage = lazy(() => import('./pages/tasks/TaskEditorPage'));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const AdminPage = lazy(() => import('./pages/users/AdminPage'));
const AdminUsersPage = lazy(() => import('./pages/users/AdminUsersPage'));
const AdminActivityPage = lazy(() => import('./pages/users/AdminActivityPage'));

function Protected() {
  const { user } = useAuth();
  const location = useLocation();
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function Guest() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

function Admin() {
  const { user } = useAuth();
  return user?.role === 'Admin' ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

function Page({ children }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  return <motion.div className="route-page" key={location.pathname} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.12 : 0.18 }}>{children}</motion.div>;
}

function AppRouter() {
  const { user, loading } = useAuth();
  const { setTheme } = useTheme();
  useEffect(() => {
    const saved = user?.preferences?.theme;
    if (saved) setTheme(saved);
  }, [user?._id, user?.preferences?.theme, setTheme]);

  if (loading) return <div className="app-loader"><LoaderCircle className="spin" size={22} /><span>Loading your workspace</span></div>;

  return <Suspense fallback={<div className="app-loader"><LoaderCircle className="spin" size={22} /><span>Loading page</span></div>}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<Guest />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<Protected />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Page><DashboardPage /></Page>} />
          <Route path="/tasks" element={<Page><TasksPage /></Page>} />
          <Route path="/kanban" element={<Page><KanbanPage /></Page>} />
          <Route path="/tasks/create" element={<Page><TaskEditorPage /></Page>} />
          <Route path="/tasks/:id/edit" element={<Page><TaskEditorPage /></Page>} />
          <Route path="/tasks/:id" element={<Page><TaskDetailsPage /></Page>} />
          <Route path="/calendar" element={<Page><CalendarPage /></Page>} />
          <Route path="/reports" element={<Page><ReportsPage /></Page>} />
          <Route path="/notifications" element={<Page><NotificationsPage /></Page>} />
          <Route path="/profile" element={<Page><ProfilePage /></Page>} />
          <Route path="/settings" element={<Page><SettingsPage /></Page>} />
          <Route element={<Admin />}>
            <Route path="/admin" element={<Page><AdminPage /></Page>} />
            <Route path="/admin/users" element={<Page><AdminUsersPage /></Page>} />
            <Route path="/admin/activity" element={<Page><AdminActivityPage /></Page>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  </Suspense>;
}

export default function App() {
  return <BrowserRouter>
    <ToastProvider>
      <ThemeProvider>
        <AuthProvider><AppRouter /></AuthProvider>
      </ThemeProvider>
    </ToastProvider>
  </BrowserRouter>;
}
