import { UsageReportFrequency } from "../../../models/user.model";
import { generateReportPdf } from "./pdf-generator";
import { BillingStats, InsightStats } from "./aggregator";

export function formatMoney(value: unknown, unit = "USD"): string {
    const amount = Number(value || 0);
    return `${unit} ${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export function formatDate(value: Date | string | null | undefined): string {
    if (!value) return "Not scheduled";
    return new Date(value).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    }) + " (UTC)";
}

export function escapeHtml(value: unknown): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function topServicesRows(breakdown: any[] = []): string {
    const rows = breakdown
        .slice()
        .sort((a, b) => Number(b.amount || b.cost || 0) - Number(a.amount || a.cost || 0))
        .slice(0, 8);

    if (!rows.length) {
        return `<tr><td colspan="2" style="padding:12px;color:#64748b;">No billing data available.</td></tr>`;
    }

    return rows.map((item) => {
        const name = item.service || item.name || item.key || "AWS Service";
        const amount = item.amount ?? item.cost ?? item.total ?? 0;
        const unit = item.unit || "USD";
        return `
            <tr>
                <td style="padding:8px 0;border-top:1px solid #f1f5f9;">${escapeHtml(name)}</td>
                <td style="padding:8px 0;border-top:1px solid #f1f5f9;text-align:right;font-weight:600;">${formatMoney(amount, unit)}</td>
            </tr>`;
    }).join("");
}

function tableRows(rows: Array<Array<unknown>>): string {
    return rows.map((row) => `
        <tr>
            ${row.map((cell) => `<td style="padding:10px 12px;border-top:1px solid #e2e8f0;color:#334155;font-size:13px;">${escapeHtml(cell)}</td>`).join("")}
        </tr>
    `).join("");
}

export function brandedReportEmailHtml(params: {
    name: string;
    title: string;
    kicker: string;
    summary: string;
    accent: string;
    generatedAt: Date;
    nextSendAt?: Date | null;
    metrics: Array<{ label: string; value: string }>;
    alerts?: string[];
}): string {
    const { name, title, kicker, summary, accent, generatedAt, nextSendAt, metrics, alerts = [] } = params;
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
  <div style="max-width:680px;margin:28px auto;background:#ffffff;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
    <div style="padding:30px 34px;background:linear-gradient(135deg,#ffffff 0%,#eff6ff 58%,#fff7ed 100%);border-bottom:1px solid #dbeafe;">
      <p style="margin:0 0 10px;color:${accent};font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;">Cloudcam by Fonder</p>
      <h1 style="margin:0;font-size:28px;line-height:1.15;color:#0f172a;">${escapeHtml(title)}</h1>
      <p style="margin:10px 0 0;color:#475569;font-size:15px;line-height:1.6;">${escapeHtml(kicker)}</p>
    </div>
    <div style="padding:30px 34px;">
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#334155;">${escapeHtml(summary)}</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:${alerts.length ? "24px" : "28px"};">
        <tbody>
          ${tableRows(metrics.map((metric) => [metric.label, metric.value]))}
        </tbody>
      </table>
      ${alerts.length ? `
        <div style="margin-bottom:28px;padding:16px 18px;border:1px solid #fed7aa;background:#fff7ed;border-radius:14px;">
          <p style="margin:0 0 10px;color:#9a3412;font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;">Alerts needing attention</p>
          ${alerts.map((alert) => `<p style="margin:8px 0 0;color:#7c2d12;font-size:14px;line-height:1.55;">${escapeHtml(alert)}</p>`).join("")}
        </div>
      ` : ""}
      <div style="padding:18px;border:1px solid #dbeafe;background:#eff6ff;border-radius:14px;">
        <p style="margin:0;color:#1e3a8a;font-size:14px;line-height:1.6;">
          Your detailed report PDF is attached with tables, findings, and recommended next actions.
        </p>
      </div>
    </div>
    <div style="padding:18px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
      Generated ${formatDate(generatedAt)}. Next scheduled delivery: <strong>${formatDate(nextSendAt)}</strong>.
    </div>
  </div>
</body>
</html>`;
}

export function usageReportHtml(params: {
    name: string;
    frequency: UsageReportFrequency;
    billing: any;
    generatedAt: Date;
    nextSendAt?: Date | null;
}): string {
    const { name, frequency, billing, generatedAt, nextSendAt } = params;
    const summary = billing.summary || {};
    const unit = summary.unit || "USD";
    const currentSpend = frequency === "weekly" ? (summary.last7dSpend ?? summary.currentSpend) : summary.mtdSpend;

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;color:#1e293b;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="padding:32px;background:#0f172a;color:#fff;">
      <h1 style="margin:0;font-size:24px;">Cloud Usage Report</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#94a3b8;">${frequency.toUpperCase()} • Generated ${formatDate(generatedAt)}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;">Hi ${escapeHtml(name)}, here is your cloud usage summary.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;">
        <div style="padding:20px;background:#f1f5f9;border-radius:12px;">
          <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;">Current Spend</p>
          <p style="margin:8px 0 0;font-size:24px;font-weight:bold;color:#0f172a;">${formatMoney(currentSpend, unit)}</p>
        </div>
        <div style="padding:20px;background:#f1f5f9;border-radius:12px;">
          <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;font-weight:600;">Projected Total</p>
          <p style="margin:8px 0 0;font-size:24px;font-weight:bold;color:#0f172a;">${formatMoney(summary.projectedTotal, unit)}</p>
        </div>
      </div>
      <h2 style="font-size:18px;margin:0 0 16px;color:#0f172a;">Top Services</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:32px;">
        ${topServicesRows(billing.mtdBreakdown)}
      </table>
      <div style="padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;text-align:center;">
        <p style="margin:0;font-size:13px;color:#64748b;">
            Next scheduled report: <strong>${formatDate(nextSendAt)}</strong>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function aiInsightReportHtml(params: {
    name: string;
    insights: any;
    generatedAt: Date;
    nextSendAt?: Date | null;
}): string {
    const { name, insights, generatedAt, nextSendAt } = params;
    const recs = (insights.recommendations || []).slice(0, 5).map((r: any) => `
        <div style="padding:16px;background:#f0f9ff;border-radius:12px;margin-bottom:16px;border-left:4px solid #0ea5e9;">
            <p style="margin:0;font-weight:700;color:#0369a1;font-size:15px;">${escapeHtml(r.title)}</p>
            <p style="margin:8px 0;font-size:14px;color:#0c4a6e;line-height:1.5;">${escapeHtml(r.description)}</p>
            ${r.savings ? `<p style="margin:0;font-weight:bold;color:#0ea5e9;font-size:13px;">Est. Savings: ${escapeHtml(r.savings)}</p>` : ""}
        </div>
    `).join("");
    const diagnosis = (insights.diagnosis || []).slice(0, 5).map((d: any) => `
        <div style="padding:14px 0;border-top:1px solid #ede9fe;">
            <p style="margin:0;font-weight:700;color:#4c1d95;font-size:14px;">${escapeHtml(d.title)}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#5b21b6;line-height:1.5;">${escapeHtml(d.details)}</p>
        </div>
    `).join("");
    const optimizations = (insights.optimizations || []).slice(0, 5).map((o: any) => `
        <div style="padding:16px;background:#ecfdf5;border-radius:12px;margin-bottom:12px;border-left:4px solid #10b981;">
            <p style="margin:0;font-weight:700;color:#065f46;font-size:15px;">${escapeHtml(o.title)}</p>
            <p style="margin:8px 0;font-size:14px;color:#064e3b;line-height:1.5;">${escapeHtml(o.description)}</p>
            <p style="margin:0;font-size:12px;color:#047857;">Priority: <strong>${escapeHtml(o.priority)}</strong>${o.savings ? ` &bull; Savings: <strong>${escapeHtml(o.savings)}</strong>` : ""}</p>
        </div>
    `).join("");

    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;color:#1e293b;">
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="padding:32px;background:#7c3aed;color:#fff;">
      <h1 style="margin:0;font-size:24px;">AI Infrastructure Insights</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#ddd6fe;">Intelligence • Generated ${formatDate(generatedAt)}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 24px;">Hi ${escapeHtml(name)}, here are your latest AI-driven optimizations.</p>
      <h2 style="font-size:18px;margin:0 0 16px;color:#0f172a;">Recommendations</h2>
      <div style="margin-bottom:28px;">
        ${recs || "<p style='color:#64748b;'>No new recommendations. Your infrastructure is performing optimally.</p>"}
      </div>
      <h2 style="font-size:18px;margin:0 0 12px;color:#0f172a;">Infrastructure Diagnosis</h2>
      <div style="padding:4px 18px 8px;background:#faf5ff;border-radius:12px;margin-bottom:28px;border:1px solid #ede9fe;">
        ${diagnosis || "<p style='color:#64748b;'>No diagnosis findings are available yet.</p>"}
      </div>
      <h2 style="font-size:18px;margin:0 0 16px;color:#0f172a;">Optimization Actions</h2>
      <div style="margin-bottom:32px;">
        ${optimizations || "<p style='color:#64748b;'>No additional optimization actions are available yet.</p>"}
      </div>
      <div style="padding:20px;background:#f8fafc;border-radius:12px;border:1px solid #f1f5f9;text-align:center;">
        <p style="margin:0;font-size:13px;color:#64748b;">
            Next scheduled insights: <strong>${formatDate(nextSendAt)}</strong>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function exportBillingReport(params: {
    name: string;
    email: string;
    frequency: UsageReportFrequency;
    sections: string[];
    stats: BillingStats;
    now: Date;
    nextSendAt: Date | null;
}) {
    const { name, email, frequency, sections, stats, now, nextSendAt } = params;
    const { totalCurrentSpend, totalProjectedSpend, primaryUnit, topServices, providersData } = stats;

    const pdfSections: Array<{ title: string; rows: Array<Array<unknown>> }> = [];
    if (sections.includes("summary")) {
        pdfSections.push({
            title: "Summary",
            rows: [
                ["Total current spend", formatMoney(totalCurrentSpend, primaryUnit)],
                ["Total projected total", formatMoney(totalProjectedSpend, primaryUnit)],
                ...providersData.map(p => [
                    `${p.provider.toUpperCase()} Spend`,
                    `${formatMoney(p.currentSpend || 0, p.unit)} (Projected: ${formatMoney(p.projectedTotal || 0, p.unit)})`
                ])
            ],
        });
    }
    if (sections.includes("topServices")) {
        pdfSections.push({
            title: "Top Services",
            rows: topServices.length
                ? topServices.map((item: any) => [
                    item.service || item.name || item.key || "Service",
                    `${formatMoney(item.amount ?? item.cost ?? item.total ?? 0, item.unit || "USD")} (${item.provider.toUpperCase()})`
                ])
                : [["No billing data available", "No connected clouds returned service-level billing data for this period."]],
        });
    }
    if (sections.includes("schedule")) {
        pdfSections.push({
            title: "Schedule",
            rows: [
                ["Frequency", frequency === "weekly" ? "Weekly" : "Monthly"],
                ["Next scheduled delivery", formatDate(nextSendAt)],
            ],
        });
    }

    const pdfBuffer = await generateReportPdf({
        title: "Cloud Usage Report",
        subtitle: `${frequency === "weekly" ? "Weekly" : "Monthly"} cost and usage summary`,
        generatedAt: now,
        accent: "#1A56DB",
        kpis: [
            { label: "Total spend", value: formatMoney(totalCurrentSpend, primaryUnit), note: frequency === "weekly" ? "Last 7 days" : "Month to date" },
            { label: "Total projected", value: formatMoney(totalProjectedSpend, primaryUnit), note: "Forecasted billing period" },
            { label: "Connected clouds", value: String(providersData.length), note: "Active cloud connections" },
        ],
        sections: pdfSections,
    });

    const emailSubject = `Cloudcam ${frequency === "weekly" ? "Weekly" : "Monthly"} Usage Report`;
    const emailHtml = brandedReportEmailHtml({
        name,
        title: "Cloud Usage Report",
        kicker: "Cost, usage, and projection summary for your connected cloud accounts.",
        summary: "Your detailed report is attached as a PDF. The attachment includes service-level tables and the next scheduled delivery date.",
        accent: "#1A56DB",
        generatedAt: now,
        nextSendAt,
        metrics: [
            { label: "Total current spend", value: formatMoney(totalCurrentSpend, primaryUnit) },
            { label: "Total projected spend", value: formatMoney(totalProjectedSpend, primaryUnit) },
            ...providersData.map(p => ({
                label: `${p.provider.toUpperCase()} Spend (Current / Projected)`,
                value: `${formatMoney(p.currentSpend || 0, p.unit)} / ${formatMoney(p.projectedTotal || 0, p.unit)}`
            }))
        ],
    });

    const providersBreakdown = providersData.map((p: any) => `• *${p.provider.toUpperCase()}*: ${formatMoney(p.currentSpend || 0, p.unit)} (Projected: ${formatMoney(p.projectedTotal || 0, p.unit)})`).join("\n");
    const topServicesText = topServices.slice(0, 10).map((item: any) => `• *${item.service || item.name || "Service"}*: ${formatMoney(item.amount ?? item.cost ?? item.total ?? 0, item.unit || "USD")} (${item.provider.toUpperCase()})`).join("\n");

    const slackPayload = {
        username: "Cloudcam",
        icon_url: "https://cdn-icons-png.flaticon.com/512/825/825590.png",
        text: `📊 Cloud Usage Report (${frequency})`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `📊 Cloud ${frequency === "weekly" ? "Weekly" : "Monthly"} Usage Report`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Hi ${name},* here is your synced cloud usage report from Cloudcam.`
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Total Current Spend:*\n*${formatMoney(totalCurrentSpend, primaryUnit)}*`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Total Projected Spend:*\n*${formatMoney(totalProjectedSpend, primaryUnit)}*`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Connected Clouds:*\n*${providersData.length}* active`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Report Frequency:*\n*${frequency === "weekly" ? "Weekly" : "Monthly"}*`
                    }
                ]
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Cloud Providers Cost Breakdown:*\n${providersBreakdown || "No breakdown data"}`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Top Services (Up to 10):*\n${topServicesText || "No top services data"}`
                }
            },
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: `*Generated At:* ${now.toUTCString()} | *Next Scheduled:* ${formatDate(nextSendAt)}`
                    }
                ]
            }
        ]
    };

    return {
        emailSubject,
        emailHtml,
        pdfBuffer,
        slackPayload,
    };
}

export async function exportInsightReport(params: {
    name: string;
    email: string;
    frequency: UsageReportFrequency;
    sections: string[];
    stats: InsightStats;
    now: Date;
    nextSendAt: Date | null;
}) {
    const { name, email, frequency, sections, stats, now, nextSendAt } = params;
    const { recommendations, diagnosis, optimizations } = stats;

    const alerts = diagnosis
        .filter((item: any) => item.status === "warning" || item.status === "critical")
        .slice(0, 3)
        .map((item: any) => {
            const providerPrefix = item.provider ? `[${item.provider.toUpperCase()}] ` : "";
            return `${providerPrefix}${item.title}: ${item.details}`;
        });

    const allAlerts = diagnosis
        .filter((item: any) => item.status === "warning" || item.status === "critical")
        .map((item: any) => {
            const providerPrefix = item.provider ? `[${item.provider.toUpperCase()}] ` : "";
            return `${providerPrefix}${item.title}: ${item.details}`;
        });

    const pdfSections: Array<{ title: string; rows: Array<Array<unknown>> }> = [];
    if (sections.includes("recommendations")) {
        pdfSections.push({
            title: "Recommendations",
            rows: recommendations.length
                ? recommendations.map((item: any) => {
                    const providerPrefix = item.provider ? `[${item.provider.toUpperCase()}] ` : "";
                    return [
                        `${providerPrefix}${item.title || "Recommendation"}`,
                        item.savings || item.impact || "",
                        item.description || item.action || "",
                    ];
                })
                : [["No recommendations", "", "No new recommendations are available for this scan."]],
        });
    }
    if (sections.includes("diagnosis")) {
        pdfSections.push({
            title: "Infrastructure Diagnosis",
            rows: diagnosis.length
                ? diagnosis.map((item: any) => {
                    const providerPrefix = item.provider ? `[${item.provider.toUpperCase()}] ` : "";
                    return [
                        `${providerPrefix}${item.title || "Finding"}`,
                        item.status || "info",
                        item.details || "",
                    ];
                })
                : [["No diagnosis findings", "", "No diagnosis findings are available for this scan."]],
        });
    }
    if (sections.includes("optimizations")) {
        pdfSections.push({
            title: "Optimization Actions",
            rows: optimizations.length
                ? optimizations.map((item: any) => {
                    const providerPrefix = item.provider ? `[${item.provider.toUpperCase()}] ` : "";
                    return [
                        `${providerPrefix}${item.title || "Optimization"}`,
                        item.savings || item.priority || "",
                        item.description || item.action || "",
                    ];
                })
                : [["No optimization actions", "", "No additional optimization actions are available."]],
        });
    }
    if (sections.includes("alerts")) {
        pdfSections.push({
            title: "Alerts",
            rows: alerts.length
                ? alerts.map((alert: string) => ["Attention needed", "", alert])
                : [["No active alerts", "", "No warning or critical diagnosis findings were returned."]],
        });
    }

    const pdfBuffer = await generateReportPdf({
        title: "AI Infrastructure Insights",
        subtitle: "Recommendations, diagnosis, and optimization actions",
        generatedAt: now,
        accent: "#7C3AED",
        kpis: [
            { label: "Recommendations", value: String(recommendations.length), note: "All connected clouds" },
            { label: "Diagnosis findings", value: String(diagnosis.length), note: "Infrastructure signals" },
            { label: "Sections", value: String(sections.length), note: "Customized by user" },
        ],
        sections: pdfSections,
    });

    const emailSubject = `Cloudcam AI Infrastructure Insights`;
    const emailHtml = brandedReportEmailHtml({
        name,
        title: "AI Infrastructure Insights",
        kicker: "Recommendations, diagnosis, and optimization actions from the Insights analysis.",
        summary: "Your detailed AI infrastructure report is attached as a PDF. The attachment includes recommendation tables and actionable findings from the latest scan.",
        accent: "#A855F7",
        generatedAt: now,
        nextSendAt,
        metrics: [
            { label: "Recommendations", value: String(recommendations.length) },
            { label: "Diagnosis findings", value: String(diagnosis.length) },
            { label: "Report sections", value: String(sections.length) },
        ],
        alerts: sections.includes("alerts") ? alerts : [],
    });

    const recsText = recommendations.length
        ? recommendations.map((item: any) => `• *[${item.provider.toUpperCase()}] ${item.title}* (${item.savings || "Optimize"})\n_${item.description || item.action}_`).join("\n\n")
        : "• No recommendations found.";

    const alertsText = allAlerts.length
        ? allAlerts.map((a: string) => `• ⚠️ ${a}`).join("\n")
        : "• No warnings or critical findings.";

    const optimizationsText = optimizations.length
        ? optimizations.map((item: any) => `• *[${item.provider.toUpperCase()}] ${item.title}* (${item.savings || item.priority || "Action"})\n_${item.description || item.action}_`).join("\n\n")
        : "• No optimizations found.";

    const slackPayload = {
        username: "Cloudcam",
        icon_url: "https://cdn-icons-png.flaticon.com/512/825/825590.png",
        text: `💡 AI Infrastructure Insights (${frequency})`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `💡 AI ${frequency === "weekly" ? "Weekly" : "Monthly"} Insights Report`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Hi ${name},* here is your synced AI insights report from Cloudcam.`
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Recommendations:*\n*${recommendations.length}* findings`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Diagnosis & Signals:*\n*${diagnosis.length}* signals`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Optimization Actions:*\n*${optimizations.length}* actions`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Report Frequency:*\n*${frequency === "weekly" ? "Weekly" : "Monthly"}*`
                    }
                ]
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Top Recommendations:*\n${recsText}`
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Infrastructure Diagnosis & Alerts:*\n${alertsText}`
                }
            },
            ...(optimizations.length ? [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Optimization Actions:*\n${optimizationsText}`
                    }
                }
            ] : []),
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
                        text: `*Generated At:* ${now.toUTCString()} | *Next Scheduled:* ${formatDate(nextSendAt)}`
                    }
                ]
            }
        ]
    };

    return {
        emailSubject,
        emailHtml,
        pdfBuffer,
        slackPayload,
    };
}
