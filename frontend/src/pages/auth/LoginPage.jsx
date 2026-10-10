import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMessage } from '../../services/api';

function Brand() { return <Link to="/login" className="auth-brand"><span className="brand-mark"><span /><span /><span /></span><span>taskflow</span></Link>; }

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.identifier.trim() || !form.password) { setError('Enter your email or username and password.'); return; }
    setLoading(true);
    try { await login(form); navigate(location.state?.from || '/dashboard', { replace: true }); }
    catch (requestError) { setError(getMessage(requestError, 'Invalid email or password.')); }
    finally { setLoading(false); }
  };

  return <main className="auth-screen">
    <section className="auth-panel">
      <Brand />
      <div className="auth-copy"><span className="eyebrow">YOUR WORKSPACE</span><h1>Good work starts<br />with a clear view.</h1><p>Sign in to pick up where your team left off.</p></div>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="identifier">Email or username</label><input id="identifier" className="input" autoComplete="username" autoFocus value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} placeholder="you@company.com" /></div>
        <div className="field"><div className="label-row"><label htmlFor="password">Password</label></div><div className="password-wrap"><input id="password" className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <button type="submit" className="button button-primary auth-submit" disabled={loading}>{loading ? <span className="spin-inline" /> : <>Sign in <ArrowRight size={16} /></>}</button>
      </form>
      <p className="auth-footnote">New to Taskflow? <Link to="/register">Create an account</Link></p>
      <div className="auth-bottom"><span>Secure sign in</span><span>·</span><span>Built for focused work</span></div>
    </section>
    <aside className="auth-aside" aria-label="Product overview">
      <div className="auth-aside-grid" />
      <div className="auth-aside-content"><span className="aside-index">01 / WORKSPACE</span><div className="aside-quote"><span className="quote-line" /><h2>Make the next step<br />the obvious one.</h2><p>One considered place for your tasks, priorities, and progress.</p></div><div className="aside-footer"><span>Less noise. More momentum.</span><span>TF — 01</span></div></div>
    </aside>
  </main>;
}
