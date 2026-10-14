import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { AuthFlowLayout, CodeForm, readChallenge, saveChallenge } from '../../components/common/EmailVerification';
import { Button } from '../../components/common/Primitives';
import api, { getMessage } from '../../services/api';
import { newPasswordError } from '../../utils/passwordValidation';

const KEY = 'taskflow:recovery-challenge';
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(() => readChallenge(KEY));
  const [step, setStep] = useState(() => readChallenge(KEY) ? 'code' : 'email');
  const [email, setEmail] = useState('');
  const [grant, setGrant] = useState(null);
  const [password, setPassword] = useState({ newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const run = async (operation) => {
    if (loading) return;
    setLoading(true); setError('');
    try { await operation(); }
    catch (problem) {
      setError(getMessage(problem, 'Unable to continue. Please try again.'));
      const delay = Number(problem.response?.data?.details?.retryAfterSeconds || problem.response?.headers?.['retry-after']);
      if (Number.isFinite(delay) && delay > 0) setRetryAt(Date.now() + delay * 1000);
    } finally { setLoading(false); }
  };
  const startAgain = () => { setChallenge(null); setGrant(null); setPassword({ newPassword: '', confirmPassword: '' }); setStep('email'); setError(''); saveChallenge(KEY, null); };
  const title = { email: 'Forgot your password?', code: 'Check your email.', password: 'Create a new password.', success: 'You’re ready to sign in.' }[step];
  return <AuthFlowLayout title={title} description={step === 'success' ? 'Your password has been reset. Previous sessions are now signed out.' : 'Recover access to your existing Taskflow account.'}>
    {step === 'email' && <form className="auth-form" noValidate onSubmit={(event) => {
      event.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); document.getElementById('recovery-email')?.focus(); return; }
      run(async () => { const { data } = await api.post('/auth/forgot-password', { email: email.trim() }); setChallenge(data.data); saveChallenge(KEY, data.data); setStep('code'); });
    }}>
      <div className="field"><label htmlFor="recovery-email">Email address</label><input id="recovery-email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} disabled={loading} aria-describedby="recovery-note" autoFocus /><span id="recovery-note" className="field-hint">If an eligible account exists, we’ll email a recovery code.</span></div>
      {error && <div className="form-alert" role="alert">{error}</div>}<Button type="submit" loading={loading} className="auth-submit">Send recovery code</Button>
    </form>}
    {step === 'code' && <CodeForm challenge={challenge} recovery loading={loading} error={error} retryAt={retryAt} onError={() => setError('')}
      onVerify={(code) => run(async () => { const { data } = await api.post('/auth/forgot-password/verify', { challengeId: challenge.challengeId, code }); setGrant(data.data); setStep('password'); saveChallenge(KEY, null); })}
      onResend={() => run(async () => { const { data } = await api.post('/auth/forgot-password/resend', { challengeId: challenge.challengeId }); setChallenge(data.data); saveChallenge(KEY, data.data); setRetryAt(0); })} />}
    {step === 'password' && <form className="auth-form" noValidate onSubmit={(event) => {
      event.preventDefault();
      const invalid = newPasswordError(password.newPassword) || (password.newPassword !== password.confirmPassword ? 'Passwords do not match.' : '');
      if (invalid) { setError(invalid); document.getElementById('reset-newPassword')?.focus(); return; }
      run(async () => { await api.post('/auth/reset-password', { challengeId: challenge.challengeId, resetToken: grant.resetToken, ...password }); setGrant(null); setPassword({ newPassword: '', confirmPassword: '' }); setStep('success'); navigate('/login', { replace: true, state: { passwordReset: true } }); });
    }}>
      {['newPassword', 'confirmPassword'].map((key) => <div className="field" key={key}><label htmlFor={`reset-${key}`}>{key === 'newPassword' ? 'New password' : 'Confirm new password'}</label><div className="password-wrap"><input id={`reset-${key}`} className="input" type={visible[key] ? 'text' : 'password'} autoComplete="new-password" autoFocus={key === 'newPassword'} value={password[key]} disabled={loading} onChange={(event) => { setPassword((current) => ({ ...current, [key]: event.target.value })); setError(''); }} /><button className="password-toggle" type="button" aria-label={`${visible[key] ? 'Hide' : 'Show'} ${key === 'newPassword' ? 'new password' : 'password confirmation'}`} onClick={() => setVisible((current) => ({ ...current, [key]: !current[key] }))}>{visible[key] ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{key === 'newPassword' && <span className="field-hint">At least 8 characters with a letter and a number.</span>}</div>)}
      {error && <div className="form-alert" role="alert">{error}</div>}<Button type="submit" className="auth-submit" loading={loading}>Reset password</Button><p className="field-hint">Reset authorization expires five minutes after code verification. If it expires, start again.</p>
    </form>}
    {step === 'success' ? <Link className="button button-primary auth-submit" to="/login" state={{ passwordReset: true }}>Continue to sign in</Link> : <p className="auth-footnote">{step !== 'email' && <><button type="button" className="text-button" onClick={startAgain} disabled={loading}>Start again</button> · </>}<Link to="/login">Back to sign in</Link></p>}
  </AuthFlowLayout>;
}
