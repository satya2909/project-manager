import nodemailer from "nodemailer";

// ─── Transporter ──────────────────────────────────────────────────────────────
// Single transporter instance, reused across all email sends.
// Config is driven entirely by environment variables so it works with any
// SMTP provider (Gmail, SendGrid, Mailtrap, Resend, etc.)

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === "465", // true for port 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// ─── Shared HTML Shell ────────────────────────────────────────────────────────
// Wraps any email body in a consistent branded template.
const htmlShell = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #0d0f0e; font-family: 'DM Mono', 'Courier New', monospace; color: #c8c8c8; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #1a1d1c; border: 1px solid #2a2e2c; border-radius: 8px; overflow: hidden; }
    .header { background: #111413; padding: 24px 32px; border-bottom: 1px solid #2a2e2c; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.08em; color: #2ecc71; }
    .header span { color: #556b5e; font-size: 12px; }
    .body { padding: 32px; }
    .body p { line-height: 1.7; margin: 0 0 16px; font-size: 14px; color: #a0a8a3; }
    .cta { display: inline-block; margin: 24px 0; padding: 12px 28px; background: #2ecc71; color: #0d0f0e !important; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 14px; letter-spacing: 0.04em; }
    .token-box { background: #111413; border: 1px solid #2a2e2c; border-radius: 4px; padding: 12px 16px; font-size: 13px; color: #2ecc71; letter-spacing: 0.1em; word-break: break-all; margin: 16px 0; }
    .footer { padding: 20px 32px; border-top: 1px solid #2a2e2c; font-size: 11px; color: #445048; line-height: 1.6; }
    .footer a { color: #556b5e; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>PROJECT CAMP</h1>
      <span>Project management, mission critical</span>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      This email was sent by Project Camp. If you did not request this, you can safely ignore it.<br/>
      &copy; ${new Date().getFullYear()} Project Camp. All rights reserved.
    </div>
  </div>
</body>
</html>
`;

// ─── Email Templates ──────────────────────────────────────────────────────────

const templates = {
  emailVerification: (username, verificationUrl) => ({
    subject: "Verify your Project Camp account",
    html: htmlShell(`
          <p>Hello <strong style="color:#e8e8e8">${username}</strong>,</p>
          <p>Welcome to Project Camp. Verify your email address to activate your account and start collaborating.</p>
          <a href="${verificationUrl}" class="cta">VERIFY EMAIL</a>
          <p>Or copy this link into your browser:</p>
          <div class="token-box">${verificationUrl}</div>
          <p>This link expires in <strong style="color:#f59e0b">20 minutes</strong>.</p>
        `),
  }),

  passwordReset: (username, resetUrl) => ({
    subject: "Reset your Project Camp password",
    html: htmlShell(`
          <p>Hello <strong style="color:#e8e8e8">${username}</strong>,</p>
          <p>We received a request to reset your password. Click the button below to set a new one.</p>
          <a href="${resetUrl}" class="cta">RESET PASSWORD</a>
          <p>Or copy this link into your browser:</p>
          <div class="token-box">${resetUrl}</div>
          <p>This link expires in <strong style="color:#f59e0b">20 minutes</strong>. If you did not request a password reset, no action is required.</p>
        `),
  }),

  projectInvite: (username, projectName, inviterName, dashboardUrl) => ({
    subject: `You've been added to "${projectName}" on Project Camp`,
    html: htmlShell(`
          <p>Hello <strong style="color:#e8e8e8">${username}</strong>,</p>
          <p><strong style="color:#e8e8e8">${inviterName}</strong> has added you to the project <strong style="color:#2ecc71">${projectName}</strong> on Project Camp.</p>
          <p>Head to your dashboard to start collaborating.</p>
          <a href="${dashboardUrl}" class="cta">OPEN PROJECT</a>
        `),
  }),
};

// ─── sendEmail ────────────────────────────────────────────────────────────────
// Core send function. All template helpers call this.
// Fails silently (logs error) in development so a missing SMTP config
// doesn't break registration/testing. Throws in production.

const sendEmail = async ({ to, subject, html }) => {
  const transporter = createTransporter();
  try {
    const info = await transporter.sendMail({
      from: `"Project Camp" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to} — messageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error.message);
    if (process.env.NODE_ENV === "production") throw error;
    // In dev/test, swallow the error so missing SMTP doesn't break flows
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (
  to,
  username,
  verificationToken,
) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;
  const { subject, html } = templates.emailVerification(
    username,
    verificationUrl,
  );
  return sendEmail({ to, subject, html });
};

export const sendPasswordResetEmail = async (to, username, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  const { subject, html } = templates.passwordReset(username, resetUrl);
  return sendEmail({ to, subject, html });
};

export const sendProjectInviteEmail = async (
  to,
  username,
  projectName,
  inviterName,
) => {
  const dashboardUrl = `${process.env.CLIENT_URL}/dashboard`;
  const { subject, html } = templates.projectInvite(
    username,
    projectName,
    inviterName,
    dashboardUrl,
  );
  return sendEmail({ to, subject, html });
};
