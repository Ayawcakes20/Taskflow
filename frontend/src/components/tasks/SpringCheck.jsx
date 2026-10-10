import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export default function SpringCheck({ checked, defaultChecked = false, onChange, disabled = false, label = 'Mark task complete', size = 20, checkedColor = 'var(--brand)', uncheckedColor = 'var(--line-strong)', bounce = true, strikeThrough = false, children, className = '' }) {
  const [internal, setInternal] = useState(defaultChecked);
  const controlled = checked !== undefined;
  const isChecked = controlled ? Boolean(checked) : internal;
  const reduced = useReducedMotion();
  const toggle = () => {
    if (disabled) return;
    const next = !isChecked;
    if (!controlled) setInternal(next);
    onChange?.(next);
  };
  return <>
    <motion.button type="button" className={`spring-check ${isChecked ? 'is-checked' : ''} ${className}`} role="checkbox" aria-checked={isChecked} aria-label={label} disabled={disabled}
      style={{ width: size, height: size, flex: `0 0 ${size}px` }}
      onClick={(event) => { event.preventDefault(); toggle(); }}
      whileTap={disabled || reduced || !bounce ? undefined : { scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 520, damping: 27 }}>
      <motion.span className="spring-check-box" style={{ width: size, height: size }} animate={{ backgroundColor: isChecked ? checkedColor : 'transparent', borderColor: isChecked ? checkedColor : uncheckedColor, scale: isChecked && !reduced ? [1, 1.08, 1] : 1 }} transition={{ type: 'spring', stiffness: 420, damping: 23 }}>
        <svg width={Math.max(10, size - 5)} height={Math.max(10, size - 5)} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <motion.path d="M3.2 8.2 6.4 11.2 12.8 4.8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            initial={false} animate={{ pathLength: isChecked ? 1 : 0, opacity: isChecked ? 1 : 0 }} transition={{ duration: reduced ? 0 : 0.2, type: 'spring', stiffness: 240, damping: 22 }} />
        </svg>
      </motion.span>
    </motion.button>
    {children && <span className={`spring-check-label ${isChecked && strikeThrough ? 'is-struck' : ''}`}>{children}</span>}
  </>;
}
