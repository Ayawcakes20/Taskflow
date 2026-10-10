import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const icons = { success: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const reduced = useReducedMotion();
  const dismiss = useCallback((id) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const toast = useCallback((options) => {
    const item = { id: crypto.randomUUID(), title: options.title || '', description: options.description || '', variant: options.variant || 'success' };
    setItems((current) => [...current.slice(-3), item]);
    window.setTimeout(() => dismiss(item.id), options.duration || 4200);
    return item.id;
  }, [dismiss]);
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions text">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = icons[item.variant] || Info;
            return (
              <motion.div key={item.id} className={`toast toast-${item.variant}`} role="status"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduced ? 0 : 8 }} transition={{ duration: reduced ? 0.12 : 0.2 }}>
                <Icon size={18} aria-hidden="true" />
                <div className="toast-copy"><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}</div>
                <button className="icon-button toast-close" aria-label="Dismiss notification" onClick={() => dismiss(item.id)}><X size={15} /></button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider.');
  return value;
}
