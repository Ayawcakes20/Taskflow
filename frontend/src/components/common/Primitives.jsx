import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, LoaderCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';

export function useDialogFocus(open, dialogRef, onClose, allowEscape = true) {
  const closeRef = useRef(onClose);
  const allowEscapeRef = useRef(allowEscape);
  closeRef.current = onClose;
  allowEscapeRef.current = allowEscape;
  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const selectors = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const getFocusable = () => [...(dialog?.querySelectorAll(selectors) || [])].filter((element) => element.getClientRects().length > 0);
    const initial = dialog?.querySelector('[data-dialog-autofocus]') || getFocusable()[0];
    const focusFrame = window.requestAnimationFrame(() => (initial || dialog)?.focus({ preventScroll: true }));
    const onKey = (event) => {
      if (event.key === 'Escape' && allowEscapeRef.current) { event.preventDefault(); closeRef.current?.(); return; }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKey);
      window.setTimeout(() => { if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); }, 0);
    };
  }, [open, dialogRef]);
}

export function Button({ children, variant = 'primary', size = 'md', icon: Icon, loading = false, className = '', type = 'button', ...props }) {
  return <button type={type} className={`button button-${variant} button-${size} ${className}`} {...props} disabled={props.disabled || loading} aria-busy={loading || undefined}>
    {loading ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
    <span>{children}</span>
  </button>;
}

export function IconButton({ label, children, className = '', ...props }) {
  return <button type="button" className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

export function PageHeader({ eyebrow, title, description, actions, back }) {
  return <div className="page-header">
    <div className="page-heading">
      {back && <button type="button" className="text-button page-back" onClick={back}>Back</button>}
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>;
}

export function Avatar({ user, size = 'md' }) {
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';
  return user?.profileImage
    ? <img className={`avatar avatar-${size}`} src={user.profileImage} alt={`${user.firstName || 'User'} profile`} />
    : <span className={`avatar avatar-${size}`} aria-label={`${user?.firstName || 'User'} ${user?.lastName || ''}`.trim()}>{initials}</span>;
}

export function StatusBadge({ status }) {
  const key = (status || 'Pending').toLowerCase().replaceAll(' ', '-');
  return <span className={`status-badge status-${key}`}><span className="status-dot" />{status || 'Pending'}</span>;
}

export function PriorityBadge({ priority }) {
  const key = (priority || 'Medium').toLowerCase();
  return <span className={`priority-label priority-${key}`}><span className="priority-mark" aria-hidden="true" />{priority || 'Medium'}</span>;
}

export function Skeleton({ className = '' }) { return <span className={`skeleton ${className}`} aria-hidden="true" />; }

export function EmptyState({ icon: Icon, title, description, action }) {
  return <div className="empty-state">
    <div className="empty-icon">{Icon && <Icon size={20} strokeWidth={1.7} aria-hidden="true" />}</div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action}
  </div>;
}

export function LoadError({ message, onRetry, backTo, backLabel = 'Back' }) {
  return <section className="surface-card load-error" role="alert"><AlertTriangle size={24} aria-hidden="true" /><h2>Unable to load this page</h2><p>{message}</p><div className="page-actions"><Button onClick={onRetry}>Try again</Button>{backTo && <Link className="button button-secondary" to={backTo}>{backLabel}</Link>}</div></section>;
}

export function Field({ label, error, hint, className = '', id, ...props }) {
  const fieldId = id || `field-${props.name || label?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <div className={`field ${className}`}>
    {label && <label htmlFor={fieldId}>{label}{props.required && <span className="required-mark"> *</span>}</label>}
    <input id={fieldId} className={error ? 'input input-error' : 'input'} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined} {...props} />
    {error && <span id={`${fieldId}-error`} className="field-error">{error}</span>}
    {!error && hint && <span id={`${fieldId}-hint`} className="field-hint">{hint}</span>}
  </div>;
}

export function TextAreaField({ label, error, className = '', id, ...props }) {
  const fieldId = id || `field-${props.name || label?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <div className={`field ${className}`}>
    {label && <label htmlFor={fieldId}>{label}{props.required && <span className="required-mark"> *</span>}</label>}
    <textarea id={fieldId} className={error ? 'input textarea input-error' : 'input textarea'} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : undefined} {...props} />
    {error && <span id={`${fieldId}-error`} className="field-error">{error}</span>}
  </div>;
}

export function SelectField({ label, children, className = '', id, ...props }) {
  const fieldId = id || `field-${props.name || label?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return <div className={`field ${className}`}>
    {label && <label htmlFor={fieldId}>{label}</label>}
    <select id={fieldId} className="input select-input" {...props}>{children}</select>
  </div>;
}

export function ConfirmDialog({ open, title, description, confirmLabel = 'Delete', cancelLabel = 'Cancel', destructive = true, loading = false, onConfirm, onClose }) {
  const reduced = useReducedMotion();
  const dialogRef = useRef(null);
  const close = () => { if (!loading) onClose?.(); };
  useDialogFocus(open, dialogRef, close, !loading);
  return <AnimatePresence>
    {open && <motion.div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0.12 : 0.18 }}>
      <motion.section ref={dialogRef} tabIndex={-1} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: reduced ? 0.12 : 0.2 }}>
        <div className="dialog-icon">{destructive ? <AlertTriangle size={20} /> : <Check size={20} />}</div>
        <div className="dialog-copy"><h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p></div>
        <div className="dialog-actions">
          <Button data-dialog-autofocus variant="secondary" onClick={close} disabled={loading}>{cancelLabel}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
        <IconButton className="dialog-close" label="Close dialog" onClick={close} disabled={loading}><X size={17} /></IconButton>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
