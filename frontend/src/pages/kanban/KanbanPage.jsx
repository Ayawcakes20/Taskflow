import { useCallback, useEffect, useMemo, useState } from 'react';
import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useDraggable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Filter, GripVertical, KanbanSquare, LoaderCircle, Plus, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, PageHeader, PriorityBadge, Skeleton, StatusBadge, Avatar } from '../../components/common/Primitives';
import { taskService } from '../../services/taskService';
import { getMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDueDate } from '../../utils/format';
import { hasValidDueDate } from '../../utils/taskDates';
import { subtaskProgress } from '../../utils/taskSubtasks';
import { dispatchTaskChanged } from '../../utils/taskEvents';

const COLUMNS = [
  { id: 'Pending', label: 'Pending', hint: 'Queued for a clear next step', tone: 'pending', limit: 10 },
  { id: 'In Progress', label: 'In Progress', hint: 'Work actively moving', tone: 'progress', limit: 5 },
  { id: 'Completed', label: 'Completed', hint: 'Finished and recently closed', tone: 'completed', limit: Infinity },
];

function assigneesFor(task) {
  if (Array.isArray(task?.assignedUsers) && task.assignedUsers.length) return task.assignedUsers;
  return task?.assignedUser ? [task.assignedUser] : [];
}

function initials(user) {
  return `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';
}

function AvatarStack({ users }) {
  const visible = users.slice(0, 3);
  return <div className="kanban-avatar-stack" aria-label={`${users.length} assigned ${users.length === 1 ? 'person' : 'people'}`}>
    {visible.map((user, index) => user?.profileImage
      ? <img className="avatar avatar-xs" key={user._id || index} src={user.profileImage} alt={`${user.firstName || 'User'} ${user.lastName || ''}`.trim()} title={`${user.firstName || 'User'} ${user.lastName || ''}`.trim()} />
      : <span className="avatar avatar-xs" key={user?._id || index} title={`${user?.firstName || 'User'} ${user?.lastName || ''}`.trim()} aria-label={`${user?.firstName || 'User'} ${user?.lastName || ''}`.trim()}>{initials(user)}</span>)}
    {users.length > 3 && <span className="kanban-avatar-more" title={`${users.length - 3} more assigned`}>+{users.length - 3}</span>}
  </div>;
}

function KanbanCard({ task, updating, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({ id: String(task._id), data: { task } });
  const progress = subtaskProgress(task.subtasks);
  const assignees = assigneesFor(task);
  const style = { transform: CSS.Translate.toString(transform), transition };
  return <article ref={setNodeRef} style={style} className={`kanban-card ${isDragging ? 'is-dragging' : ''} ${updating ? 'is-updating' : ''}`} aria-busy={updating}>
    <div className="kanban-card-top"><PriorityBadge priority={task.priority} />{hasValidDueDate(task.dueDate) && <span className="kanban-due-date">{formatDueDate(task.dueDate, { month: 'short', day: 'numeric' })}</span>}</div>
    <button type="button" className="kanban-card-title" onClick={() => onOpen(task)}>{task.title}</button>
    {task.description && <p className="kanban-card-description">{task.description}</p>}
    {task.imageThumbnail && <img className="kanban-card-image" src={task.imageThumbnail} alt="" loading="lazy" />}
    <div className="kanban-card-footer"><AvatarStack users={assignees} />{progress.total > 0 && <span className="kanban-subtask-progress" aria-label={`${progress.completed} of ${progress.total} subtasks complete`}><span className="kanban-progress-track"><span style={{ width: `${progress.percent}%` }} /></span>{progress.completed}/{progress.total}</span>}<button type="button" className="kanban-drag-handle" aria-label={`Drag ${task.title}`} title="Drag task" {...attributes} {...listeners}><GripVertical size={16} /></button></div>
    {updating && <span className="kanban-card-saving"><LoaderCircle size={13} className="spin" />Saving</span>}
  </article>;
}

function DropColumn({ column, tasks, updatingId, onOpen }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id, data: { status: column.id } });
  return <section ref={setNodeRef} className={`kanban-column kanban-column-${column.tone} ${isOver ? 'is-over' : ''}`} aria-labelledby={`kanban-column-${column.tone}`}>
    <div className="kanban-column-head"><div><h2 id={`kanban-column-${column.tone}`}><span className="kanban-column-dot" />{column.label}</h2><p>{column.hint}</p></div><span className="kanban-column-count">{tasks.length}{Number.isFinite(column.limit) ? `/${column.limit}` : ''}</span></div>
    <div className="kanban-column-body" aria-label={`${column.label} tasks`}>
      {tasks.length ? tasks.map((task) => <KanbanCard key={task._id} task={task} updating={String(task._id) === updatingId} onOpen={onOpen} />) : <div className="kanban-empty"><KanbanSquare size={18} /><span>No tasks here yet</span><small>Drag a task into this column</small></div>}
    </div>
  </section>;
}

export default function KanbanPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTask, setActiveTask] = useState(null);
  const [updatingId, setUpdatingId] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [items, people] = await Promise.all([taskService.listAll({ sortBy: 'updatedAt', order: 'desc' }), taskService.users()]);
      setTasks(items);
      setUsers(people || []);
    } catch (requestError) {
      setError(getMessage(requestError, 'Unable to load Kanban tasks.'));
    } finally { if (!quiet) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = () => void load({ quiet: true });
    window.addEventListener('taskflow:task-changed', refresh);
    return () => window.removeEventListener('taskflow:task-changed', refresh);
  }, [load]);

  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const people = assigneesFor(task);
      const matchesQuery = !needle || [task.title, task.description, task.category, ...people.map((person) => `${person?.firstName || ''} ${person?.lastName || ''} ${person?.username || ''}`)].join(' ').toLowerCase().includes(needle);
      const matchesPriority = !priority || task.priority === priority;
      const matchesAssignee = !assignee || people.some((person) => String(person?._id || person) === assignee);
      return matchesQuery && matchesPriority && matchesAssignee;
    });
  }, [tasks, query, priority, assignee]);

  const grouped = useMemo(() => COLUMNS.reduce((map, column) => { map[column.id] = visibleTasks.filter((task) => task.status === column.id); return map; }, {}), [visibleTasks]);

  const handleDragStart = ({ active }) => setActiveTask(tasks.find((task) => String(task._id) === String(active.id)) || null);
  const handleDragCancel = () => setActiveTask(null);
  const handleDragEnd = async ({ active, over }) => {
    setActiveTask(null);
    if (!over) return;
    const task = tasks.find((item) => String(item._id) === String(active.id));
    const targetStatus = over.data.current?.status || tasks.find((item) => String(item._id) === String(over.id))?.status;
    if (!task || !targetStatus || task.status === targetStatus) return;
    const column = COLUMNS.find((item) => item.id === targetStatus);
    const visibleInTarget = grouped[targetStatus]?.length || 0;
    if (column?.limit !== Infinity && visibleInTarget >= column.limit) {
      toast({ title: 'WIP limit reached', description: `${column.label} can contain a maximum of ${column.limit} visible tasks.`, variant: 'error' });
      return;
    }
    const previous = task;
    setUpdatingId(String(task._id));
    setTasks((current) => current.map((item) => String(item._id) === String(task._id) ? { ...item, status: targetStatus, completedAt: targetStatus === 'Completed' ? (item.completedAt || new Date().toISOString()) : null } : item));
    try {
      const updated = await taskService.update(task._id, { status: targetStatus });
      setTasks((current) => current.map((item) => String(item._id) === String(task._id) ? updated : item));
      dispatchTaskChanged(updated, { source: 'kanban' });
      toast({ title: `Task moved to ${targetStatus}`, description: updated.title, variant: 'success' });
    } catch (requestError) {
      setTasks((current) => current.map((item) => String(item._id) === String(task._id) ? previous : item));
      await load({ quiet: true });
      toast({ title: 'Unable to update task status.', description: getMessage(requestError, 'Please try again.'), variant: 'error' });
    } finally { setUpdatingId(''); }
  };

  return <>
    <PageHeader eyebrow="WORKSPACE / FLOW" title="Kanban" description="Move work across a focused three-stage board." actions={<Link to="/tasks/create" className="button button-primary"><Plus size={16} />New task</Link>} />
    <section className="kanban-workspace surface-card">
      <div className="kanban-toolbar"><div className="kanban-toolbar-copy"><span className="section-label">LIVE TASK BOARD</span><strong>{visibleTasks.length} {visibleTasks.length === 1 ? 'task' : 'tasks'} in view</strong></div><div className="kanban-filters"><label className="task-search"><Search size={16} /><input aria-label="Search Kanban tasks" placeholder="Search tasks or people" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="kanban-filter"><Filter size={14} /><select aria-label="Filter Kanban by priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select></label>{users.length > 0 && <label className="kanban-filter"><select aria-label="Filter Kanban by assigned user" value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">All assignees</option>{users.map((person) => <option key={person._id} value={person._id}>{person.firstName} {person.lastName}</option>)}</select></label>}</div></div>
      {error && <div className="inline-error" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Try again</button></div>}
      {loading ? <div className="kanban-board" aria-label="Loading Kanban"><div className="kanban-column-skeleton"><Skeleton /><Skeleton /><Skeleton /></div><div className="kanban-column-skeleton"><Skeleton /><Skeleton /><Skeleton /></div><div className="kanban-column-skeleton"><Skeleton /><Skeleton /><Skeleton /></div></div> : <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragCancel={handleDragCancel} onDragEnd={handleDragEnd}><div className="kanban-board">{COLUMNS.map((column) => <DropColumn key={column.id} column={column} tasks={grouped[column.id] || []} updatingId={updatingId} onOpen={(task) => navigate(`/tasks/${task._id}`)} />)}</div><DragOverlay>{activeTask ? <KanbanCard task={activeTask} updating={false} onOpen={() => {}} /> : null}</DragOverlay></DndContext>}
    </section>
    {!loading && !visibleTasks.length && <div className="kanban-page-empty"><EmptyState icon={KanbanSquare} title="No tasks match these filters" description="Clear a filter or create a task to start moving work." action={<Link to="/tasks/create" className="text-link">Create a task</Link>} /></div>}
  </>;
}
