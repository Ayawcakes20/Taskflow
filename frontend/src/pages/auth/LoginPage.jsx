import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMessage } from '../../services/api';
import WorkspacePreview from '../../components/common/WorkspacePreview';

function Brand() { return <Link to="/" className="auth-brand"><span className="brand-mark"><span /><span /><span /></span><span>taskflow</span></Link>; }

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const invalid = { ...(!form.identifier.trim() && { identifier: 'Enter your email or username.' }), ...(!form.password && { password: 'Enter your password.' }) };
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) { setError('Enter your email or username and password.'); document.getElementById(Object.keys(invalid)[0])?.focus(); return; }
    setLoading(true);
    try { await login(form); navigate(location.state?.from || '/dashboard', { replace: true }); }
    catch (requestError) { setError(getMessage(requestError, 'Invalid email or password.')); }
    finally { setLoading(false); }
  };

  return <main className="auth-screen">
    <section className="auth-panel">
      <Brand />
      {location.state?.passwordReset && <p className="inline-success" role="status">Password reset successfully. Sign in with your new password.</p>}
      <div className="auth-copy"><span className="eyebrow">YOUR WORKSPACE</span><h1>Good work starts<br />with a clear view.</h1><p>Sign in to pick up where your team left off.</p></div>
      <form className="auth-form" onSubmit={submit} aria-describedby={error ? 'auth-error' : undefined} noValidate>
        <div className="field"><label htmlFor="identifier">Email or username</label><input id="identifier" className={`input ${fieldErrors.identifier ? 'input-error' : ''}`} aria-invalid={Boolean(fieldErrors.identifier)} aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined} autoComplete="username" autoFocus value={form.identifier} onChange={(event) => { setForm({ ...form, identifier: event.target.value }); setFieldErrors((current) => ({ ...current, identifier: '' })); setError(''); }} placeholder="you@example.com" />{fieldErrors.identifier && <span id="identifier-error" className="field-error">{fieldErrors.identifier}</span>}</div>
        <div className="field"><div className="label-row"><label htmlFor="password">Password</label></div><div className="password-wrap"><input id="password" className={`input ${fieldErrors.password ? "input-error" : ""}`} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(event) => { setForm({ ...form, password: event.target.value }); setFieldErrors((current) => ({ ...current, password: "" })); setError(''); }} placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{fieldErrors.password && <span id="password-error" className="field-error">{fieldErrors.password}</span>}</div>
        {error && <div id="auth-error" className="form-alert" role="alert">{error}</div>}
        <button type="submit" className="button button-primary auth-submit" disabled={loading}>{loading ? <span className="spin-inline" /> : <>Sign in <ArrowRight size={16} /></>}</button>
      </form>
      <p className="auth-footnote">New to Taskflow? <Link to="/register">Create an account</Link></p>
      <p className="auth-footnote"><Link to="/forgot-password">Forgot password?</Link></p>
      <div className="auth-bottom"><span>Secure sign in</span><span>·</span><span>Built for focused work</span></div>
    </section>
    <aside className="auth-aside" aria-label="Product overview"><div className="auth-aside-content"><span className="aside-index">YOUR WORK. CONNECTED.</span><div className="auth-product-story"><h2>A clear view.<br />A confident next step.</h2><p>Tasks, teamwork, and progress in one place.</p><WorkspacePreview /></div><div className="aside-footer"><span>Clear work, steady progress.</span><Link to="/">Explore Taskflow →</Link></div></div></aside>
  </main>;
}
