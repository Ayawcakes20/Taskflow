import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMessage } from '../../services/api';

function Brand() { return <Link to="/register" className="auth-brand"><span className="brand-mark"><span /><span /><span /></span><span>taskflow</span></Link>; }

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => [form.password.length >= 8, /[A-Za-z]/.test(form.password) && /[0-9]/.test(form.password), /[^A-Za-z0-9]/.test(form.password)].filter(Boolean).length, [form.password]);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (Object.values(form).some((value) => !value.trim())) { setError('Complete each field to create your account.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Enter a valid email address.'); return; }
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) { setError('Use at least 8 characters with a letter and a number.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try { await register(form); navigate('/dashboard', { replace: true }); }
    catch (requestError) { setError(getMessage(requestError, 'Unable to create your account.')); }
    finally { setLoading(false); }
  };
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return <main className="auth-screen auth-register-screen">
    <section className="auth-panel auth-register-panel">
      <Brand />
      <div className="auth-copy"><span className="eyebrow">A CLEARER WORKDAY</span><h1>Give your work<br />a place to move.</h1><p>Create your workspace account. You can invite teammates later.</p></div>
      <form className="auth-form register-form" onSubmit={submit} noValidate>
        <div className="form-grid-two">
          <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" className="input" autoComplete="given-name" value={form.firstName} onChange={update('firstName')} placeholder="First name" /></div>
          <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" className="input" autoComplete="family-name" value={form.lastName} onChange={update('lastName')} placeholder="Last name" /></div>
        </div>
        <div className="field"><label htmlFor="username">Username</label><input id="username" className="input" autoComplete="username" value={form.username} onChange={update('username')} placeholder="Username" /><span className="field-hint">3–30 characters; letters, numbers, dots, hyphens, or underscores.</span></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@company.com" /></div>
        <div className="field"><label htmlFor="password">Password</label><div className="password-wrap"><input id="password" className="input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={update('password')} placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><div className="strength-meter" aria-label={`Password strength ${strength} of 3`}>{[1, 2, 3].map((step) => <span key={step} className={strength >= step ? `strength-${strength}` : ''} />)}<small>{form.password ? strength === 3 ? 'Strong' : strength === 2 ? 'Getting there' : 'Needs more detail' : 'Use a letter and a number'}</small></div></div>
        <div className="field"><label htmlFor="confirmPassword">Confirm password</label><div className="password-wrap"><input id="confirmPassword" className="input" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Enter your password again" /><button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <button type="submit" className="button button-primary auth-submit" disabled={loading}>{loading ? <span className="spin-inline" /> : <>Create account <ArrowRight size={16} /></>}</button>
      </form>
      <p className="auth-footnote">Already have an account? <Link to="/login">Sign in</Link></p>
      <div className="auth-bottom"><span>Private by design</span><span>·</span><span>Made for steady progress</span></div>
    </section>
    <aside className="auth-aside" aria-label="Product overview"><div className="auth-aside-grid" /><div className="auth-aside-content"><span className="aside-index">02 / FOCUS</span><div className="aside-quote"><span className="quote-line" /><h2>Structure for today.<br />Room for what’s next.</h2><p>Build momentum through small, visible progress.</p></div><div className="aside-footer"><span>Less noise. More momentum.</span><span>TF — 02</span></div></div></aside>
  </main>;
}
