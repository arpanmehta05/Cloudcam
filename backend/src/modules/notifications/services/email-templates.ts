export const BRAND_NAME = "Cloudwatcher";
export const BRAND_SITE_URL =
  process.env.APP_URL || process.env.FRONTEND_URL || "https://cloudwatcher.rabbitt.ai";
export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || "support@cloudwatcher.ai";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getFromAddress(): string {
  return `"${BRAND_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
}

export function baseTemplate(title: string, previewText: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
    ${escapeHtml(previewText)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;margin:0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbeafe;border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#ffffff 0%,#eff6ff 58%,#fff7ed 100%);border-bottom:1px solid #dbeafe;">
              <p style="margin:0 0 10px;color:#1a56db;font-size:11px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;font-weight:800;">${BRAND_NAME}</p>
              <h1 style="margin:0;color:#0f172a;font-size:26px;line-height:1.2;font-weight:800;">${escapeHtml(title)}</h1>
              <p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.6;">AI observability and cloud cost management for modern teams.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 32px;color:#334155;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
              <p style="margin:0 0 6px;">This email was sent by ${BRAND_NAME} for an account security request.</p>
              <p style="margin:0;">If you did not request this code, you can ignore this email or contact <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#1a56db;text-decoration:none;">${escapeHtml(SUPPORT_EMAIL)}</a>.</p>
              <p style="margin:12px 0 0;">&copy; ${new Date().getFullYear()} ${BRAND_NAME}. <a href="${escapeHtml(BRAND_SITE_URL)}" style="color:#1a56db;text-decoration:none;">${escapeHtml(BRAND_SITE_URL)}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function otpEmailBody(
  name: string | undefined,
  otp: string,
  purpose: string,
  expiryMins: number
): string {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hello,";
  const purposeLabel: Record<string, string> = {
    "email-verify": "verify your email address",
    "password-reset": "reset your password",
    "login-2fa": "complete your sign-in",
  };
  const action = purposeLabel[purpose] ?? "complete your request";
  const escapedOtp = escapeHtml(otp);

  return `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 22px;">Use the verification code below to ${escapeHtml(action)}. The code is valid for ${expiryMins} minutes and can be used once.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:separate;">
      <tr>
        <td align="center" style="padding:24px 18px;background:#eff6ff;border:1px solid #dbeafe;border-radius:14px;">
          <p style="margin:0 0 8px;color:#1e3a8a;font-size:12px;line-height:1.4;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Verification code</p>
          <p style="margin:0;color:#0f172a;font-family:Consolas,Menlo,Monaco,monospace;font-size:36px;line-height:1.1;font-weight:800;letter-spacing:8px;">${escapedOtp}</p>
        </td>
      </tr>
    </table>
    <div style="padding:16px 18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
      <p style="margin:0;color:#7c2d12;font-size:13px;line-height:1.6;">For your security, do not share this code with anyone. ${BRAND_NAME} will never ask for your verification code over chat, phone, or email.</p>
    </div>
    <p style="margin:22px 0 0;color:#64748b;font-size:13px;line-height:1.6;">If you did not start this request, no action is required. The code will expire automatically.</p>`;
}
