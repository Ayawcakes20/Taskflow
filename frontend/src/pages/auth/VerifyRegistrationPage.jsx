import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { getMessage } from '../../services/api';
import { AuthFlowLayout, CodeForm, readChallenge, saveChallenge } from '../../components/common/EmailVerification';

const KEY = 'taskflow:registration-challenge';
export default function VerifyRegistrationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyRegistration } = useAuth();
  const [challenge, setChallenge] = useState(() => {
    const saved = readChallenge(KEY);
    const incoming = location.state?.challenge;
    return saved && (!incoming || Date.parse(saved.resendAt) > Date.parse(incoming.resendAt)) ? saved : incoming || saved;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  useEffect(() => { if (challenge) saveChallenge(KEY, challenge); }, [challenge]);
  const run = async (operation) => {
    if (loading) return;
    setLoading(true); setError('');
    try { await operation(); }
    catch (problem) {
      setError(getMessage(problem, 'Unable to verify your email. Please try again.'));
      const delay = Number(problem.response?.data?.details?.retryAfterSeconds || problem.response?.headers?.['retry-after']);
      if (Number.isFinite(delay) && delay > 0) setRetryAt(Date.now() + delay * 1000);
    } finally { setLoading(false); }
  };
  return <AuthFlowLayout title="Verify your email." description="One quick check before you open your workspace.">
    {challenge ? <CodeForm challenge={challenge} loading={loading} error={error} retryAt={retryAt} onError={() => setError('')}
      onVerify={(code) => run(async () => { await verifyRegistration({ challengeId: challenge.challengeId, code }); saveChallenge(KEY, null); navigate('/dashboard', { replace: true }); })}
      onResend={() => run(async () => { const { data } = await api.post('/auth/register/resend', { challengeId: challenge.challengeId }); setChallenge(data.data); setRetryAt(0); })} />
      : <p role="status">Start registration to receive a verification code.</p>}
    <p className="auth-footnote"><Link to="/register" onClick={() => saveChallenge(KEY, null)}>Back to registration</Link> · <Link to="/login">Sign in</Link></p>
  </AuthFlowLayout>;
}
