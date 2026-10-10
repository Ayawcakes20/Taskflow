import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, EmptyState, PageHeader, Skeleton } from '../../components/common/Primitives';
import NotificationLink from '../../components/notifications/NotificationLink';
import { getNotifications, markAllRead, markRead } from '../../services/workspaceService';
import { getMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function NotificationsPage() {
  const [result, setResult] = useState({ items: [], unread: 0, pagination: { page: 1, totalPages: 1, total: 0 } });
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [markingAll, setMarkingAll] = useState(false);
  const loadSequence = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try {
      const next = await getNotifications({ page, limit: 50, ...(filter === 'all' ? {} : { read: filter === 'read' ? 'true' : 'false' }) });
      if (sequence !== loadSequence.current) return;
      if (page > next.pagination.totalPages) { setPage(next.pagination.totalPages); return; }
      setResult(next);
    }
    catch (requestError) { if (sequence === loadSequence.current) setError(getMessage(requestError, 'Unable to load notifications.')); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [filter, page]);
  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);
  const changeFilter = (value) => { setFilter(value); setPage(1); };
  const readOne = async (notification) => {
    if (notification.isRead) return;
    try { await markRead(notification._id); await load(); }
    catch (requestError) { toast({ title: 'Could not update notification', description: getMessage(requestError), variant: 'error' }); }
  };
  const readAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try { await markAllRead(); if (page === 1) await load(); else setPage(1); toast({ title: 'All caught up', description: 'Notifications marked as read.' }); }
    catch (requestError) { toast({ title: 'Could not mark notifications as read', description: getMessage(requestError), variant: 'error' }); }
    finally { setMarkingAll(false); }
  };
  return <>
    <PageHeader eyebrow="INBOX" title="Notifications" description="Updates about tasks, assignments, and deadlines." actions={result.unread > 0 && <Button variant="secondary" icon={CheckCheck} loading={markingAll} onClick={readAll}>Mark all as read</Button>} />
    <section className="surface-card notifications-panel">
      <div className="notifications-toolbar"><div className="notification-tabs"><button className={filter === 'all' ? 'notification-tab active' : 'notification-tab'} onClick={() => changeFilter('all')}>All <span>{result.pagination?.total || 0}</span></button><button className={filter === 'unread' ? 'notification-tab active' : 'notification-tab'} onClick={() => changeFilter('unread')}>Unread <span>{result.unread}</span></button><button className={filter === 'read' ? 'notification-tab active' : 'notification-tab'} onClick={() => changeFilter('read')}>Read</button></div><span className="notification-summary">{result.unread ? `${result.unread} unread` : 'All caught up'}</span></div>
      {error && <div className="inline-error" role="alert">{error}<button className="text-button" onClick={() => void load()}>Try again</button></div>}
      {loading ? <div className="notification-skeletons"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div> : result.items.length ? <div className="notification-list">{result.items.map((notification) => <NotificationLink key={notification._id} notification={notification} onRead={readOne} />)}</div> : <EmptyState icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description={filter === 'unread' ? 'You’re all caught up.' : 'Task assignments and updates will appear here.'} />}
      <div className="table-footer"><span>{result.pagination.total} notifications</span><div className="pagination-controls"><button className="pagination-button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></button><span className="page-count">Page <strong>{page}</strong> of <strong>{result.pagination.totalPages}</strong></span><button className="pagination-button" aria-label="Next page" disabled={page >= result.pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
  </>;
}
