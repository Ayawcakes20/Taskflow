import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleCheck, ListFilter } from 'lucide-react';
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '../../components/common/Primitives';
import { taskService } from '../../services/taskService';
import { dateOnlyKey, formatDate } from '../../utils/format';
import { getMessage } from '../../services/api';
import { hasValidDueDate } from '../../utils/taskDates';
import { workspaceDayKey } from '../../utils/workspaceDates.js';

const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthLabel = (date) => date.toLocaleDateString('en', { month: 'long', year: 'numeric' });
const workspaceToday = () => new Date(`${workspaceDayKey()}T12:00:00`);

export default function CalendarPage() {
  const [month, setMonth] = useState(() => { const today = workspaceToday(); return new Date(today.getFullYear(), today.getMonth(), 1); });
  const [selected, setSelected] = useState(() => workspaceDayKey());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const start = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const end = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 0), [month]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await taskService.list({ page, limit: 100, dueFrom: dayKey(start), dueTo: dayKey(end), sortBy: 'dueDate', order: 'asc' });
        all.push(...result.items.filter(hasValidDueDate));
        totalPages = result.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);
      setTasks(all);
    } catch (requestError) { setError(getMessage(requestError, 'Unable to load calendar tasks.')); }
    finally { setLoading(false); }
  }, [start, end]);
  useEffect(() => { void load(); }, [load]);
  const tasksByDate = useMemo(() => tasks.reduce((map, task) => {
    const key = dateOnlyKey(task.dueDate);
    map.set(key, [...(map.get(key) || []), task]);
    return map;
  }, new Map()), [tasks]);
  const firstWeekday = start.getDay();
  const daysInMonth = end.getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  const selectedTasks = tasksByDate.get(selected) || [];
  const selectedDate = new Date(`${selected}T12:00:00`);
  const todayKey = workspaceDayKey();

  return <>
    <PageHeader eyebrow="PLAN AHEAD" title="Calendar" description="See what’s coming and make room for focused work." actions={<span className="calendar-month-chip"><span className="context-dot" />{tasks.length} dated tasks this month</span>} />
    {error && <div className="inline-error" role="alert">{error}<button className="text-button" onClick={() => void load()}>Try again</button></div>}
    <div className="calendar-layout">
      <section className="surface-card calendar-card">
        <div className="calendar-toolbar"><div><span className="section-label">MONTH VIEW</span><h2>{monthLabel(month)}</h2></div><div className="calendar-nav"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button><button className="button button-quiet button-sm" onClick={() => { const current = workspaceToday(); setMonth(new Date(current.getFullYear(), current.getMonth(), 1)); setSelected(dayKey(current)); }}>Today</button><button className="icon-button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button></div></div>
        <div className="calendar-grid" role="grid" aria-label={`${monthLabel(month)} task calendar`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
          {cells.map((day, index) => {
            const key = day ? dayKey(new Date(month.getFullYear(), month.getMonth(), day)) : `empty-${index}`;
            const items = day ? tasksByDate.get(key) || [] : [];
            return <button type="button" role="gridcell" key={key} className={`calendar-day ${day ? '' : 'calendar-day-blank'} ${key === selected ? 'is-selected' : ''} ${key === todayKey ? 'is-today' : ''}`} onClick={() => day && setSelected(key)} disabled={!day} aria-label={day ? `${formatDate(new Date(month.getFullYear(), month.getMonth(), day))}${items.length ? `, ${items.length} tasks` : ''}` : undefined} aria-selected={key === selected}>
              {day && <><span className="calendar-day-number">{day}</span><div className="calendar-markers">{items.slice(0, 3).map((task) => <span key={task._id} className={`calendar-marker marker-${task.status.toLowerCase().replaceAll(' ', '-')}`} title={task.title} />)}{items.length > 3 && <small>+{items.length - 3}</small>}</div>{items.slice(0, 2).map((task) => <span className="calendar-task-preview" key={`${task._id}-preview`}>{task.title}</span>)}</>}
            </button>;
          })}
        </div>
        {loading && <div className="calendar-loading"><Skeleton /><Skeleton /><Skeleton /></div>}
      </section>
      <aside className="surface-card selected-day-card"><div className="selected-day-head"><span className="section-label">SELECTED DAY</span><h2>{formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div>
        {selectedTasks.length ? <div className="selected-day-tasks">{selectedTasks.map((task) => <Link to={`/tasks/${task._id}`} key={task._id} className="selected-day-task"><span className="selected-task-time">{task.status === 'Completed' ? <CircleCheck size={16} /> : <span className="selected-task-dot" />}</span><span className="selected-task-copy"><strong>{task.title}</strong><small>{task.category || 'General'} · {task.priority} priority</small></span><StatusBadge status={task.status} /></Link>)}</div> : <EmptyState icon={ListFilter} title="No tasks due" description="Tasks with a due date for this day will appear here." />}
        <div className="calendar-aside-foot"><span>MONTH TOTAL</span><strong>{tasks.length} tasks</strong></div>
      </aside>
    </div>
  </>;
}
