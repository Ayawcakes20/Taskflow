import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState, PageHeader, Skeleton } from '../../components/common/Primitives';
import api, { getMessage } from '../../services/api';
import { Avatar } from '../../components/common/Primitives';
import { formatDate } from '../../utils/format';

const label = (action = '') => action.replaceAll('.', ' ').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminActivityPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], pagination: { total: 0, totalPages: 1, limit: 20 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadSequence = useRef(0);
  useEffect(() => { const timer = setTimeout(() => { setSearch(query); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try { const { data } = await api.get('/activity', { params: { q: search, page, limit: 20 } }); if (sequence === loadSequence.current) setResult(data.data); }
    catch (requestError) { if (sequence === loadSequence.current) setError(getMessage(requestError, 'Unable to load the activity log.')); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [search, page]);
  useEffect(() => { void load(); return () => { loadSequence.current++; }; }, [load]);
  return <>
    <PageHeader eyebrow="ADMINISTRATION / AUDIT" title="Activity log" description="A clear record of changes across your workspace." actions={<span className="admin-count">{result.pagination.total} events</span>} />
    <section className="surface-card admin-table-panel"><div className="admin-table-toolbar"><label className="task-search"><Search size={16} /><input aria-label="Search activity" placeholder="Search task names and events" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="audit-note"><Activity size={14} />System activity</span></div>
      {error && <div className="inline-error" role="alert">{error}<button className="text-button" onClick={() => void load()}>Try again</button></div>}
      <div className="audit-list">{loading ? Array.from({ length: 5 }, (_, index) => <div className="audit-row" key={index}><Skeleton className="skeleton-avatar" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-date" /></div>) : error && !result.items.length ? null : result.items.length ? result.items.map((item) => <div className="audit-row" key={item._id}><Avatar user={item.actor} size="sm" /><div className="audit-copy"><p><strong>{item.actor ? `${item.actor.firstName} ${item.actor.lastName}` : 'System'}</strong><span>{label(item.action)}</span>{item.entityTitle && <strong className="audit-entity">{item.entityTitle}</strong>}</p>{item.details && <small>{item.details}</small>}</div><time>{formatDate(item.createdAt, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>) : <EmptyState icon={Activity} title="No activity found" description="Workspace changes will appear here." />}</div>
      <div className="table-footer"><span>Showing {result.items.length} of {result.pagination.total} events</span><div className="pagination-controls"><button className="pagination-button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={16} /></button><span className="page-count">Page <strong>{page}</strong> of <strong>{result.pagination.totalPages}</strong></span><button className="pagination-button" aria-label="Next page" disabled={page >= result.pagination.totalPages || loading} onClick={() => setPage((current) => current + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
  </>;
}
