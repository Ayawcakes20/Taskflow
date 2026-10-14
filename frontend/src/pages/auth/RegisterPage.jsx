import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMessage } from '../../services/api';
import WorkspacePreview from '../../components/common/WorkspacePreview';
import { newPasswordError, passwordStrength } from '../../utils/passwordValidation';

function Brand() { return <Link to="/" className="auth-brand"><span className="brand-mark"><span /><span /><span /></span><span>taskflow</span></Link>; }

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const labels = { firstName: 'first name', lastName: 'last name', username: 'username', email: 'email', password: 'password', confirmPassword: 'password confirmation' };
    const invalid = {};
    for (const key of Object.keys(form)) if (!form[key].trim()) invalid[key] = `Enter your ${labels[key]}.`;
    if (form.username && !/^[A-Za-z0-9_.-]{3,30}$/.test(form.username)) invalid.username = 'Use a username of 3–30 letters, numbers, dots, hyphens, or underscores.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) invalid.email = 'Enter a valid email address.';
    if (form.password && newPasswordError(form.password)) invalid.password = newPasswordError(form.password);
    if (form.confirmPassword && form.password !== form.confirmPassword) invalid.confirmPassword = 'Passwords do not match.';
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) { setError(Object.values(invalid)[0]); document.getElementById(Object.keys(invalid)[0])?.focus(); return; }
    setLoading(true);
    try { await register(form); navigate('/dashboard', { replace: true }); }
    catch (requestError) { setError(getMessage(requestError, 'Unable to create your account.')); }
    finally { setLoading(false); }
  };
  const update = (key) => (event) => { setForm((current) => ({ ...current, [key]: event.target.value })); setFieldErrors((current) => ({ ...current, [key]: '' })); setError(''); };
  const inputProps = (key) => ({ className: `input ${fieldErrors[key] ? 'input-error' : ''}`, 'aria-invalid': Boolean(fieldErrors[key]), 'aria-describedby': fieldErrors[key] ? `${key}-error` : ['username', 'password'].includes(key) ? `${key}-hint` : undefined });
  const fieldError = (key) => fieldErrors[key] && <span id={`${key}-error`} className="field-error">{fieldErrors[key]}</span>;

  return <main className="auth-screen auth-register-screen">
    <section className="auth-panel auth-register-panel">
      <Brand />
      <div className="auth-copy"><span className="eyebrow">A CLEARER WORKDAY</span><h1>Give your work<br />a place to move.</h1><p>Create your account and start organizing your work.</p></div>
      <form className="auth-form register-form" onSubmit={submit} aria-describedby={error ? 'auth-error' : undefined} noValidate>
        <div className="form-grid-two">
          <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" {...inputProps("firstName")} autoComplete="given-name" value={form.firstName} onChange={update('firstName')} placeholder="First name" />{fieldError("firstName")}</div>
          <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" {...inputProps("lastName")} autoComplete="family-name" value={form.lastName} onChange={update('lastName')} placeholder="Last name" />{fieldError("lastName")}</div>
        </div>
        <div className="field"><label htmlFor="username">Username</label><input id="username" {...inputProps("username")} autoComplete="username" value={form.username} onChange={update('username')} placeholder="Username" />{fieldError("username")}<span id="username-hint" className="field-hint">3–30 characters; letters, numbers, dots, hyphens, or underscores.</span></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" {...inputProps("email")} type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@example.com" />{fieldError("email")}</div>
        <div className="field"><label htmlFor="password">Password</label><div className="password-wrap"><input id="password" {...inputProps("password")} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={update('password')} placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{fieldError("password")}<span id="password-hint" className="field-hint">At least 8 characters with a letter and a number.</span><div className="strength-meter" aria-label={`Password strength ${strength.score} of 3`}>{[1, 2, 3].map((step) => <span key={step} className={strength.score >= step ? `strength-${strength.score}` : ''} />)}<small>{strength.label}</small></div></div>
        <div className="field"><label htmlFor="confirmPassword">Confirm password</label><div className="password-wrap"><input id="confirmPassword" {...inputProps("confirmPassword")} type={showConfirm ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={update('confirmPassword')} placeholder="Enter your password again" /><button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{fieldError('confirmPassword')}</div>
        {error && <div id="auth-error" className="form-alert" role="alert">{error}</div>}
        <button type="submit" className="button button-primary auth-submit" disabled={loading}>{loading ? <span className="spin-inline" /> : <>Create account <ArrowRight size={16} /></>}</button>
      </form>
      <p className="auth-footnote">Already have an account? <Link to="/login">Sign in</Link></p>
      <div className="auth-bottom"><span>Private by design</span><span>·</span><span>Made for steady progress</span></div>
    </section>
    <aside className="auth-aside" aria-label="Product overview"><div className="auth-aside-content"><span className="aside-index">YOUR WORK. CONNECTED.</span><div className="auth-product-story"><h2>A clear view.<br />A confident next step.</h2><p>Tasks, teamwork, and progress in one place.</p><WorkspacePreview /></div><div className="aside-footer"><span>Clear work, steady progress.</span><Link to="/">Explore Taskflow →</Link></div></div></aside>
  </main>;
}
