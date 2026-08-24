import nodemailer from "nodemailer";
import { Attachment } from "nodemailer/lib/mailer";
import {
  BRAND_NAME,
  SUPPORT_EMAIL,
  escapeHtml,
  getFromAddress,
  baseTemplate,
  otpEmailBody,
} from "./email-templates";

function createTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP configuration is incomplete. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

export interface SendOtpEmailOptions {
  to: string;
  name?: string;
  otp: string;
  purpose?: string;
  expiryMins?: number;
}

export async function sendOtpEmail(opts: SendOtpEmailOptions): Promise<void> {
  const { to, name, otp, purpose = "email-verify", expiryMins = 10 } = opts;

  const subjectMap: Record<string, string> = {
    "email-verify": `Your ${BRAND_NAME} verification code`,
    "password-reset": `Reset your ${BRAND_NAME} password`,
    "login-2fa": `Your ${BRAND_NAME} sign-in code`,
  };
  const subject = subjectMap[purpose] ?? `Your ${BRAND_NAME} one-time code`;
  const previewText = `Your ${BRAND_NAME} verification code expires in ${expiryMins} minutes.`;
  const html = baseTemplate(subject, previewText, otpEmailBody(name, otp, purpose, expiryMins));

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
    text: [
      `${BRAND_NAME} verification code`,
      "",
      `Code: ${otp}`,
      `This code expires in ${expiryMins} minutes and can be used once.`,
      "",
      "If you did not request this code, you can ignore this email.",
    ].join("\n"),
  });
}

export async function sendPasswordChangedEmail(opts: {
  to: string;
  name?: string;
  changedAt?: Date;
}): Promise<void> {
  const changedAt = opts.changedAt || new Date();
  const formattedTime = changedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hello,";
  const subject = `Your ${BRAND_NAME} password was updated`;
  const previewText = `Your ${BRAND_NAME} account password was updated.`;
  const html = baseTemplate(
    subject,
    previewText,
    `
      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 18px;">This is a confirmation that the password for your ${BRAND_NAME} account was updated.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
        <tr>
          <td style="padding:16px 18px;background:#eff6ff;border:1px solid #dbeafe;border-radius:12px;">
            <p style="margin:0 0 6px;color:#1e3a8a;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Change time</p>
            <p style="margin:0;color:#0f172a;font-size:16px;line-height:1.5;font-weight:800;">${escapeHtml(
              formattedTime
            )} UTC</p>
          </td>
        </tr>
      </table>
      <div style="padding:16px 18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
        <p style="margin:0;color:#7c2d12;font-size:13px;line-height:1.6;">If you made this change, no action is needed. If you did not change your password, reset it immediately and contact <a href="mailto:${escapeHtml(
          SUPPORT_EMAIL
        )}" style="color:#1a56db;text-decoration:none;">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>
      </div>`
  );

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: opts.to,
    subject,
    html,
    text: [
      `${BRAND_NAME} password updated`,
      "",
      `Your ${BRAND_NAME} account password was updated at ${formattedTime} UTC.`,
      "",
      `If you made this change, no action is needed. If you did not change your password, reset it immediately and contact ${SUPPORT_EMAIL}.`,
    ].join("\n"),
  });
}

export async function sendDeletionScheduledEmail(opts: {
  to: string;
  name?: string;
  scheduledDeletionAt: Date;
}): Promise<void> {
  const formattedDate = opts.scheduledDeletionAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hello,";
  const subject = `[Action Required] Your ${BRAND_NAME} account is scheduled for deletion`;
  const previewText = `Your ${BRAND_NAME} account will be permanently deleted on ${formattedDate} UTC.`;
  const html = baseTemplate(
    subject,
    previewText,
    `
      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 18px;">We received a request to permanently delete your ${BRAND_NAME} account. This process is now scheduled.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
        <tr>
          <td style="padding:16px 18px;background:#fff5f5;border:1px solid #feb2b2;border-radius:12px;">
            <p style="margin:0 0 6px;color:#c53030;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Permanent Deletion Date</p>
            <p style="margin:0;color:#9b2c2c;font-size:16px;line-height:1.5;font-weight:800;">${escapeHtml(
              formattedDate
            )} UTC</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 18px; line-height:1.6;">If you wish to keep your account, <strong>simply sign in to your account at any time before this date</strong>. Logging in will automatically cancel this deletion request and reactivate your account immediately.</p>
      <div style="padding:16px 18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
        <p style="margin:0;color:#7c2d12;font-size:13px;line-height:1.6;">If you did not request this deletion, please log in immediately to secure your account, change your password, and cancel the deletion schedule.</p>
      </div>`
  );

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: opts.to,
    subject,
    html,
    text: [
      `${BRAND_NAME} account deletion scheduled`,
      "",
      `Your ${BRAND_NAME} account is scheduled to be permanently deleted on ${formattedDate} UTC.`,
      "",
      "If you want to keep your account, log in at any time before this date to automatically cancel the deletion request.",
      "",
      "If you did not request this deletion, log in immediately to secure your account and cancel the deletion schedule.",
    ].join("\n"),
  });
}

export async function sendAccountReactivatedEmail(opts: {
  to: string;
  name?: string;
}): Promise<void> {
  const greeting = opts.name ? `Hi ${escapeHtml(opts.name)},` : "Hello,";
  const subject = `Your ${BRAND_NAME} account has been reactivated`;
  const previewText = `The scheduled deletion for your ${BRAND_NAME} account has been successfully canceled.`;
  const html = baseTemplate(
    subject,
    previewText,
    `
      <p style="margin:0 0 16px;">${greeting}</p>
      <p style="margin:0 0 18px;">Welcome back! We are writing to confirm that the scheduled deletion for your ${BRAND_NAME} account has been canceled.</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:separate;">
        <tr>
          <td style="padding:16px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
            <p style="margin:0 0 6px;color:#15803d;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Account Status</p>
            <p style="margin:0;color:#166534;font-size:16px;line-height:1.5;font-weight:800;">Fully Active</p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 18px; line-height:1.6;">Your account access has been fully restored, and all of your configurations, workspaces, and team memberships remain completely intact.</p>
      <div style="padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;">No further action is required. Thank you for using ${BRAND_NAME}!</p>
      </div>`
  );

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: opts.to,
    subject,
    html,
    text: [
      `${BRAND_NAME} account reactivated`,
      "",
      "The scheduled deletion for your Cloudwatcher account has been successfully canceled.",
      "",
      "Your account is now fully active, and all your data has been retained.",
      "",
      "Thank you for using Cloudwatcher!",
    ].join("\n"),
  });
}



export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
  text?: string;
}): Promise<void> {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    ...opts,
  });
}
