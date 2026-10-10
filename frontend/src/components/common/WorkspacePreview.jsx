import { Check, LayoutDashboard, ListTodo, Columns3, CalendarDays, ArrowUpRight } from 'lucide-react';

export default function WorkspacePreview() {
  return <div className="workspace-preview" aria-label="Illustrative Taskflow workspace preview">
    <div className="preview-bar"><span className="brand-link"><span className="brand-mark"><span /><span /><span /></span>taskflow</span><span className="preview-demo">SAMPLE WORKSPACE</span></div>
    <div className="preview-body"><div className="preview-nav"><LayoutDashboard /><ListTodo /><Columns3 /><CalendarDays /></div><div className="preview-main">
      <div className="preview-heading"><div><span className="section-label">YOUR WORK, AT A GLANCE</span><h3>A little clarity. A lot of progress.</h3></div><ArrowUpRight size={20} /></div>
      <div className="preview-metrics"><div><small>Total tasks</small><strong>12</strong></div><div><small>In progress</small><strong>4</strong></div><div><small>Completed</small><strong>8<span>/12</span></strong></div></div>
      <div className="preview-list"><div className="preview-list-head"><strong>Project milestones</strong><span>This week</span></div>{[['Define project requirements', 'Completed'], ['Build the task workspace', 'In Progress'], ['Prepare the presentation', 'Pending']].map(([title, status]) => <div className="preview-task" key={title}><span className={`preview-check ${status === 'Completed' ? 'done' : ''}`}>{status === 'Completed' && <Check size={13} />}</span><span>{title}</span><span className={`preview-status ${status === 'Completed' ? 'done' : ''}`}>{status}</span></div>)}</div>
      <div className="preview-progress"><span>Every step moves your project forward.</span><div><i /></div><small>8 of 12 tasks complete</small></div>
    </div></div>
  </div>;
}
