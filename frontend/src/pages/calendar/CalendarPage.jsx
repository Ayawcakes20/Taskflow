import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const loadSequence = useRef(0);
  const start = useMemo(() => new Date(month.getFullYear(), month.getMonth(), 1), [month]);
  const end = useMemo(() => new Date(month.getFullYear(), month.getMonth() + 1, 0), [month]);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const result = await taskService.list({ page, limit: 100, dueFrom: dayKey(start), dueTo: dayKey(end), sortBy: 'dueDate', order: 'asc' });
        if (sequence !== loadSequence.current) return;
        all.push(...result.items.filter(hasValidDueDate));
        totalPages = result.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);
      setTasks(all);
    } catch (requestError) { if (sequence === loadSequence.current) setError(getMessage(requestError, 'Unable to load calendar tasks.')); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [start, end]);
  useEffect(() => { void load(); return () => { loadSequence.current++; }; }, [load]);
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
  const changeMonth = (offset) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next); setSelected(dayKey(next));
  };

  return <>
    <PageHeader eyebrow="PLAN AHEAD" title="Calendar" description="See what’s coming and make room for focused work." actions={<span className="calendar-month-chip"><span className="context-dot" />{loading ? 'Loading dated tasks…' : error ? 'Calendar data unavailable' : `${tasks.length} dated tasks this month`}</span>} />
    {error && <div className="inline-error" role="alert">{error}<button className="text-button" onClick={() => void load()}>Try again</button></div>}
    <div className="calendar-layout">
      <section className="surface-card calendar-card">
        <div className="calendar-toolbar"><div><span className="section-label">MONTH VIEW</span><h2>{monthLabel(month)}</h2></div><div className="calendar-nav"><button className="icon-button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button><button className="button button-quiet button-sm" onClick={() => { const current = workspaceToday(); setMonth(new Date(current.getFullYear(), current.getMonth(), 1)); setSelected(dayKey(current)); }}>Today</button><button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button></div></div>
        {loading && <div className="calendar-loading" role="status"><span className="spin-inline" />Loading tasks for {monthLabel(month)}…</div>}
        <table className="calendar-grid" aria-label={`${monthLabel(month)} task calendar`} aria-busy={loading}>
          <thead><tr>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <th className="calendar-weekday" scope="col" key={day}>{day}</th>)}</tr></thead>
          <tbody>{Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>{cells.slice(week * 7, week * 7 + 7).map((day, offset) => {
            const index = week * 7 + offset;
            const key = day ? dayKey(new Date(month.getFullYear(), month.getMonth(), day)) : `empty-${index}`;
            const items = day && !loading && !error ? tasksByDate.get(key) || [] : [];
            return <td key={key}><button type="button" className={`calendar-day ${day ? '' : 'calendar-day-blank'} ${key === selected ? 'is-selected' : ''} ${key === todayKey ? 'is-today' : ''}`} onClick={() => day && setSelected(key)} disabled={!day} aria-label={day ? `${formatDate(new Date(month.getFullYear(), month.getMonth(), day))}${items.length ? `, ${items.length} tasks` : ''}` : 'Outside this month'} aria-pressed={day ? key === selected : undefined}>
              {day && <><span className="calendar-day-number">{day}</span><div className="calendar-markers">{items.slice(0, 3).map((task) => <span key={task._id} className={`calendar-marker marker-${task.status.toLowerCase().replaceAll(' ', '-')}`} title={task.title} />)}{items.length > 3 && <small>+{items.length - 3}</small>}</div>{items.slice(0, 2).map((task) => <span className="calendar-task-preview" key={`${task._id}-preview`}>{task.title}</span>)}</>}
            </button></td>;
          })}</tr>)}</tbody>
        </table>
      </section>
      <aside className="surface-card selected-day-card"><div className="selected-day-head"><span className="section-label">SELECTED DAY</span><h2>{formatDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div>
        {loading ? <div className="selected-day-loading" role="status" aria-label="Loading selected day"><Skeleton /><Skeleton /></div> : error ? <p className="mini-empty">Task data is unavailable. Try loading the calendar again.</p> : selectedTasks.length ? <div className="selected-day-tasks">{selectedTasks.map((task) => <Link to={`/tasks/${task._id}`} key={task._id} className="selected-day-task"><span className="selected-task-time">{task.status === 'Completed' ? <CircleCheck size={16} /> : <span className="selected-task-dot" />}</span><span className="selected-task-copy"><strong>{task.title}</strong><small>{task.category || 'General'} · {task.priority} priority</small></span><StatusBadge status={task.status} /></Link>)}</div> : <EmptyState icon={ListFilter} title="No tasks due" description="Tasks with a due date for this day will appear here." />}
        <div className="calendar-aside-foot"><span>MONTH TOTAL</span><strong>{loading || error ? "—" : tasks.length} tasks</strong></div>
      </aside>
    </div>
  </>;
}
