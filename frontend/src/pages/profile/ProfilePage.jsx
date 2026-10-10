import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Save, Shield, UserRound, X } from 'lucide-react';
import { Avatar, Button, PageHeader, Skeleton } from '../../components/common/Primitives';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api, { getMessage } from '../../services/api';
import { prepareTaskImage } from '../../utils/prepareTaskImage';
import { formatDate } from '../../utils/format';
import { profilePayload } from '../../utils/imagePayload';

const emptyForm = { firstName: '', lastName: '', username: '', email: '', profileImage: '' };

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [summary, setSummary] = useState({ createdTasks: 0, assignedTasks: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/users/${user._id}`).then(({ data }) => {
      if (!active) return;
      const profile = data.data.user;
      setForm({ firstName: profile.firstName || '', lastName: profile.lastName || '', username: profile.username || '', email: profile.email || '', profileImage: profile.profileImage || '' });
      setSummary(data.data.summary || { createdTasks: 0, assignedTasks: 0 });
    }).catch((requestError) => { if (active) setError(getMessage(requestError, 'Unable to load your profile.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user._id]);

  useEffect(() => () => { if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const openFilePicker = () => fileInputRef.current?.click();

  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPhotoError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setPhotoError('Please select a valid JPEG, PNG, or WebP image.'); return; }
    if (file.size > 12 * 1024 * 1024) { setPhotoError('Image size exceeds the 12 MB limit.'); return; }
    if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const cancelPhoto = () => {
    if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    setSelectedPhoto(null);
    setPhotoPreview('');
    setPhotoError('');
  };

  const savePhoto = async () => {
    if (!selectedPhoto) return;
    setSavingPhoto(true); setPhotoError('');
    try {
      const { imageUrl } = await prepareTaskImage(selectedPhoto);
      const { data } = await api.put(`/users/${user._id}`, { profileImage: imageUrl });
      setForm((current) => ({ ...current, profileImage: data.data.user.profileImage || '' }));
      setUser(data.data.user);
      cancelPhoto();
      toast({ title: 'Profile photo updated successfully.' });
    } catch (requestError) {
      setPhotoError(getMessage(requestError, 'Unable to update profile photo. Please try again.'));
    } finally { setSavingPhoto(false); }
  };

  const save = async (event) => {
    event.preventDefault(); setError('');
    if (!form.firstName.trim() || !form.lastName.trim() || !form.username.trim() || !form.email.trim()) { setError('First name, last name, username, and email are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email address.'); return; }
    setSaving(true);
    try { const { data } = await api.put(`/users/${user._id}`, profilePayload(form)); setUser(data.data.user); toast({ title: 'Profile updated successfully.' }); }
    catch (requestError) { setError(getMessage(requestError, 'Unable to update your profile.')); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="profile-loading"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-panel" /></div>;
  const displayedUser = { ...user, ...form, profileImage: photoPreview || form.profileImage };
  return <>
    <PageHeader eyebrow="YOUR ACCOUNT" title="Profile" description="The details your workspace uses to recognize you." />
    {error && <div className="inline-error" role="alert">{error}</div>}
    <div className="profile-layout">
      <section className="surface-card profile-form-panel">
        <div className="profile-identity profile-photo-section">
          <div className="profile-photo-control">
            <button type="button" className="profile-photo-button" onClick={openFilePicker} aria-label="Choose a new profile photo">
              <Avatar user={displayedUser} size="xl" />
              <span className="profile-photo-hover"><Camera size={16} />Change</span>
            </button>
            <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} aria-label="Choose profile photo" />
            <button type="button" className="button button-quiet button-sm profile-change-button" onClick={openFilePicker}><ImagePlus size={14} />Change photo</button>
          </div>
          <div className="profile-photo-copy"><span className="section-label">PROFILE PHOTO</span><p>Upload a JPEG, PNG, or WebP image. It will be resized automatically.</p>{photoError && <div className="form-alert" role="alert">{photoError}</div>}</div>
        </div>
        {selectedPhoto && <div className="profile-photo-actions"><span className="field-hint">Preview ready. Save when you are happy with the new photo.</span><div><Button type="button" variant="quiet" icon={X} onClick={cancelPhoto} disabled={savingPhoto}>Cancel</Button><Button type="button" icon={Save} onClick={savePhoto} loading={savingPhoto}>Save photo</Button></div></div>}
        <form onSubmit={save} className="profile-form">
          <div className="form-grid-two"><div className="field"><label htmlFor="firstName">First name</label><input id="firstName" className="input" value={form.firstName} onChange={change('firstName')} /></div><div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" className="input" value={form.lastName} onChange={change('lastName')} /></div></div>
          <div className="field"><label htmlFor="username">Username</label><input id="username" className="input" value={form.username} onChange={change('username')} /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" value={form.email} onChange={change('email')} /></div>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <div className="form-actions"><span className="field-hint">Changes apply to your workspace identity.</span><Button type="submit" icon={Save} loading={saving}>Save changes</Button></div>
        </form>
      </section>
      <aside className="profile-side">
        <section className="surface-card profile-summary-card"><span className="section-label">ACCOUNT</span><div className="account-role"><span className="role-icon"><Shield size={16} /></span><div><strong>{user.role}</strong><small>Workspace role</small></div></div><div className="account-meta"><span>Member since</span><strong>{formatDate(user.createdAt)}</strong></div><div className="account-meta"><span>Account status</span><strong className="active-account"><span className="status-dot" />Active</strong></div></section>
        <section className="surface-card profile-summary-card"><span className="section-label">YOUR TASKS</span><div className="profile-stat"><strong>{summary.createdTasks}</strong><span>Created by you</span></div><div className="profile-stat"><strong>{summary.assignedTasks}</strong><span>Assigned to you</span></div></section>
        <div className="profile-side-note"><UserRound size={16} /><span>Your profile information is visible to people in your workspace.</span></div>
      </aside>
    </div>
  </>;
}
