import { Link } from 'react-router-dom';
import { AuthFlowLayout } from '../../components/common/EmailVerification';

// Temporary defense-day rollback. Recovery stays disabled rather than bypassing OTP.
export default function ForgotPasswordPage() {
  return <AuthFlowLayout title="Password recovery is temporarily unavailable." description="Please contact an administrator for help accessing your account.">
    <p role="status">Email-based password recovery is paused. You can still sign in with your existing password.</p>
    <Link className="button button-primary auth-submit" to="/login">Back to sign in</Link>
  </AuthFlowLayout>;
}
