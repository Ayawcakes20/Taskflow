import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, Clock3, Edit3, Flag, Tag, Trash2, UserRound } from 'lucide-react';
import { Avatar, Button, ConfirmDialog, PageHeader, PriorityBadge, SelectField, Skeleton, StatusBadge } from '../../components/common/Primitives';
import SpringCheck from '../../components/tasks/SpringCheck';
import SubtaskChecklist from '../../components/tasks/SubtaskChecklist';
import TaskCommentsPanel from '../../components/tasks/TaskCommentsPanel';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { getMessage } from '../../services/api';
import { formatDate, formatDueDate, isDueDateOverdue } from '../../utils/format';
import { statusAfterSubtaskChange } from '../../utils/taskSubtasks';
import { dispatchTaskChanged } from '../../utils/taskEvents';

const activityText = { 'task.created': 'created this task', 'task.updated': 'updated task details', 'task.assigned': 'changed the assignee', 'task.completed': 'completed this task', 'task.status_changed': 'changed the task status', 'task.deleted': 'deleted this task', 'task.comment_added': 'added a comment', 'task.comment_updated': 'edited a comment', 'task.comment_deleted': 'deleted a comment' };

function assignedPeople(task) {
  if (Array.isArray(task?.assignedUsers) && task.assignedUsers.length) return task.assignedUsers;
  return task?.assignedUser ? [task.assignedUser] : [];
}

export default function TaskDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [task, setTask] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingSubtasks, setSavingSubtasks] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try { const result = await taskService.get(id); setTask(result.task); setActivity(result.activity || []); }
    catch (requestError) { setError(getMessage(requestError, 'Unable to load this task.')); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const changeStatus = async (status) => {
    if (savingStatus || status === task?.status) return;
    setSavingStatus(true);
    const previous = task;
    const updatedAt = new Date().toISOString();
    setTask({ ...task, status, completedAt: status === 'Completed' ? (task.completedAt || updatedAt) : null, updatedAt });
    try { const updated = await taskService.update(id, { status }); setTask({ ...updated, comments: previous.comments || [] }); dispatchTaskChanged(updated, { source: 'task-details' }); toast({ title: status === 'Completed' ? 'Task completed' : 'Status updated', description: updated.title }); void load(); }
    catch (requestError) { setTask(previous); toast({ title: 'Failed to update task. Please try again.', description: getMessage(requestError), variant: 'error' }); }
    finally { setSavingStatus(false); }
  };
  const changeSubtasks = async (subtasks) => {
    if (savingSubtasks) return;
    const previous = task;
    const status = statusAfterSubtaskChange(task.status, subtasks);
    const updatedAt = new Date().toISOString();
    const optimistic = { ...task, subtasks, status, completedAt: status === 'Completed' ? (task.completedAt || updatedAt) : null, updatedAt };
    setSavingSubtasks(true);
    setTask(optimistic);
    try {
      const updated = await taskService.update(id, { subtasks });
      setTask({ ...updated, comments: previous.comments || [] });
      dispatchTaskChanged(updated, { source: 'task-details' });
      toast({ title: status !== task.status ? `Task moved to ${updated.status}` : 'Checklist updated', description: updated.title });
    } catch (requestError) {
      setTask(previous);
      toast({ title: 'Checklist change was not saved', description: getMessage(requestError), variant: 'error' });
    } finally { setSavingSubtasks(false); }
  };
  const remove = async () => {
    setDeleting(true);
    try { await taskService.remove(id); toast({ title: 'Task deleted successfully.' }); navigate('/tasks', { replace: true }); }
    catch (requestError) { toast({ title: 'Could not delete task', description: getMessage(requestError), variant: 'error' }); }
    finally { setDeleting(false); }
  };
  if (loading) return <div className="detail-loading"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-panel" /></div>;
  if (error || !task) return <div className="error-page"><div className="inline-error" role="alert">{error || 'Task not found.'}</div><Link className="button button-secondary" to="/tasks"><ArrowLeft size={15} />Back to tasks</Link></div>;
  const overdue = isDueDateOverdue(task.dueDate) && task.status !== 'Completed';
  const people = assignedPeople(task);

  return <>
    <PageHeader eyebrow="TASK DETAILS" title={task.title} description={task.category || 'General'} actions={<><Link to="/tasks" className="button button-secondary"><ArrowLeft size={15} />Tasks</Link><Link to={`/tasks/${id}/edit`} className="button button-secondary"><Edit3 size={15} />Edit</Link><Button variant="danger-quiet" icon={Trash2} onClick={() => setDeleteOpen(true)}>Delete</Button></>} />
    <div className="details-layout">
      <section className="details-main">
        <div className="detail-status-bar" aria-busy={savingStatus}><div className="detail-complete-control"><SpringCheck checked={task.status === 'Completed'} disabled={savingStatus} label={`${task.status === 'Completed' ? 'Reopen' : 'Complete'} task`} onChange={(checked) => changeStatus(checked ? 'Completed' : 'Pending')} /><span>{task.status === 'Completed' ? 'Completed' : 'Mark as complete'}</span></div><SelectField label="Change task status" aria-label="Change task status" value={task.status} disabled={savingStatus} onChange={(event) => changeStatus(event.target.value)}><option>Pending</option><option>In Progress</option><option>Completed</option></SelectField></div>
        {task.imageUrl && <figure className="task-detail-image"><img src={task.imageUrl} alt={`Reference for ${task.title}`} /><figcaption>Task reference image</figcaption></figure>}
        <article className="description-block"><div className="section-label">DESCRIPTION</div><p className={task.description ? '' : 'muted-copy'}>{task.description || 'No description has been added.'}</p></article>
        <SubtaskChecklist items={task.subtasks || []} onChange={(subtasks) => void changeSubtasks(subtasks)} disabled={savingSubtasks} />
        <TaskCommentsPanel task={task} onTaskChange={setTask} />
        <section className="activity-panel"><div className="section-header"><div><span className="section-label">HISTORY</span><h2>Activity</h2></div><span className="subtle-count">{activity.length} updates</span></div>
          {activity.length ? <div className="activity-list">{activity.map((item) => <div key={item._id} className="activity-item"><Avatar user={item.actor} size="xs" /><div className="activity-item-copy"><p><strong>{item.actor?.firstName || 'A user'} {item.actor?.lastName || ''}</strong> {activityText[item.action] || item.details || item.action.replaceAll('.', ' ')}</p><time>{formatDate(item.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div></div>)}</div> : <div className="quiet-empty">Activity will appear here as this task changes.</div>}
        </section>
      </section>
      <aside className="details-aside">
        <div className="metadata-panel"><span className="section-label">DETAILS</span>
          <div className="metadata-row"><span><Check size={15} />Status</span><StatusBadge status={task.status} /></div>
          <div className="metadata-row"><span><Flag size={15} />Priority</span><PriorityBadge priority={task.priority} /></div>
          <div className="metadata-row"><span><Tag size={15} />Category</span><strong>{task.category || 'General'}</strong></div>
          <div className="metadata-row assignees-metadata-row"><span><UserRound size={15} />Assigned to</span>{people.length ? <div className="metadata-assignee-list">{people.map((person) => <span className="metadata-person" key={person?._id ?? person}><Avatar user={person} size="xs" /><span>{person?.firstName ? `${person.firstName} ${person.lastName || ''}`.trim() : person?.username || 'Team member'}</span></span>)}</div> : <strong className="muted-copy">Unassigned</strong>}</div>
          <div className={`metadata-row ${overdue ? 'is-overdue' : ''}`}><span><CalendarDays size={15} />Due date</span><strong>{formatDueDate(task.dueDate)}</strong></div>
          <div className="metadata-row"><span><UserRound size={15} />Created by</span><strong>{task.createdBy?.firstName || '—'} {task.createdBy?.lastName || ''}</strong></div>
          <div className="metadata-row"><span><Clock3 size={15} />Created</span><strong>{formatDate(task.createdAt)}</strong></div>
          <div className="metadata-row"><span><Clock3 size={15} />Updated</span><strong>{formatDate(task.updatedAt)}</strong></div>
        </div>
        <div className="detail-note"><span className="detail-note-mark" />Small steps count. Keep the next action clear.</div>
      </aside>
    </div>
    <ConfirmDialog open={deleteOpen} title="Delete this task?" description="This action cannot be undone." onClose={() => setDeleteOpen(false)} onConfirm={remove} loading={deleting} />
  </>;
}
