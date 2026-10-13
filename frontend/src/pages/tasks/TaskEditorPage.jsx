import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Save } from 'lucide-react';
import { Button, LoadError, PageHeader, SelectField, TextAreaField } from '../../components/common/Primitives';
import UnsavedChanges from '../../components/common/UnsavedChanges';
import AssigneeMultiSelect from '../../components/tasks/AssigneeMultiSelect';
import TaskImagePicker from '../../components/tasks/TaskImagePicker';
import SubtaskChecklist from '../../components/tasks/SubtaskChecklist';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { getMessage } from '../../services/api';
import { statusAfterSubtaskChange } from '../../utils/taskSubtasks';
import { dispatchTaskChanged } from '../../utils/taskEvents';
import { taskImagePayload } from '../../utils/imagePayload';

const emptyForm = { title: '', description: '', priority: 'Medium', status: 'Pending', category: 'General', assignedUsers: [], dueDate: '', imageUrl: null, imageThumbnail: null, subtasks: [] };

function assignedPeople(task) {
  if (Array.isArray(task.assignedUsers) && task.assignedUsers.length) return task.assignedUsers;
  return task.assignedUser ? [task.assignedUser] : [];
}

export default function TaskEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadedId, setLoadedId] = useState(null);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyForm));

  useEffect(() => {
    let active = true;
    setLoading(editing);
    setLoadError('');
    setLoadedId(null);
    if (!editing) { setForm(emptyForm); setBaseline(JSON.stringify(emptyForm)); }
    taskService.users().then((items) => { if (active) setUsers(items); }).catch(() => {});
    if (editing) taskService.get(id).then(({ task }) => {
      if (!active) return;
      const people = assignedPeople(task);
      const nextForm = {
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'Medium',
        status: task.status || 'Pending',
        category: task.category || 'General',
        assignedUsers: people.map((person) => String(person?._id ?? person)).filter(Boolean),
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
        imageUrl: task.imageUrl || null,
        imageThumbnail: task.imageThumbnail || null,
        subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      };
      setForm(nextForm);
      setBaseline(JSON.stringify(nextForm));
      setLoadedId(id);
    }).catch((requestError) => { if (active) setLoadError(getMessage(requestError, 'Unable to load this task.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editing, id, retry]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    if (key === 'title') setTitleError('');
    setError('');
  };

  const updateSubtasks = (subtasks) => {
    setForm((current) => ({ ...current, subtasks, status: statusAfterSubtaskChange(current.status, subtasks) }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || (editing && loadedId !== id)) return;
    if (event.currentTarget.contains(document.activeElement) && document.activeElement?.id === 'new-subtask-title') return;
    if (!form.title.trim()) { setTitleError('Enter a title for this task.'); return; }
    if (form.title.trim().length > 180) { setTitleError('Keep the title under 180 characters.'); return; }
    if (form.subtasks.some((subtask) => !subtask.title.trim())) { setError('Give each subtask a title or remove the empty row.'); return; }
    setSaving(true); setError('');
    const { imageUrl: _imageUrl, imageThumbnail: _thumbnail, ...fields } = form;
    const payload = {
      ...fields,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || 'General',
      assignedUsers: form.assignedUsers,
      dueDate: form.dueDate || null,
      ...taskImagePayload(form, editing),
    };
    try {
      const task = editing ? await taskService.update(id, payload) : await taskService.create(payload);
      dispatchTaskChanged(task, { source: editing ? 'task-editor' : 'task-created' });
      toast({ title: editing ? 'Task updated successfully.' : 'Task created successfully.', description: task.title });
      navigate(`/tasks/${task._id}`, { replace: true });
    } catch (requestError) { setError(getMessage(requestError, 'Unable to save this task.')); }
    finally { setSaving(false); }
  };

  const handleEditorKeyDown = (event) => {
    if (event.key !== 'Enter' || event.target?.id !== 'new-subtask-title') return;
    event.preventDefault();
    event.stopPropagation();
    event.target.closest('.subtask-add-form')?.querySelector('button[type="button"]')?.click();
  };

  if (loadError) return <LoadError message={loadError} onRetry={() => setRetry((value) => value + 1)} backTo="/tasks" backLabel="Back to tasks" />;
  if (loading || (editing && loadedId !== id)) return <div className="page-loading" role="status"><span className="spin-inline" />Loading task details</div>;
  return <>
    <UnsavedChanges dirty={JSON.stringify(form) !== baseline && !saving} />
    <PageHeader eyebrow={editing ? 'TASK DETAILS' : 'NEW WORK'} title={editing ? 'Edit task' : 'Create a task'} description={editing ? 'Keep the details current as work evolves.' : 'Give this piece of work a clear next step.'} actions={<Link className="button button-secondary" to={editing ? `/tasks/${id}` : '/tasks'}><ArrowLeft size={15} />Cancel</Link>} />
    <form className="editor-layout" onSubmit={submit} onKeyDownCapture={handleEditorKeyDown}>
      <section className="form-panel">
        <div className="form-section-title"><span className="form-step">01</span><div><h2>Task details</h2><p>Start with a clear title and a little context.</p></div></div>
        <div className="field"><label htmlFor="task-title">Title <span className="required-mark">*</span></label><input id="task-title" className={`input ${titleError ? 'input-error' : ''}`} autoFocus maxLength={180} value={form.title} onChange={update('title')} placeholder="What needs to get done?" aria-invalid={Boolean(titleError)} aria-describedby={titleError ? 'task-title-error' : undefined} /><div className="field-meta">{titleError ? <span id="task-title-error" className="field-error">{titleError}</span> : <span className="field-hint">Keep it specific and easy to scan.</span>}<span className="character-count">{form.title.length}/180</span></div></div>
        <TextAreaField label="Description" name="description" rows={5} maxLength={5000} value={form.description} onChange={update('description')} placeholder="Add context, links, or a definition of done…" />
        <SubtaskChecklist items={form.subtasks} onChange={updateSubtasks} editable disabled={saving} />
        <div className="form-grid-two">
          <SelectField label="Priority" value={form.priority} onChange={update('priority')}><option>Low</option><option>Medium</option><option>High</option></SelectField>
          <SelectField label="Status" value={form.status} onChange={update('status')}><option>Pending</option><option>In Progress</option><option>Completed</option></SelectField>
          <div className="field"><label htmlFor="category">Category</label><input id="category" className="input" maxLength={80} value={form.category} onChange={update('category')} placeholder="e.g. Product, Operations" /></div>
          <div className="field"><label htmlFor="dueDate">Due date</label><div className="due-date-control"><div className="date-input-wrap"><input id="dueDate" className="input" type="date" value={form.dueDate} onChange={update('dueDate')} /><CalendarDays size={16} aria-hidden="true" /></div>{form.dueDate && <button type="button" className="date-clear-button" onClick={() => setForm((current) => ({ ...current, dueDate: '' }))} disabled={saving} aria-label="Clear due date">Clear</button>}</div></div>
        </div>
        <AssigneeMultiSelect users={users} value={form.assignedUsers} onChange={(assignedUsers) => setForm((current) => ({ ...current, assignedUsers }))} currentUserId={user?._id} disabled={saving} />
        <TaskImagePicker imageUrl={form.imageUrl} imageThumbnail={form.imageThumbnail} onChange={(image) => setForm((current) => ({ ...current, ...image }))} disabled={saving} />
        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="form-actions"><span className="form-required-note"><span className="required-mark">*</span> Required</span><Button type="submit" loading={saving} icon={Save}>{editing ? 'Save changes' : 'Create task'}</Button></div>
      </section>
      <aside className="editor-aside"><div className="aside-note-index">TASKFLOW / GUIDE</div><h3>Good tasks have a clear owner and a clear finish line.</h3><p>Set a due date when timing matters. Add one or more teammates and a reference image when they help clarify the work.</p><div className="aside-rule" /><div className="aside-note-meta"><span>PRIORITY</span><span>Low · Medium · High</span></div><div className="aside-note-meta"><span>STATUS</span><span>Pending · In progress · Complete</span></div></aside>
    </form>
  </>;
}
