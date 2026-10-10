import { Link } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { Avatar, PriorityBadge, StatusBadge } from '../common/Primitives';
import SpringCheck from './SpringCheck';
import { formatDueDate, isDueDateOverdue, relativeDate } from '../../utils/format';
import { subtaskProgress } from '../../utils/taskSubtasks';

function assignedPeople(task) {
  if (Array.isArray(task.assignedUsers) && task.assignedUsers.length) return task.assignedUsers;
  return task.assignedUser ? [task.assignedUser] : [];
}

function personName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ') || person?.username || 'Team member';
}

export default function TaskRow({ task, onToggle, onDelete, busy = false, selected = false, onSelect, selectionDisabled = false }) {
  const overdue = isDueDateOverdue(task.dueDate) && task.status !== 'Completed';
  const assignees = assignedPeople(task);
  const names = assignees.map(personName);
  const progress = subtaskProgress(task.subtasks);
  return <div className={`task-row ${task.status === 'Completed' ? 'task-row-completed' : ''} ${busy ? 'is-updating' : ''}`} aria-busy={busy}>
    <div className="task-title-cell">
      <input type="checkbox" className="task-selection-checkbox" checked={selected} disabled={selectionDisabled} aria-label={`Select ${task.title}`} onChange={(event) => onSelect?.(task, event.target.checked)} />
      <SpringCheck checked={task.status === 'Completed'} disabled={busy} label={`${task.status === 'Completed' ? 'Reopen' : 'Complete'} ${task.title}`} onChange={(checked) => onToggle(task, checked)} />
      {task.imageThumbnail && <img className="task-row-thumbnail" src={task.imageThumbnail} alt="" loading="lazy" />}
      <div className="task-title-copy"><Link to={`/tasks/${task._id}`} className="task-title-link">{task.title}</Link><span className="task-description-preview">{task.description || task.category || 'No description'}</span>{progress.total > 0 && <small className="task-row-subtask-progress">{progress.completed} / {progress.total} subtasks{progress.percent === null ? '' : ` · ${progress.percent}%`}</small>}</div>
    </div>
    <div className="task-status-cell"><StatusBadge status={task.status} /></div>
    <div className="task-priority-cell"><PriorityBadge priority={task.priority} /></div>
    <div className="task-assignee-cell">{assignees.length ? <span className="task-assignee-stack" title={names.join(', ')} aria-label={`Assigned to ${names.join(', ')}`}>
      <span className="task-assignee-avatars">{assignees.slice(0, 3).map((person, index) => <Avatar key={person?._id ?? person ?? index} user={person} size="xs" />)}{assignees.length > 3 && <span className="task-assignee-more">+{assignees.length - 3}</span>}</span>
      <span className="task-assignee-count">{assignees.length === 1 ? names[0] : `${assignees.length} assigned`}</span>
    </span> : <span className="muted-dash">Unassigned</span>}</div>
    <div className={`task-due-cell ${overdue ? 'is-overdue' : ''}`}><span>{relativeDate(task.dueDate)}</span><small>{task.dueDate ? formatDueDate(task.dueDate, { month: 'short', day: 'numeric' }) : '—'}</small></div>
    <div className="task-category-cell"><span className="category-pill">{task.category || 'General'}</span></div>
    <div className="task-actions-cell"><button className="icon-button row-menu-button" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => onDelete(task)}><MoreHorizontal size={17} /></button></div>
  </div>;
}
