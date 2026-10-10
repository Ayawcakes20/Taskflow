import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, UserRound, X } from 'lucide-react';
import { Avatar } from '../common/Primitives';

const fullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Team member';

export default function AssigneeMultiSelect({ users = [], value = [], onChange, disabled = false, currentUserId = '' }) {
  const [query, setQuery] = useState('');
  const selectedIds = new Set(value.map(String));
  const selectedUsers = users.filter((person) => selectedIds.has(String(person._id)));
  const availableIds = users.map((person) => String(person._id));
  const allSelected = availableIds.length > 0 && availableIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && availableIds.some((id) => selectedIds.has(id));
  const selectAllRef = useRef(null);
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected; }, [someSelected]);
  const filteredUsers = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return users.filter((person) => !search || `${fullName(person)} ${person.username || ''} ${person.email || ''}`.toLocaleLowerCase().includes(search));
  }, [query, users]);

  const toggle = (id) => {
    const key = String(id);
    onChange(selectedIds.has(key) ? value.filter((item) => String(item) !== key) : [...value, key]);
  };
  const toggleAll = () => {
    const available = new Set(availableIds);
    const next = allSelected
      ? value.filter((item) => !available.has(String(item)))
      : [...new Set([...value.map(String).filter((id) => !available.has(id)), ...availableIds])];
    onChange(next);
  };
  const remove = (event, id) => {
    event.preventDefault();
    event.stopPropagation();
    toggle(id);
  };

  return <div className="field">
    <div className="assignee-label-row"><label id="task-assignee-label" htmlFor="task-assignee-search">Assigned users</label><span className="field-hint">Optional · select one or more</span></div>
    <div className="assignee-picker">
      <div className="selected-assignees" aria-live="polite">
        {selectedUsers.length ? selectedUsers.map((person) => <span className="assignee-chip" key={person._id}>
          <Avatar user={person} size="xs" /><span>{fullName(person)}</span>
          <button type="button" className="assignee-chip-remove" disabled={disabled} aria-label={`Remove ${fullName(person)}`} onClick={(event) => remove(event, person._id)}><X size={13} /></button>
        </span>) : <span className="assignee-empty"><UserRound size={14} />No assignees selected</span>}
      </div>
      <label className="assignee-search"><Search size={15} aria-hidden="true" /><input id="task-assignee-search" aria-label="Search active users" placeholder="Search team members" value={query} onChange={(event) => setQuery(event.target.value)} disabled={disabled} /><span>{selectedUsers.length} selected</span></label>
      <label className="assignee-select-all"><input ref={selectAllRef} type="checkbox" checked={allSelected} aria-checked={someSelected ? 'mixed' : allSelected} disabled={disabled || users.length === 0} onChange={toggleAll} /><span>Select all available members</span><small>{allSelected ? 'All selected' : `${users.length} available`}</small></label>
      <div className="assignee-options" role="group" aria-labelledby="task-assignee-label">
        {filteredUsers.length ? filteredUsers.map((person) => {
          const selected = selectedIds.has(String(person._id));
          return <button type="button" key={person._id} className={`assignee-option ${selected ? 'is-selected' : ''}`} aria-pressed={selected} disabled={disabled} onClick={() => toggle(person._id)}>
            <Avatar user={person} size="xs" /><span className="assignee-option-copy"><strong>{fullName(person)}</strong><small>{person.username}{person.role === 'Admin' ? ' · Admin' : ''}{String(person._id) === String(currentUserId) ? ' · You' : ''}</small></span>{selected && <Check size={15} aria-hidden="true" />}
          </button>;
        }) : <p className="assignee-empty-results">{users.length ? 'No active users match this search.' : 'No active users are available yet.'}</p>}
      </div>
    </div>
  </div>;
}
