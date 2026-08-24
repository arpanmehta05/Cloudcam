import { User, decryptKey } from "../../../models/user.model";
import { isConnected } from "../../../store/workspace-credentials";
import { sendEmail } from "../../../services/email.service";
import { collectBillingStats, collectInsightStats } from "./aggregator";
import { exportBillingReport, exportInsightReport } from "./exporter";
import {
    calculateNextReportSendAt,
    ensureReportPreferences,
    normalizeSections,
    ReportType,
} from "./scheduler";

export { getAllReportPreferences, updateReportPreferences, calculateNextReportSendAt } from "./scheduler";
export { generateReportPdf } from "./pdf-generator";

export type SendReportResult = {
    sent: boolean;
    recipient?: string;
    skippedReason?: string;
    nextSendAt?: Date | null;
};

export async function sendReportEmail(
    userId: string,
    type: ReportType,
    options: { force?: boolean } = {}
): Promise<SendReportResult> {
    const user = await User.findById(userId);
    if (!user) return { sent: false, skippedReason: "user_not_found" };
    const email = user.email;
    if (!email) return { sent: false, skippedReason: "no_email_configured" };

    const { prefs, changed } = ensureReportPreferences(user, type);
    if (changed) {
        await user.save();
    }

    if (!options.force && !prefs.enabled) {
        return { sent: false, skippedReason: "report_not_enabled" };
    }

    const now = new Date();
    if (!options.force && prefs.nextSendAt && prefs.nextSendAt > now) {
        return { sent: false, skippedReason: "not_due_yet", nextSendAt: prefs.nextSendAt };
    }

    const hasAws = await isConnected(userId, "aws");
    const hasAzure = await isConnected(userId, "azure");
    const hasGcp = await isConnected(userId, "gcp");

    if (!hasAws && !hasAzure && !hasGcp) {
        return { sent: false, skippedReason: "no_providers_connected" };
    }

    const nextCalculatedAt = calculateNextReportSendAt(prefs.frequency, now, prefs);
    const finalNextSendAt = (options.force && prefs.nextSendAt && prefs.nextSendAt > now) 
        ? prefs.nextSendAt 
        : nextCalculatedAt;

    if (type === "usage") {
        const range = prefs.frequency === "weekly" ? "7d" : "mtd";
        const stats = await collectBillingStats(userId, range);
        if (!stats) {
            return { sent: false, skippedReason: "no_providers_connected" };
        }

        const { emailSubject, emailHtml, pdfBuffer, slackPayload } = await exportBillingReport({
            name: user.name || email,
            email,
            frequency: prefs.frequency,
            sections: normalizeSections(type, prefs.sections),
            stats,
            now,
            nextSendAt: finalNextSendAt,
        });

        await sendEmail({
            to: email,
            subject: emailSubject,
            html: emailHtml,
            attachments: [{
                filename: `cloudwatcher-usage-report-${now.toISOString().slice(0, 10)}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            }],
        });

        if ((options.force || user.notificationSettings?.slack?.enabled) && user.notificationSettings?.slack?.webhookUrl) {
            try {
                const slackUrl = decryptKey(user.notificationSettings.slack.webhookUrl);
                await fetch(slackUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(slackPayload),
                });
            } catch (err) {
                console.error("[Usage-Report] Failed to sync report to Slack:", err);
            }
        }

        user.usageReportPreferences.lastSentAt = now;
        user.usageReportPreferences.nextSendAt = finalNextSendAt;
    } else {
        const stats = await collectInsightStats(userId);
        const { emailSubject, emailHtml, pdfBuffer, slackPayload } = await exportInsightReport({
            name: user.name || email,
            email,
            frequency: prefs.frequency,
            sections: normalizeSections(type, prefs.sections),
            stats,
            now,
            nextSendAt: finalNextSendAt,
        });

        await sendEmail({
            to: email,
            subject: emailSubject,
            html: emailHtml,
            attachments: [{
                filename: `cloudwatcher-ai-insights-${now.toISOString().slice(0, 10)}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            }],
        });

        if ((options.force || user.notificationSettings?.slack?.enabled) && user.notificationSettings?.slack?.webhookUrl) {
            try {
                const slackUrl = decryptKey(user.notificationSettings.slack.webhookUrl);
                await fetch(slackUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(slackPayload),
                });
            } catch (err) {
                console.error("[Usage-Report] Failed to sync insights to Slack:", err);
            }
        }

        user.aiInsightPreferences.lastSentAt = now;
        user.aiInsightPreferences.nextSendAt = finalNextSendAt;
    }

    await user.save();
    const slackConfigured = !!((options.force || user.notificationSettings?.slack?.enabled) && user.notificationSettings?.slack?.webhookUrl);
    return {
        sent: true,
        recipient: slackConfigured ? `${email} and Slack` : email,
        nextSendAt: prefs.nextSendAt,
    };
}

export async function sendDueReports() {
    const now = new Date();
    const users = await User.find({
        $or: [
            { "usageReportPreferences.enabled": true, "usageReportPreferences.nextSendAt": { $lte: now } },
            { "aiInsightPreferences.enabled": true, "aiInsightPreferences.nextSendAt": { $lte: now } }
        ]
    }).select("_id email usageReportPreferences aiInsightPreferences");

    let sent = 0;
    for (const user of users) {
        if (user.usageReportPreferences?.enabled && user.usageReportPreferences.nextSendAt && user.usageReportPreferences.nextSendAt <= now) {
            try { await sendReportEmail(user._id.toString(), "usage"); sent++; } catch (e) { console.error(e); }
        }
        if (user.aiInsightPreferences?.enabled && user.aiInsightPreferences.nextSendAt && user.aiInsightPreferences.nextSendAt <= now) {
            try { await sendReportEmail(user._id.toString(), "insight"); sent++; } catch (e) { console.error(e); }
        }
    }
    return { scanned: users.length, sent };
}
