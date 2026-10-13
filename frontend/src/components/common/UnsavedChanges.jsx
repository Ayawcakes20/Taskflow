import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from './Primitives';

export function navigateWithDraftGuard(navigate, to) {
  const event = new CustomEvent('taskflow:leave-draft', { cancelable: true, detail: { to } });
  if (window.dispatchEvent(event)) navigate(to);
}

export function signOutWithDraftGuard(action) {
  const event = new CustomEvent('taskflow:leave-draft', { cancelable: true, detail: { action } });
  if (window.dispatchEvent(event)) action();
}

// Guard ordinary in-app links without replacing the existing BrowserRouter.
// Reload/closing the tab uses the browser's own beforeunload confirmation.
export default function UnsavedChanges({ dirty }) {
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
    const navigation = (event) => {
      if (typeof event.detail.action === 'function') {
        event.preventDefault(); setDestination({ action: event.detail.action });
        return;
      }
      const url = new URL(event.detail.to, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      event.preventDefault(); setDestination({ to: url.pathname + url.search + url.hash });
    };
    const click = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination({ to: url.pathname + url.search + url.hash });
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('taskflow:leave-draft', navigation);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('taskflow:leave-draft', navigation); document.removeEventListener('click', click, true); };
  }, [dirty]);
  return <ConfirmDialog open={Boolean(destination)} title="Leave without saving?" description="Your unsaved changes will be lost." confirmLabel={destination?.action ? 'Sign out' : 'Leave page'} cancelLabel="Keep editing" destructive={false} onClose={() => setDestination(null)} onConfirm={() => { const next = destination; setDestination(null); if (next?.action) next.action(); else if (next?.to) navigate(next.to); }} />;
}
