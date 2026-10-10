import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';

export default function SubtaskChecklist({ items = [], onChange, editable = false, disabled = false }) {
  const [draft, setDraft] = useState('');
  const list = Array.isArray(items) ? items : [];
  const completed = list.filter((item) => item.completed === true).length;
  const percent = list.length ? Math.round((completed / list.length) * 100) : null;

  const patch = (index, changes) => onChange(list.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  const add = () => {
    const title = draft.trim();
    if (!title || disabled) return;
    onChange([...list, { title, completed: false }]);
    setDraft('');
  };
  const remove = (index) => onChange(list.filter((_, itemIndex) => itemIndex !== index));
  const move = (index, offset) => {
    const destination = index + offset;
    if (destination < 0 || destination >= list.length) return;
    const next = [...list];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  };

  return <section className={`subtask-panel ${editable ? 'is-editable' : ''}`} aria-labelledby="subtask-heading">
    <div className="subtask-panel-header"><div><span className="section-label">PROGRESS</span><h2 id="subtask-heading">Subtasks</h2></div>{percent !== null && <span className="subtask-percent">{percent}%</span>}</div>
    {editable && <div className="subtask-add-form"><label className="visually-hidden" htmlFor="new-subtask-title">Enter a subtask</label><input id="new-subtask-title" className="input" maxLength={200} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder="Enter subtask…" disabled={disabled} /><button type="button" className="button button-secondary button-sm" disabled={disabled || !draft.trim()} onClick={add}><Plus size={14} />Add</button></div>}
    {list.length ? <>
      <div className="subtask-list" aria-label={`${completed} of ${list.length} subtasks complete`}>
        {list.map((item, index) => <div className={`subtask-item ${item.completed ? 'is-complete' : ''}`} key={item._id || `new-${index}`}>
          <input type="checkbox" checked={item.completed === true} disabled={disabled} aria-label={`${item.completed ? 'Uncheck' : 'Complete'} ${item.title || 'subtask'}`} onChange={(event) => patch(index, { completed: event.target.checked })} />
          {editable ? <input className="subtask-title-input" aria-label={`Subtask ${index + 1} title`} maxLength={200} value={item.title} onChange={(event) => patch(index, { title: event.target.value })} disabled={disabled} /> : <span className="subtask-title">{item.title}</span>}
          {editable && <span className="subtask-row-actions"><button type="button" className="icon-button" aria-label={`Move ${item.title || `subtask ${index + 1}`} up`} title="Move up" disabled={disabled || index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button type="button" className="icon-button" aria-label={`Move ${item.title || `subtask ${index + 1}`} down`} title="Move down" disabled={disabled || index === list.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button type="button" className="icon-button subtask-remove" aria-label={`Delete ${item.title || `subtask ${index + 1}`}`} title="Delete subtask" disabled={disabled} onClick={() => remove(index)}><Trash2 size={14} /></button></span>}
          {item.completed && <Check className="subtask-done-mark" size={14} aria-hidden="true" />}
        </div>)}
      </div>
      <div className="subtask-progress-copy"><span>{completed} / {list.length} completed — {percent}%</span></div>
      <div className="subtask-progress-track" role="progressbar" aria-label="Subtask completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
    </> : <div className="subtask-empty"><span>{editable ? 'No subtasks yet.' : 'No subtasks'}</span></div>}
  </section>;
}
