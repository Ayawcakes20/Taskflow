import { useMemo } from 'react';
import { CheckSquare, ListTodo } from 'lucide-react';
import { EmptyState, Skeleton } from '../common/Primitives';
import TaskRow from './TaskRow';

export default function TaskTable({ tasks = [], loading = false, busyIds = new Set(), onToggle, onDelete, hasFilters = false, onCreate, selectedIds = new Set(), onSelectionChange, onSelectPage, selectionDisabled = false }) {
  const selectedCount = useMemo(() => tasks.filter((task) => selectedIds.has(String(task._id))).length, [tasks, selectedIds]);
  const allSelected = tasks.length > 0 && selectedCount === tasks.length;
  const partiallySelected = selectedCount > 0 && !allSelected;
  return <div className="task-table-shell">
    <div className="task-table-header"><div className="task-column-heading"><input type="checkbox" checked={allSelected} aria-checked={partiallySelected ? 'mixed' : allSelected} aria-label="Select all tasks on this page" disabled={selectionDisabled || !tasks.length} ref={(element) => { if (element) element.indeterminate = partiallySelected; }} onChange={(event) => onSelectPage?.(event.target.checked)} /><span>Select all</span><span>Task</span></div><span>Status</span><span>Priority</span><span>Assignee</span><span>Due date</span><span>Category</span><span /></div>
    {loading ? <div className="task-skeleton-list" aria-label="Loading tasks">{Array.from({ length: 6 }, (_, index) => <div className="task-skeleton-row" key={index}><Skeleton className="skeleton-check" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-status" /><Skeleton className="skeleton-priority" /><Skeleton className="skeleton-avatar" /><Skeleton className="skeleton-date" /></div>)}</div>
      : tasks.length ? <div className="task-table-body">{tasks.map((task) => <TaskRow key={task._id} task={task} busy={busyIds.has(String(task._id))} onToggle={onToggle} onDelete={onDelete} selected={selectedIds.has(String(task._id))} onSelect={onSelectionChange} selectionDisabled={selectionDisabled} />)}</div>
      : <EmptyState icon={hasFilters ? CheckSquare : ListTodo} title={hasFilters ? 'No tasks match these filters' : 'No tasks yet'} description={hasFilters ? 'Try changing your search or clearing a filter.' : 'Add your first task to give today some shape.'} action={hasFilters ? null : <button className="button button-secondary button-sm" onClick={onCreate}>Create task</button>} />}
  </div>;
}
