import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, CircleDashed, ListChecks } from 'lucide-react';
import { EmptyState, LoadError, PageHeader, Skeleton } from '../../components/common/Primitives';
import { getReports } from '../../services/workspaceService';
import { getMessage } from '../../services/api';

function Bars({ title, items, total, tone = 'teal' }) {
  const max = Math.max(1, ...items.map((item) => item.count || 0));
  return <section className="surface-card report-card"><div className="section-header"><div><span className="section-label">DISTRIBUTION</span><h2>{title}</h2></div><span className="report-total">{total}</span></div>
    {items.length ? <div className="report-bars">{items.map((item) => <div className="report-bar-row" key={item._id || item.label}><div className="report-bar-label"><span>{item._id || item.label || 'Uncategorized'}</span><strong>{item.count}</strong></div><div className="bar-track"><span className={`bar-fill fill-${tone}`} style={{ width: `${Math.max(3, (item.count / max) * 100)}%` }} /></div></div>)}</div> : <EmptyState icon={CircleDashed} title="No data to show" description="Task activity will build this report over time." />}
  </section>;
}

export default function ReportsPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getReports().then((result) => { if (active) setReports(result); }).catch((requestError) => { if (active) setError(getMessage(requestError, 'Unable to load reports.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const trend = reports?.trend || [];
  const maxTrend = Math.max(1, ...trend.map((item) => item.count || 0));
  const summary = reports?.summary || {};
  const cards = [
    { label: 'Completion rate', value: `${summary.completionRate || 0}%`, icon: CheckCircle2, tone: 'green', detail: `${summary.completed || 0} completed` },
    { label: 'Completed tasks', value: summary.completed || 0, icon: CheckCircle2, tone: 'green', detail: 'Tasks finished' },
    { label: 'Total tasks', value: summary.total || 0, icon: ListChecks, tone: 'blue', detail: 'Across your workspace' },
    { label: 'Overdue tasks', value: summary.overdue || 0, icon: AlertCircle, tone: 'red', detail: 'Open tasks past due' },
  ];
  if (error) return <LoadError message={error} onRetry={() => setRetry((value) => value + 1)} />;
  return <>
    <PageHeader eyebrow="INSIGHTS" title="Reports" description="Useful signals on progress, workload, and what’s past due." actions={<span className="report-period"><span className="context-dot" />30-day trend</span>} />
    {error && <div className="inline-error" role="alert">{error}</div>}
    <section className="report-summary-grid">{cards.map((item) => { const Icon = item.icon; return <article className={`report-summary-card tone-${item.tone}`} key={item.label}><div className="report-summary-top"><span>{item.label}</span><Icon size={17} /></div>{loading ? <Skeleton className="report-skeleton-value" /> : <strong>{item.value}</strong>}<small>{item.detail}</small></article>; })}</section>
    <section className="surface-card trend-report-card"><div className="section-header"><div><span className="section-label">COMPLETION TREND</span><h2>Completed work, day by day</h2></div><span className="trend-window">30 days</span></div>
      {loading ? <div className="trend-skeleton"><Skeleton /><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div> : trend.some((item) => item.count > 0) ? <div className="report-trend-chart" role="group" aria-label="Currently completed tasks by their completion date over the last 30 days">{trend.map((item) => <div className="report-trend-column" key={item.date} tabIndex={0} aria-label={`${item.date}: ${item.count} completed tasks`}><span className="chart-detail">{item.date}: {item.count} completed</span><span className="report-trend-bar" style={{ height: `${(item.count / maxTrend) * 100}%` }} /></div>)}</div> : <EmptyState icon={ArrowUpRight} title="Progress takes shape here" description="As tasks are completed, the daily trend will appear." />}
      <div className="report-axis"><span>30 days ago</span><span>Today</span></div>
    </section>
    <div className="report-grid"><Bars title="Tasks by status" items={reports?.byStatus || []} total={summary.total || 0} tone="teal" /><Bars title="Tasks by priority" items={reports?.byPriority || []} total={summary.total || 0} tone="ink" /><Bars title="Tasks by category" items={reports?.byCategory || []} total={summary.total || 0} tone="amber" /></div>
    <div className="reports-footnote"><ArrowDownRight size={15} /><span>Summaries include all current tasks. The trend counts tasks still completed by their latest completion date over 30 days (Asia/Manila). Overdue counts exclude completed tasks.</span></div>
  </>;
}
