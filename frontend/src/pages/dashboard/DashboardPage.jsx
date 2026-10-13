import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, CircleDashed, Clock3, Plus, TrendingUp } from 'lucide-react';
import { Avatar, Button, EmptyState, LoadError, PageHeader, PriorityBadge, Skeleton } from '../../components/common/Primitives';
import SpringCheck from '../../components/tasks/SpringCheck';
import { getDashboard } from '../../services/workspaceService';
import { taskService } from '../../services/taskService';
import { getMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatDueDate, relativeDate } from '../../utils/format';
import { applyDashboardTaskUpdate } from '../../utils/dashboardState';
import { subtaskProgress } from '../../utils/taskSubtasks';
import { dispatchTaskChanged, TASK_CHANGED_EVENT } from '../../utils/taskEvents';
import { WORKSPACE_TIME_ZONE } from '../../utils/workspaceDates.js';

const metrics = [
  { key: 'total', label: 'Total tasks', icon: CircleDashed, tone: 'neutral' },
  { key: 'pending', label: 'Pending', icon: Clock3, tone: 'amber' },
  { key: 'inProgress', label: 'In progress', icon: TrendingUp, tone: 'blue' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, tone: 'green' },
  { key: 'overdue', label: 'Overdue', icon: CalendarClock, tone: 'red' },
];

function CountValue({ value = 0 }) {
  const reduced = useReducedMotion();
  return <motion.strong key={value} initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0.12 : 0.24 }} className="metric-value">{Number(value).toLocaleString()}</motion.strong>;
}

function Breakdown({ title, items, colorClass, emptyLabel }) {
  const max = Math.max(1, ...items.map((item) => item.count || 0));
  return <div className="breakdown-block"><div className="breakdown-head"><h3>{title}</h3><span>{items.reduce((sum, item) => sum + item.count, 0)} total</span></div>
    {items.length ? items.map((item) => <div className="bar-row" key={item._id || item.label}><span className="bar-label">{item._id || item.label}</span><div className="bar-track"><motion.span className={`bar-fill ${colorClass}`} initial={{ width: 0 }} animate={{ width: `${Math.max(3, ((item.count || 0) / max) * 100)}%` }} transition={{ duration: 0.5 }} /></div><strong>{item.count || 0}</strong></div>) : <p className="mini-empty">{emptyLabel}</p>}
  </div>;
}

const activityVerbs = { 'task.created': 'created', 'task.updated': 'updated', 'task.assigned': 'assigned', 'task.completed': 'completed', 'task.status_changed': 'changed status on', 'user.registered': 'joined Taskflow', 'user.updated': 'updated their profile' };

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyIds, setBusyIds] = useState(() => new Set());
  const busyRef = useRef(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setDashboard(await getDashboard({ fresh: true })); }
    catch (requestError) { setError(getMessage(requestError, 'Unable to load your dashboard.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener(TASK_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(TASK_CHANGED_EVENT, refresh);
  }, [load]);

  const complete = async (task, checked) => {
    const id = String(task._id);
    if (busyRef.current.has(id)) return;
    const updatedAt = new Date().toISOString();
    const optimistic = {
      ...task,
      status: checked ? 'Completed' : 'Pending',
      completedAt: checked ? (task.completedAt || updatedAt) : null,
      updatedAt,
    };
    busyRef.current.add(id);
    setBusyIds(new Set(busyRef.current));
    setDashboard((current) => applyDashboardTaskUpdate(current, task, optimistic));
    try {
      const updated = await taskService.update(task._id, { status: checked ? 'Completed' : 'Pending' });
      setDashboard((current) => applyDashboardTaskUpdate(current, optimistic, updated));
      dispatchTaskChanged(updated, { source: 'dashboard' });
      toast({ title: checked ? 'Task completed' : 'Task reopened', description: task.title });
      try { setDashboard(await getDashboard({ fresh: true })); }
      catch { toast({ title: 'Task status saved', description: 'Dashboard summaries were updated locally but could not be refreshed.', variant: 'error' }); }
    } catch (requestError) {
      setDashboard((current) => applyDashboardTaskUpdate(current, optimistic, task));
      toast({ title: 'Failed to update task. Please try again.', description: getMessage(requestError), variant: 'error' });
    } finally {
      busyRef.current.delete(id);
      setBusyIds(new Set(busyRef.current));
    }
  };

  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: WORKSPACE_TIME_ZONE }).format(new Date()).toUpperCase();
  if (error && !dashboard) return <LoadError message={error} onRetry={() => void load()} />;
  return <>
    <PageHeader eyebrow={today} title="Your work, at a glance." description="A clear view of what’s moving and what needs you next." actions={<Link to="/tasks/create" className="button button-primary"><Plus size={16} />Create task</Link>} />
    {error && <div className="inline-error" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Try again</button></div>}
    <section className="metric-grid" aria-label="Task statistics">{metrics.map((metric, metricIndex) => {
      const Icon = metric.icon;
      return <article className={`metric-card metric-${metric.tone}`} key={metric.key}><div className="metric-top"><span>{metric.label}</span><Icon size={17} strokeWidth={1.8} /></div>{loading ? <Skeleton className="metric-skeleton" /> : <CountValue value={dashboard?.stats?.[metric.key] || 0} />}<div className="metric-foot"><span>{metric.key === 'overdue' ? 'Needs attention' : metric.key === 'completed' ? 'Across your workspace' : metric.key === 'total' ? 'Across your workspace' : 'Current status'}</span><span className="metric-index">0{metricIndex + 1}</span></div></article>;
    })}</section>

    <div className="dashboard-grid">
      <section className="surface-card dashboard-analytics"><div className="section-header"><div><span className="section-label">WORKLOAD</span><h2>Task statistics</h2></div><Link to="/reports" className="quiet-link">Full report <ArrowUpRight size={14} /></Link></div>
        <div className="breakdowns-grid">{loading ? <div className="dashboard-loading-bars"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div> : <><Breakdown title="By status" items={(dashboard?.breakdown?.status || []).map((item) => ({ ...item, label: item._id }))} colorClass="fill-teal" emptyLabel="No task data yet." /><Breakdown title="By priority" items={(dashboard?.breakdown?.priority || []).map((item) => ({ ...item, label: item._id }))} colorClass="fill-ink" emptyLabel="No task data yet." /></>}</div>
        <div className="completion-trend"><div className="trend-copy"><span className="section-label">LAST 7 DAYS</span><strong>Completed work</strong><small>Tasks still completed, grouped by completion date</small></div><div className="trend-chart" role="group" aria-label="Tasks currently completed over the last seven days">{(dashboard?.completionTrend || Array.from({ length: 7 }, (_, index) => ({ label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index], count: 0 }))).map((item, index) => {
          const values = dashboard?.completionTrend || [];
          const max = Math.max(1, ...values.map((value) => value.count || 0));
          return <div className="trend-day" key={item.date || `${item.label}-${index}`} tabIndex={0} aria-label={`${item.date || item.label}: ${item.count} completed tasks`}><span className="trend-value">{item.count}</span><span className="trend-bar-bg"><motion.span className="trend-bar" initial={{ height: 0 }} animate={{ height: `${(item.count / max) * 100}%` }} transition={{ duration: 0.4, delay: index * 0.03 }} /></span><small>{item.label}</small></div>;
        })}</div></div>
      </section>
      <section className="surface-card deadlines-card"><div className="section-header"><div><span className="section-label">NEXT UP</span><h2>Upcoming deadlines</h2></div><Link to="/calendar" className="icon-link" aria-label="Open calendar"><ArrowRight size={16} /></Link></div>
        {loading ? <div className="deadline-skeletons"><Skeleton /><Skeleton /><Skeleton /></div> : dashboard?.upcomingDeadlines?.length ? <div className="deadline-list">{dashboard.upcomingDeadlines.map((task) => <Link to={`/tasks/${task._id}`} className="deadline-item" key={task._id}><span className="deadline-date"><strong>{formatDueDate(task.dueDate, { day: 'numeric' })}</strong><small>{formatDueDate(task.dueDate, { month: 'short' })}</small></span><span className="deadline-copy"><strong>{task.title}</strong><small>{relativeDate(task.dueDate)} · {task.category}</small></span><ArrowRight size={14} /></Link>)}</div> : <EmptyState icon={CalendarClock} title="Nothing due this week" description="Your upcoming work will show here." />}
        <Link to="/calendar" className="bottom-link">Open calendar <ArrowRight size={14} /></Link>
      </section>
    </div>

    <div className="dashboard-grid lower-grid">
      <section className="surface-card recent-tasks-card"><div className="section-header"><div><span className="section-label">RECENTLY TOUCHED</span><h2>Recent tasks</h2></div><Link to="/tasks" className="quiet-link">All tasks <ArrowUpRight size={14} /></Link></div>
        {loading ? <div className="recent-skeletons"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div> : dashboard?.recentTasks?.length ? <div className="recent-task-list">{dashboard.recentTasks.map((task) => {
          const progress = subtaskProgress(task.subtasks);
          return <div className="recent-task-item" key={task._id} aria-busy={busyIds.has(String(task._id))}><SpringCheck checked={task.status === 'Completed'} disabled={busyIds.has(String(task._id))} label={`${task.status === 'Completed' ? 'Reopen' : 'Complete'} ${task.title}`} onChange={(checked) => complete(task, checked)} /><Link to={`/tasks/${task._id}`} className={`recent-task-title ${task.status === 'Completed' ? 'is-complete' : ''}`}>{task.imageThumbnail && <img className="recent-task-thumbnail" src={task.imageThumbnail} alt="" loading="lazy" />}<span className="recent-task-title-copy"><span>{task.title}</span>{progress.total > 0 && <small aria-label={`${progress.completed} of ${progress.total} subtasks complete`}>{progress.completed} / {progress.total} subtasks · {progress.percent}%</small>}</span></Link><PriorityBadge priority={task.priority} /><span className="recent-task-date">{formatDate(task.updatedAt, { month: 'short', day: 'numeric' })}</span></div>;
        })}</div> : <EmptyState icon={CircleDashed} title="Your task list is clear" description="Create a task when something needs your attention." action={<Link to="/tasks/create" className="text-link">Create a task <ArrowRight size={14} /></Link>} />}
      </section>
      <section className="surface-card activity-card"><div className="section-header"><div><span className="section-label">TEAM PULSE</span><h2>Recent activity</h2></div>{user?.role === 'Admin' && <Link to="/admin/activity" className="quiet-link">View log <ArrowUpRight size={14} /></Link>}</div>
        {loading ? <div className="activity-skeletons"><Skeleton /><Skeleton /><Skeleton /></div> : dashboard?.recentActivity?.length ? <div className="activity-list">{dashboard.recentActivity.map((item) => <div className="activity-item" key={item._id}><Avatar user={item.actor} size="xs" /><div className="activity-item-copy"><p><strong>{item.actor?.firstName || 'A teammate'} {item.actor?.lastName || ''}</strong> {activityVerbs[item.action] || item.details || 'updated activity'}{item.entityTitle && <> <span className="activity-entity">{item.entityTitle}</span></>}</p><time>{formatDate(item.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div></div>)}</div> : <EmptyState icon={Clock3} title="A quiet workspace" description="Updates to tasks and people will appear here." />}
      </section>
    </div>
  </>;
}
