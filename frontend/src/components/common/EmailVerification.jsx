import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './Primitives';
import WorkspacePreview from './WorkspacePreview';

export function AuthFlowLayout({ title, description, children }) {
  return <main className="auth-screen auth-verification-screen"><section className="auth-panel">
    <Link to="/" className="auth-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><span>taskflow</span></Link>
    <div className="auth-copy"><span className="eyebrow">YOUR ACCOUNT</span><h1>{title}</h1><p>{description}</p></div>{children}
    <div className="auth-bottom"><span>Clear work, steady progress.</span></div>
  </section><aside className="auth-aside" aria-label="Product overview"><div className="auth-aside-content"><span className="aside-index">YOUR WORK. CONNECTED.</span><div className="auth-product-story"><h2>A clear view.<br />A confident next step.</h2><p>Tasks, teamwork, and progress in one place.</p><WorkspacePreview /></div></div></aside></main>;
}

export function CodeForm({ challenge, recovery = false, loading, error, onVerify, onResend, onError, retryAt = 0 }) {
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const [invalid, setInvalid] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { setCode(''); setInvalid(''); }, [challenge.challengeId]);
  const remaining = Math.max(0, Math.ceil((Date.parse(challenge.expiresAt) - now) / 1000));
  const cooldown = Math.max(0, Math.ceil((Math.max(Date.parse(challenge.resendAt), retryAt) - now) / 1000));
  const submit = (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setInvalid('Enter the six-digit code from your email.'); document.getElementById('verification-code')?.focus(); return; }
    setInvalid(''); onVerify(code);
  };
  return <>
    <p className="verification-destination">{recovery ? 'If the address belongs to an eligible account, check' : 'Check'} <strong>{challenge.emailHint}</strong> for your code. Check your spam folder too.</p>
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="verification-code">Verification code</label><input id="verification-code" className={`input otp-input ${invalid ? 'input-error' : ''}`} type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={12} value={code} disabled={loading} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setInvalid(''); onError?.(); }} aria-invalid={Boolean(invalid)} aria-describedby="code-guidance code-error" placeholder="6-digit code" />
        <span id="code-guidance" className="field-hint">{remaining ? `Code expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}.` : 'This code has expired. Request a new code below.'}</span>
      </div>
      <div id="code-error">{(invalid || error) && <div className="form-alert" role="alert">{invalid || error}</div>}</div>
      <Button type="submit" loading={loading} disabled={!remaining} className="auth-submit">Verify code</Button>
    </form>
    <div className="verification-resend"><Button variant="secondary" loading={loading} disabled={cooldown > 0} onClick={onResend}>{cooldown ? `Resend in ${cooldown}s` : 'Resend code'}</Button><span className="field-hint">Only the newest code works.</span></div>
  </>;
}

// Only challenge metadata is persisted. Passwords, codes and reset grants stay in memory.
export function readChallenge(key) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key));
    return value && /^[a-f0-9]{64}$/.test(value.challengeId) && typeof value.emailHint === 'string'
      && Number.isFinite(Date.parse(value.expiresAt)) && Number.isFinite(Date.parse(value.resendAt)) ? value : null;
  } catch { return null; }
}
export function saveChallenge(key, challenge) {
  try { if (challenge) sessionStorage.setItem(key, JSON.stringify(challenge)); else sessionStorage.removeItem(key); } catch { /* Storage may be disabled; the in-memory flow still works. */ }
}
