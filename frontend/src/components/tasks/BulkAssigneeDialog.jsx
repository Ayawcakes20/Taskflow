import { useRef } from 'react';
import { X } from 'lucide-react';
import { Button, useDialogFocus } from '../common/Primitives';
import AssigneeMultiSelect from './AssigneeMultiSelect';

export default function BulkAssigneeDialog({ open, users, value, onChange, onClose, onConfirm, busy = false, taskCount = 0 }) {
  const panel = useRef(null);
  useDialogFocus(open, panel, onClose, !busy);
  if (!open) return null;
  const handleKeyDown = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
  return <div className="bulk-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="bulk-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="bulk-assignment-heading" tabIndex={-1} ref={panel} onKeyDown={handleKeyDown}>
      <div className="bulk-dialog-header"><div><span className="section-label">BULK ACTION</span><h2 id="bulk-assignment-heading">Assign {taskCount} tasks</h2><p>The selected people will replace the current assignees on each task.</p></div><button type="button" data-dialog-autofocus className="icon-button" aria-label="Close assignment dialog" onClick={onClose} disabled={busy}><X size={17} /></button></div>
      <AssigneeMultiSelect users={users} value={value} onChange={onChange} disabled={busy} />
      <div className="bulk-dialog-actions"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={onConfirm} loading={busy}>Apply assignment</Button></div>
    </section>
  </div>;
}
