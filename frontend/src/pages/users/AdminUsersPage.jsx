import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Search, Shield, UserRound, X } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, EmptyState, PageHeader, Skeleton, useDialogFocus } from '../../components/common/Primitives';
import api, { getMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/format';

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: { total: 0, totalPages: 1, limit: 10 } });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const detailDialogRef = useRef(null);
  useDialogFocus(Boolean(selected), detailDialogRef, () => setSelected(null));
  useEffect(() => { const timer = setTimeout(() => { setSearch(q); setPage(1); }, 250); return () => clearTimeout(timer); }, [q]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get('/users', { params: { q: search, page, limit: 10, ...(activeFilter === 'all' ? {} : { isActive: activeFilter }), ...(roleFilter === 'all' ? {} : { role: roleFilter }) } }); setResult(data.data); }
    catch (requestError) { setError(getMessage(requestError, 'Unable to load users.')); }
    finally { setLoading(false); }
  }, [search, page, activeFilter, roleFilter]);
  useEffect(() => { void load(); }, [load]);
  const action = async () => {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.type === 'delete') await api.delete(`/users/${pending.user._id}`);
      else await api.put(`/users/${pending.user._id}`, { isActive: !pending.user.isActive });
      toast({ title: pending.type === 'delete' ? 'User deleted successfully.' : pending.user.isActive ? 'User disabled' : 'User reactivated', description: `${pending.user.firstName} ${pending.user.lastName}` });
      setPending(null); if (selected?._id === pending.user._id) setSelected(null); await load();
    } catch (requestError) { toast({ title: 'Could not update user', description: getMessage(requestError), variant: 'error' }); }
    finally { setWorking(false); }
  };
  return <>
    <PageHeader eyebrow="ADMINISTRATION / PEOPLE" title="People" description="Manage workspace access and account status." />
    <section className="surface-card admin-table-panel">
      <div className="admin-table-toolbar"><label className="task-search"><Search size={16} /><input aria-label="Search users" placeholder="Search by name, username, or email" value={q} onChange={(event) => setQ(event.target.value)} /></label><select className="input admin-filter" aria-label="Filter users by account status" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }}><option value="all">All accounts</option><option value="true">Active</option><option value="false">Disabled</option></select><select className="input admin-filter" aria-label="Filter users by role" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}><option value="all">All roles</option><option value="User">Users</option><option value="Admin">Admins</option></select><span className="admin-count">{result.pagination.total} people</span></div>
      {error && <div className="inline-error" role="alert">{error}<button className="text-button" onClick={() => void load()}>Try again</button></div>}
      <div className="admin-user-table"><div className="admin-user-head"><span>Person</span><span>Role</span><span>Status</span><span>Joined</span><span>Actions</span></div>
        {loading ? Array.from({ length: 5 }, (_, index) => <div className="admin-user-row" key={index}><Skeleton className="skeleton-title" /><Skeleton className="skeleton-status" /><Skeleton className="skeleton-status" /><Skeleton className="skeleton-date" /><Skeleton className="skeleton-status" /></div>) : result.items.length ? result.items.map((person) => <div className="admin-user-row" key={person._id}>
          <button className="admin-person-cell" onClick={() => setSelected(person)}><Avatar user={person} size="sm" /><span><strong>{person.firstName} {person.lastName}</strong><small>@{person.username} · {person.email}</small></span></button>
          <span className="role-badge"><Shield size={13} />{person.role}</span>
          <span className={`account-status ${person.isActive ? 'account-active' : 'account-disabled'}`}><span className="status-dot" />{person.isActive ? 'Active' : 'Disabled'}</span>
          <span className="admin-date">{formatDate(person.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <div className="admin-user-actions"><button className="text-button" onClick={() => setPending({ type: 'toggle', user: person })}>{person.isActive ? 'Disable' : 'Enable'}</button><button className="text-button text-danger" onClick={() => setPending({ type: 'delete', user: person })}>Delete</button></div>
        </div>) : <EmptyState icon={UserRound} title="No users found" description="Try another search or account status filter." />}
      </div>
      <div className="table-footer"><span>{result.pagination.total} people in this workspace</span><div className="pagination-controls"><button className="pagination-button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></button><span className="page-count">Page <strong>{page}</strong> of <strong>{result.pagination.totalPages}</strong></span><button className="pagination-button" aria-label="Next page" disabled={page >= result.pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
    <ConfirmDialog open={Boolean(pending)} title={pending?.type === 'delete' ? 'Delete this user?' : pending?.user?.isActive ? 'Disable this user?' : 'Re-enable this user?'} description={pending?.type === 'delete' ? 'This action cannot be undone. The user will lose access to the workspace.' : pending?.user?.isActive ? 'This account will no longer be able to sign in.' : 'This account will be able to sign in again.'} confirmLabel={pending?.type === 'delete' ? 'Delete user' : pending?.user?.isActive ? 'Disable' : 'Enable'} destructive={pending?.type === 'delete' || pending?.user?.isActive} onClose={() => setPending(null)} onConfirm={action} loading={working} />
    <AnimatePresence>{selected && <motion.div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section ref={detailDialogRef} tabIndex={-1} className="dialog user-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="user-detail-title" initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><button data-dialog-autofocus className="icon-button dialog-close" aria-label="Close details" onClick={() => setSelected(null)}><X size={18} /></button><div className="user-detail-head"><Avatar user={selected} size="lg" /><div><h2 id="user-detail-title">{selected.firstName} {selected.lastName}</h2><span>@{selected.username}</span></div></div><div className="user-detail-meta"><div><span>Email</span><strong>{selected.email}</strong></div><div><span>Role</span><strong>{selected.role}</strong></div><div><span>Status</span><strong>{selected.isActive ? 'Active' : 'Disabled'}</strong></div><div><span>Joined</span><strong>{formatDate(selected.createdAt)}</strong></div></div><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button></motion.section></motion.div>}</AnimatePresence>
  </>;
}
