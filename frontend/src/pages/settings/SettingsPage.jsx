import { useEffect, useRef, useState } from 'react';
import { Bell, LockKeyhole, Moon, Sun, Monitor, ShieldCheck } from 'lucide-react';
import { Button, PageHeader } from '../../components/common/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import api, { getMessage } from '../../services/api';

const themes = [
  { value: 'light', label: 'Light', detail: 'Bright surfaces for daytime work.', icon: Sun },
  { value: 'dark', label: 'Dark', detail: 'Lower luminance for dim environments.', icon: Moon },
  { value: 'system', label: 'System', detail: 'Follow your device preference.', icon: Monitor },
];

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const preferences = user?.preferences || {};
  const [notifications, setNotifications] = useState({ assignments: true, updates: true, deadlines: true, mentions: true, ...(preferences.notifications || {}) });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const preferenceBusy = useRef(false);
  useEffect(() => setNotifications({ assignments: true, updates: true, deadlines: true, mentions: true, ...(preferences.notifications || {}) }), [preferences.notifications]);

  const savePreference = async (next) => {
    setSavingPreference(true);
    try {
      const { data } = await api.put('/users/me/preferences', next);
      setUser((current) => ({ ...current, preferences: { ...current.preferences, ...data.data.preferences } }));
      toast({ title: 'Settings saved' });
      return true;
    } catch (requestError) {
      toast({ title: 'Could not save settings', description: getMessage(requestError), variant: 'error' });
      return false;
    } finally { setSavingPreference(false); }
  };
  const chooseTheme = async (value) => {
    if (preferenceBusy.current) return;
    preferenceBusy.current = true;
    const previous = theme;
    setTheme(value);
    try { if (!await savePreference({ theme: value })) setTheme(previous); }
    finally { preferenceBusy.current = false; }
  };
  const toggleNotification = async (key) => {
    if (preferenceBusy.current) return;
    preferenceBusy.current = true;
    const previous = notifications;
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    try { if (!await savePreference({ notifications: { [key]: next[key] } })) setNotifications(previous); }
    finally { preferenceBusy.current = false; }
  };
  const changePassword = async (event) => {
    event.preventDefault(); setPasswordError('');
    if (password.newPassword.length < 8 || !/[A-Za-z]/.test(password.newPassword) || !/[0-9]/.test(password.newPassword)) { setPasswordError('Use at least 8 characters with a letter and a number.'); return; }
    if (password.newPassword !== password.confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setSavingPassword(true);
    try { await api.put('/auth/password', { currentPassword: password.currentPassword, newPassword: password.newPassword }); setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' }); toast({ title: 'Password updated successfully.' }); }
    catch (requestError) { setPasswordError(getMessage(requestError, 'Unable to update your password.')); }
    finally { setSavingPassword(false); }
  };

  return <>
    <PageHeader eyebrow="PREFERENCES" title="Settings" description="Make Taskflow feel right for the way you work." />
    <div className="settings-layout">
      <section className="surface-card settings-panel"><div className="settings-section-heading"><span className="settings-section-icon"><Sun size={17} /></span><div><h2>Appearance</h2><p>Choose the surface that feels comfortable for you.</p></div></div>
        <div className="theme-options" role="radiogroup" aria-label="Theme preference">{themes.map((item) => { const Icon = item.icon; return <button key={item.value} type="button" role="radio" disabled={savingPreference} aria-checked={theme === item.value} className={`theme-option ${theme === item.value ? 'selected' : ''}`} onClick={() => void chooseTheme(item.value)}><span className="theme-preview"><Icon size={18} /></span><span className="theme-copy"><strong>{item.label}</strong><small>{item.detail}</small></span><span className="radio-indicator" /></button>; })}</div>
        {savingPreference && <span className="save-hint">Saving preference…</span>}
      </section>
      <section className="surface-card settings-panel"><div className="settings-section-heading"><span className="settings-section-icon"><Bell size={17} /></span><div><h2>Notifications</h2><p>Choose which workspace updates reach your inbox.</p></div></div>
        <div className="preference-list">{[
          ['assignments', 'Task assignments', 'When a task is assigned to you.'],
          ['updates', 'Task updates', 'When a task you created or own changes.'],
          ['deadlines', 'Deadline reminders', 'When a due date is approaching or overdue.'],
          ['mentions', 'Mentions and pings', 'When someone tags you with @username or @everyone.'],
        ].map(([key, label, detail]) => <label className="preference-row" key={key}><span><strong>{label}</strong><small>{detail}</small></span><input className="toggle-input" type="checkbox" disabled={savingPreference} checked={Boolean(notifications[key])} onChange={() => void toggleNotification(key)} aria-label={label} /></label>)}</div>
      </section>
      <section className="surface-card settings-panel"><div className="settings-section-heading"><span className="settings-section-icon"><LockKeyhole size={17} /></span><div><h2>Change password</h2><p>Use a strong password you do not use elsewhere.</p></div></div>
        <form className="password-settings-form" onSubmit={changePassword}><div className="field"><label htmlFor="currentPassword">Current password</label><input id="currentPassword" className="input" type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} required /></div><div className="form-grid-two"><div className="field"><label htmlFor="newPassword">New password</label><input id="newPassword" className="input" type="password" autoComplete="new-password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} required /></div><div className="field"><label htmlFor="confirmPassword">Confirm new password</label><input id="confirmPassword" className="input" type="password" autoComplete="new-password" value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} required /></div></div>{passwordError && <div className="form-alert" role="alert">{passwordError}</div>}<Button type="submit" variant="secondary" icon={ShieldCheck} loading={savingPassword}>Update password</Button></form>
      </section>
      <section className="settings-account-note"><span className="settings-section-icon"><ShieldCheck size={17} /></span><div><strong>Account settings</strong><p>Profile details are managed from your <a href="/profile">profile page</a>. For account access changes, contact an administrator.</p></div></section>
    </div>
  </>;
}
