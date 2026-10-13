import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, CheckSquare, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, Trash2, UsersRound, X } from 'lucide-react';
import { Button, PageHeader, SelectField, ConfirmDialog } from '../../components/common/Primitives';
import TaskTable from '../../components/tasks/TaskTable';
import BulkAssigneeDialog from '../../components/tasks/BulkAssigneeDialog';
import { taskService } from '../../services/taskService';
import { getMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { dispatchTaskChanged } from '../../utils/taskEvents';

const initialFilters = { status: '', priority: '', category: '', assignedUser: '', dueDate: '', sortBy: 'dueDate', order: 'asc', page: 1, limit: 10 };

export default function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [filters, setFilters] = useState(() => ({ ...initialFilters, q: searchParams.get('q') || '' }));
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 10 });
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const busyRef = useRef(new Set());
  const loadSequence = useRef(0);
  const { toast } = useToast();
  const hasFilters = Boolean(query || filters.status || filters.priority || filters.category || filters.assignedUser || filters.dueDate);
  const sharedQuery = searchParams.get('q') || '';
  const requestParams = useMemo(() => ({ ...filters, page: filters.q === sharedQuery ? filters.page : 1, q: sharedQuery }), [filters, sharedQuery]);
  const firstVisiblePage = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
  const visiblePages = Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => firstVisiblePage + index);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const sequence = ++loadSequence.current;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const result = await taskService.list(requestParams);
      if (sequence !== loadSequence.current) return;
      setTasks(result.items);
      setPagination(result.pagination);
      setCategories(result.categories || [...new Set(result.items.map((task) => task.category).filter(Boolean))]);
      return result.items;
    } catch (requestError) { if (sequence === loadSequence.current) setError(getMessage(requestError, 'Unable to load tasks.')); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [requestParams]);

  useEffect(() => {
    setQuery((current) => current === sharedQuery ? current : sharedQuery);
    setFilters((current) => current.q === sharedQuery ? current : { ...current, q: sharedQuery, page: 1 });
  }, [sharedQuery]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (query.trim()) next.set('q', query.trim()); else next.delete('q');
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query, searchParams, setSearchParams]);
  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);
  useEffect(() => { setSelectedIds(new Set()); }, [requestParams]);
  useEffect(() => { taskService.users().then(setUsers).catch(() => setUsers([])); }, []);

  const changeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, ...(key === 'page' ? {} : { page: 1 }) }));
  const clearFilters = () => { setQuery(''); setFilters(initialFilters); setSearchParams({}, { replace: true }); };
  const toggleTask = async (task, checked) => {
    const id = String(task._id);
    if (busyRef.current.has(id)) return;
    const updatedAt = new Date().toISOString();
    const previous = task;
    const optimistic = { ...task, status: checked ? 'Completed' : 'Pending', completedAt: checked ? (task.completedAt || updatedAt) : null, updatedAt };
    busyRef.current.add(id);
    setBusyIds(new Set(busyRef.current));
    setTasks((current) => current.map((item) => String(item._id) === id ? optimistic : item));
    try {
      const updated = await taskService.update(task._id, { status: checked ? 'Completed' : 'Pending' });
      setTasks((current) => current.map((item) => String(item._id) === id ? updated : item));
      dispatchTaskChanged(updated, { source: 'tasks' });
      toast({ title: checked ? 'Task completed' : 'Task reopened', description: task.title, variant: 'success' });
      await load({ quiet: true });
    } catch (requestError) {
      setTasks((current) => current.map((item) => String(item._id) === id ? previous : item));
      toast({ title: 'Failed to update task. Please try again.', description: getMessage(requestError), variant: 'error' });
    } finally {
      busyRef.current.delete(id);
      setBusyIds(new Set(busyRef.current));
    }
  };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await taskService.remove(pendingDelete._id);
      toast({ title: 'Task deleted successfully.' });
      setPendingDelete(null);
      await load();
    } catch (requestError) { toast({ title: 'Could not delete task', description: getMessage(requestError), variant: 'error' }); }
    finally { setDeleting(false); }
  };

  const toggleSelection = (task, checked) => setSelectedIds((current) => {
    const next = new Set(current);
    if (checked) next.add(String(task._id)); else next.delete(String(task._id));
    return next;
  });
  const selectCurrentPage = (checked) => setSelectedIds(checked ? new Set(tasks.map((task) => String(task._id))) : new Set());

  const applyBulk = async (action, extra = {}) => {
    if (!selectedIds.size || bulkBusy) return false;
    const ids = [...selectedIds];
    setBulkBusy(true);
    try {
      const result = await taskService.bulk({ action, taskIds: ids, ...extra });
      if (action !== 'delete') {
        const returned = new Map((result.tasks || []).map((task) => [String(task._id), task]));
        setTasks((current) => current.map((task) => returned.get(String(task._id)) || task));
        (result.tasks || []).forEach((task) => dispatchTaskChanged(task, { source: 'tasks-bulk' }));
      }
      const message = action === 'complete' ? 'Selected tasks completed.' : action === 'priority' ? `Priority set to ${extra.priority}.` : action === 'assign' ? 'Assignments updated.' : 'Selected tasks deleted.';
      toast({ title: message, description: `${result.count} tasks updated.`, variant: 'success' });
      setSelectedIds(new Set());
      setBulkPriority('');
      setBulkUsers([]);
      setBulkAssignOpen(false);
      setBulkDeleteOpen(false);
      await load({ quiet: true });
      return true;
    } catch (requestError) {
      toast({ title: 'Bulk action could not be completed', description: getMessage(requestError), variant: 'error' });
      const refreshed = await load({ quiet: true });
      if (Array.isArray(refreshed)) {
        const visible = new Set(refreshed.map((task) => String(task._id)));
        setSelectedIds((current) => new Set([...current].filter((id) => visible.has(id))));
      }
      return false;
    } finally { setBulkBusy(false); }
  };

  return <>
    <PageHeader eyebrow="WORKSPACE" title="Tasks" description="Keep priorities visible and work moving." actions={<Link to="/tasks/create" className="button button-primary"><Plus size={16} />New task</Link>} />
    <section className="task-workspace-panel">
      <div className="task-toolbar">
        <label className="task-search"><Search size={16} /><input aria-label="Search tasks" placeholder="Search tasks, categories, people…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="toolbar-filters"><span className="filter-heading"><SlidersHorizontal size={15} /> Filter</span>
          <SelectField label="Status" aria-label="Filter by status" value={filters.status} onChange={(event) => changeFilter('status', event.target.value)}><option value="">Status</option><option>Pending</option><option>In Progress</option><option>Completed</option></SelectField>
          <SelectField label="Priority" aria-label="Filter by priority" value={filters.priority} onChange={(event) => changeFilter('priority', event.target.value)}><option value="">Priority</option><option>High</option><option>Medium</option><option>Low</option></SelectField>
          <SelectField label="Category" aria-label="Filter by category" value={filters.category} onChange={(event) => changeFilter('category', event.target.value)}><option value="">Category</option>{categories.filter((category) => category.toLowerCase() !== 'general').map((category) => <option key={category}>{category}</option>)}<option value="General">General</option></SelectField>
          <SelectField label="Due date" aria-label="Filter by due date" value={filters.dueDate} onChange={(event) => changeFilter('dueDate', event.target.value)}><option value="">Due date</option><option value="today">Today</option><option value="week">Next 7 days</option><option value="overdue">Overdue</option><option value="none">No date</option></SelectField>
          {users.length > 0 && <SelectField label="Assignee" aria-label="Filter by assigned user" value={filters.assignedUser} onChange={(event) => changeFilter('assignedUser', event.target.value)}><option value="">Assignee</option>{users.map((user) => <option value={user._id} key={user._id}>{user.firstName} {user.lastName}</option>)}</SelectField>}
        </div>
        <div className="toolbar-sort"><SelectField label="Sort by" aria-label="Sort tasks" value={filters.sortBy} onChange={(event) => changeFilter('sortBy', event.target.value)}><option value="dueDate">Due date</option><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="priority">Priority</option><option value="status">Status</option><option value="title">Title</option></SelectField><button type="button" className="sort-direction" aria-label={`Sort ${filters.order === 'asc' ? 'descending' : 'ascending'}`} onClick={() => changeFilter('order', filters.order === 'asc' ? 'desc' : 'asc')}><ArrowDownUp size={15} /></button></div>
        {hasFilters && <button type="button" className="clear-filter" onClick={clearFilters}><X size={14} />Clear filters</button>}
      </div>
      {selectedIds.size > 0 && <div className="bulk-toolbar" role="region" aria-label="Bulk task actions" aria-live="polite">
        <strong>{selectedIds.size} {selectedIds.size === 1 ? 'task' : 'tasks'} selected</strong>
        <Button size="sm" variant="secondary" icon={CheckSquare} disabled={bulkBusy} onClick={() => void applyBulk('complete')}>Complete</Button>
        <div className="bulk-priority-control"><label className="visually-hidden" htmlFor="bulk-task-priority">Change selected task priority</label><select id="bulk-task-priority" className="input select-input" value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value)} disabled={bulkBusy}><option value="">Change priority…</option><option>Low</option><option>Medium</option><option>High</option></select><Button size="sm" variant="secondary" disabled={!bulkPriority || bulkBusy} onClick={() => void applyBulk('priority', { priority: bulkPriority })}>Apply</Button></div>
        <Button size="sm" variant="secondary" icon={UsersRound} disabled={bulkBusy} onClick={() => { setBulkUsers([]); setBulkAssignOpen(true); }}>Assign</Button>
        <Button size="sm" variant="danger" icon={Trash2} disabled={bulkBusy} onClick={() => setBulkDeleteOpen(true)}>Delete</Button>
      </div>}
      {error && <div className="inline-error" role="alert"><span>{error}</span><button className="text-button" onClick={() => void load()}>Try again</button></div>}
      {(!error || tasks.length > 0) && <TaskTable tasks={tasks} loading={loading} busyIds={busyIds} hasFilters={hasFilters} onToggle={toggleTask} onDelete={setPendingDelete} onCreate={() => navigate('/tasks/create')} selectedIds={selectedIds} onSelectionChange={toggleSelection} onSelectPage={selectCurrentPage} selectionDisabled={loading || bulkBusy} />}
      <div className="table-footer"><span>Showing <strong>{pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0}–{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of <strong>{pagination.total}</strong> tasks</span><div className="pagination-controls"><button className="pagination-button" aria-label="Previous page" disabled={pagination.page <= 1 || loading} onClick={() => changeFilter('page', pagination.page - 1)}><ChevronLeft size={16} /></button>{visiblePages.map((pageNumber) => <button type="button" key={pageNumber} className={`pagination-page ${pagination.page === pageNumber ? 'active' : ''}`} aria-label={`Page ${pageNumber}`} aria-current={pagination.page === pageNumber ? 'page' : undefined} disabled={loading} onClick={() => changeFilter('page', pageNumber)}>{pageNumber}</button>)}<button className="pagination-button" aria-label="Next page" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => changeFilter('page', pagination.page + 1)}><ChevronRight size={16} /></button></div></div>
    </section>
    <ConfirmDialog open={Boolean(pendingDelete)} title="Delete this task?" description="This action cannot be undone." confirmLabel="Delete" onClose={() => setPendingDelete(null)} onConfirm={confirmDelete} loading={deleting} />
    <ConfirmDialog open={bulkDeleteOpen} title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'task' : 'tasks'}?`} description={`This will permanently delete ${selectedIds.size} selected tasks. This action cannot be undone.`} confirmLabel="Delete Tasks" onClose={() => { if (!bulkBusy) setBulkDeleteOpen(false); }} onConfirm={() => void applyBulk('delete')} loading={bulkBusy} />
    <BulkAssigneeDialog open={bulkAssignOpen} users={users} value={bulkUsers} onChange={setBulkUsers} onClose={() => { if (!bulkBusy) setBulkAssignOpen(false); }} onConfirm={() => void applyBulk('assign', { assignedUsers: bulkUsers })} busy={bulkBusy} taskCount={selectedIds.size} />
  </>;
}
