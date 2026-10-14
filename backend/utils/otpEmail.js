import { ApiError } from '../middleware/errorMiddleware.js';

export function assertEmailConfigured() {
  if (!process.env.RESEND_API_KEY || !process.env.OTP_EMAIL_FROM || /[\r\n]/.test(process.env.OTP_EMAIL_FROM)) {
    throw new ApiError(503, 'Email verification is not configured. Please try again later.');
  }
}

export function otpEmailTemplate(code, purpose) {
  const action = purpose === 'registration' ? 'Verify your email' : 'Reset your password';
  const text = `Taskflow — ${action}\n\nYour verification code is ${code}.\nIt expires in five minutes. Never share this code.\nIf you did not request this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#173b34;max-width:480px;margin:auto;padding:32px"><strong style="color:#147d6d;font-size:24px">taskflow</strong><h1 style="font-size:22px">${action}</h1><p>Enter this code in Taskflow to continue:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#147d6d">${code}</p><p>This code expires in <strong>five minutes</strong>. Never share it with anyone.</p><p style="color:#58695e;font-size:13px">If you did not request this, ignore this email.</p></div>`;
  return { subject: `Taskflow — ${action}`, text, html };
}

export const emailDelivery = {
  assertConfigured: assertEmailConfigured,
  async send({ email, code, purpose, challengeId }) {
    assertEmailConfigured();
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `taskflow-${challengeId}` },
        body: JSON.stringify({ from: process.env.OTP_EMAIL_FROM, to: [email], ...otpEmailTemplate(code, purpose) }),
      });
      if (!response.ok || !(await response.json()).id) throw new Error('Email not accepted');
    } catch { throw new ApiError(503, 'Email delivery is temporarily unavailable. Please try again shortly.'); }
  },
};
