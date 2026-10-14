import { ApiError } from '../middleware/errorMiddleware.js';
import nodemailer from 'nodemailer';

function smtpCredentials() {
  return { user: process.env.SMTP_USER?.trim() || '', pass: process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '') || '' };
}

export function assertEmailConfigured() {
  const { user, pass } = smtpCredentials();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(user) || !/^[A-Za-z0-9]{16}$/.test(pass)) {
    throw new ApiError(503, 'Email verification is not configured. Please try again later.');
  }
}

function smtpDiagnostic(error) {
  const categories = { EAUTH: 'authentication', ETIMEDOUT: 'timeout', EDNS: 'dns', ECONNECTION: 'connection',
    ESOCKET: 'connection', ECONNRESET: 'connection', ECONNREFUSED: 'connection', EENVELOPE: 'recipient', EMESSAGE: 'message' };
  return { category: Object.hasOwn(categories, error?.code) ? categories[error.code] : 'smtp',
    ...(Number.isInteger(error?.responseCode) && error.responseCode >= 100 && error.responseCode <= 599 ? { responseCode: error.responseCode } : {}) };
}

export function otpEmailTemplate(code, purpose) {
  const action = purpose === 'registration' ? 'Verify your email' : 'Reset your password';
  const text = `Taskflow — ${action}\n\nYour verification code is ${code}.\nIt expires in five minutes. Never share this code.\nIf you did not request this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#173b34;max-width:480px;margin:auto;padding:32px"><strong style="color:#147d6d;font-size:24px">taskflow</strong><h1 style="font-size:22px">${action}</h1><p>Enter this code in Taskflow to continue:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#147d6d">${code}</p><p>This code expires in <strong>five minutes</strong>. Never share it with anyone.</p><p style="color:#58695e;font-size:13px">If you did not request this, ignore this email.</p></div>`;
  return { subject: `Taskflow — ${action}`, text, html };
}

export const emailDelivery = {
  assertConfigured: assertEmailConfigured,
  async send({ email, code, purpose }) {
    assertEmailConfigured();
    try {
      const auth = smtpCredentials();
      // One awaited SMTP connection per email; no pool or background retries on Vercel.
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true, auth,
        connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
        pool: false, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
      });
      const result = await transport.sendMail({ from: { name: 'Taskflow', address: auth.user }, to: email, ...otpEmailTemplate(code, purpose) });
      if (!result?.accepted?.some((address) => typeof address === 'string' && address.toLowerCase() === email.toLowerCase())) {
        throw Object.assign(new Error('SMTP did not accept the recipient'), { code: 'EENVELOPE' });
      }
    } catch (error) {
      // Never log the Error itself: SMTP responses can include addresses or AUTH data.
      console.error('Taskflow OTP SMTP delivery failed.', smtpDiagnostic(error));
      throw new ApiError(503, 'Email delivery is temporarily unavailable. Please try again shortly.');
    }
  },
};
