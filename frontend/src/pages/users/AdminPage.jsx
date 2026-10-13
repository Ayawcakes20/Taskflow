import { useEffect, useState } from 'react';
import { Activity, ArrowRight, BarChart3, ClipboardList, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadError, PageHeader, Skeleton } from '../../components/common/Primitives';
import { getDashboard } from '../../services/workspaceService';
import api, { getMessage } from '../../services/api';

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    Promise.all([getDashboard(), api.get('/users', { params: { limit: 1 } })]).then(([dashboard, response]) => {
      if (!active) return;
      setStats(dashboard.stats);
      setUsers(response.data.data.pagination.total);
    }).catch((problem) => { if (active) setError(getMessage(problem, 'Unable to load the workspace overview.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const cards = [
    { title: 'People', description: 'Review access, account status, and workspace roles.', to: '/admin/users', icon: Users, value: users, label: 'registered accounts' },
    { title: 'All tasks', description: 'Review task ownership, status, and workload.', to: '/tasks', icon: ClipboardList, value: stats?.total, label: 'tasks across the workspace' },
    { title: 'Activity log', description: 'Understand recent changes across the workspace.', to: '/admin/activity', icon: Activity, value: null, label: 'View recent history' },
    { title: 'Analytics', description: 'Review task progress and completion patterns.', to: '/reports', icon: BarChart3, value: stats?.completed, label: 'completed tasks' },
  ];
  if (error) return <LoadError message={error} onRetry={() => setRetry((value) => value + 1)} />;
  return <>
    <PageHeader eyebrow="ADMINISTRATION" title="Workspace overview" description="People, activity, and the health of your task system." />
    <div className="admin-welcome"><span className="admin-welcome-line" /><div><span className="section-label">MANAGE WITH CLARITY</span><h2>Good systems make good work easier.</h2><p>Keep access thoughtful, follow meaningful changes, and make sure work has a clear owner.</p></div></div>
    <section className="admin-cards">{cards.map((card) => { const Icon = card.icon; return <Link to={card.to} className="admin-card" key={card.title}><span className="admin-card-icon"><Icon size={19} /></span><div className="admin-card-copy"><h2>{card.title}</h2><p>{card.description}</p></div><div className="admin-card-foot">{loading ? <Skeleton className="admin-skeleton" /> : <strong>{card.value == null ? card.label : `${Number(card.value).toLocaleString()} ${card.label}`}</strong>}<ArrowRight size={16} /></div></Link>; })}</section>
    <div className="admin-access-note"><span className="status-dot" /><p>Admin tools are restricted to accounts with the <strong>Admin</strong> role.</p></div>
  </>;
}
