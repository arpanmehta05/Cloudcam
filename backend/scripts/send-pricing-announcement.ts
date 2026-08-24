import dns from "node:dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { User } from "../src/models/user.model";
import { config } from "../src/core/config";

// Recipient we must exclude/skip
const EXCLUDE_TENANT_ID = "69ba462479ab30b81c33e00e";
const EXCLUDE_EMAIL = "rupeshgurjar946@gmail.com";
const TEST_EMAIL = "arpanmehta05@gmail.com";

const SEND_TO_ALL = true; 

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
      rejectUnauthorized: false,
    },
  });
}

function getEmailHtml(email: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Introducing Pricing Plans at CloudWatcher</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;margin:0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #dbeafe;border-radius:16px;overflow:hidden;box-shadow:0 18px 42px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#ffffff 0%,#eff6ff 58%,#fff7ed 100%);border-bottom:1px solid #dbeafe;">
              <p style="margin:0 0 10px;color:#1a56db;font-size:11px;line-height:1.4;letter-spacing:.16em;text-transform:uppercase;font-weight:800;">CloudWatcher</p>
              <h1 style="margin:0;color:#0f172a;font-size:26px;line-height:1.2;font-weight:800;">Introducing Pricing Plans</h1>
              <p style="margin:10px 0 0;color:#475569;font-size:14px;line-height:1.6;">Important updates to your CloudWatcher account subscription.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 32px;color:#334155;font-size:15px;line-height:1.7;">
              <p style="margin:0 0 16px;">Hello,</p>
              <p style="margin:0 0 16px;">We are introducing official CloudWatcher pricing plans to support our growing feature set. As part of this update, your workspace has been transitioned to our standard <strong>Free Plan</strong>.</p>
              
              <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:24px 0 12px;">What is included in the Free Plan?</h3>
              <p style="margin:0 0 16px;">The Free plan includes baseline infrastructure health, inventory, and basic resource visibility with core monitoring.</p>
              
              <h3 style="color:#0f172a;font-size:16px;font-weight:700;margin:24px 0 12px;">Unlocking Premium Capabilities</h3>
              <p style="margin:0 0 16px;">To access cost optimization workflows, advanced AI observability traces, token spend details, and automated Watchdog alert routing, you can upgrade your account to <strong>Pro</strong> or <strong>Scale</strong> plan directly from your profile dashboard.</p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="https://www.cloudwatcher.rabbitt.ai/" style="display:inline-block;padding:12px 24px;background:#1a56db;color:#ffffff;text-decoration:none;font-weight:700;border-radius:8px;font-size:14px;">View Plans &amp; Pricing</a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:0 0 16px;">If you have any questions about this transition or need a custom plan/override applied to your tenant, please feel free to reach out to our team.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
              <p style="margin:0;">You are receiving this operational email because you have an active CloudWatcher account under: <strong>${email}</strong></p>
              <p style="margin:12px 0 0;">&copy; 2026 CloudWatcher. <a href="https://cloudwatcher.rabbitt.ai" style="color:#1a56db;text-decoration:none;">cloudwatcher.rabbitt.ai</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function run() {
  await mongoose.connect(config.mongodbUri);
  console.log("Connected to MongoDB");

  const transporter = createTransporter();
  const fromAddress = `"CloudWatcher" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;

  if (!SEND_TO_ALL) {
    console.log(`[TEST MODE] Sending test email to: ${TEST_EMAIL}`);
    const html = getEmailHtml(TEST_EMAIL);
    await transporter.sendMail({
      from: fromAddress,
      to: TEST_EMAIL,
      subject: "Introducing pricing plans at CloudWatcher",
      html,
    });
    console.log(`[TEST MODE] Email successfully sent to: ${TEST_EMAIL}`);
  } else {
    // Fetch all active users
    const users = await User.find({ email: { $ne: null } }).lean();
    console.log(`[PROD MODE] Found ${users.length} users in database.`);

    for (const user of users) {
      if (!user.email) continue;
      const tenantId = user.tenantId || user._id.toString();

      if (tenantId === EXCLUDE_TENANT_ID || user.email.toLowerCase() === EXCLUDE_EMAIL.toLowerCase()) {
        console.log(`[PROD MODE] Skipping excluded tenant/recipient: ${user.email} (${tenantId})`);
        continue;
      }

      console.log(`[PROD MODE] Sending pricing email to: ${user.email} (Tenant: ${tenantId})`);
      try {
        const html = getEmailHtml(user.email);
        await transporter.sendMail({
          from: fromAddress,
          to: user.email,
          subject: "Introducing pricing plans at CloudWatcher",
          html,
        });
        console.log(`[PROD MODE] Successfully sent email to: ${user.email}`);
      } catch (err: any) {
        console.error(`[PROD MODE] Failed to send email to ${user.email}:`, err.message);
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
