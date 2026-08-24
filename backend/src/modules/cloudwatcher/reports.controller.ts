import { Request, Response } from "express";
import { checkCloudWatcherReportRateLimit } from "./rate-limit";
import { renderCloudWatcherReportPdf } from "./report-pdf.service";
import {
  createCloudWatcherReport,
  getCloudWatcherReport,
  listCloudWatcherAgentReports,
  listCloudWatcherAgents,
} from "./reports.service";
import { validateCloudWatcherReport } from "./report-validation";

function userIdFromSession(req: Request): string | null {
  return (req as any).user?.userId || null;
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function validateReportPost(req: Request, res: Response) {
  const validation = validateCloudWatcherReport(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "schema_invalid",
      valid: false,
      errors: validation.errors,
    });
  }

  return res.json({ success: true, valid: true });
}

export async function reportsPost(req: Request, res: Response) {
  const ingest = (req as any).aiIngest;
  if (!ingest?.userId || !ingest?.keyId) {
    return res.status(401).json({
      success: false,
      code: "token_invalid",
      error: "Valid API token required",
    });
  }

  const limit = checkCloudWatcherReportRateLimit(ingest.keyId);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: "rate_limited",
      error: "Report submission rate limit exceeded",
      retry_after_seconds: limit.retryAfterSeconds,
    });
  }

  const validation = validateCloudWatcherReport(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      code: "schema_invalid",
      errors: validation.errors,
    });
  }

  try {
    const result = await createCloudWatcherReport(ingest.userId, validation.data);
    return res.status(202).json({ success: true, report_id: result.reportId });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        code: "agent_id_conflict",
        error: "Agent identifier conflict",
      });
    }

    return res.status(500).json({
      success: false,
      code: "report_persist_failed",
      error: "Failed to store report",
    });
  }
}

export async function agentsGet(req: Request, res: Response) {
  const accountId = userIdFromSession(req);
  if (!accountId) return res.status(401).json({ success: false, error: "Authentication required" });

  const agents = await listCloudWatcherAgents(accountId);
  return res.json({ success: true, agents });
}

export async function agentReportsGet(req: Request, res: Response) {
  const accountId = userIdFromSession(req);
  if (!accountId) return res.status(401).json({ success: false, error: "Authentication required" });

  const reports = await listCloudWatcherAgentReports(accountId, param(req.params.agent_id));
  if (!reports) {
    return res.status(404).json({ success: false, code: "agent_not_found", error: "Agent not found" });
  }

  return res.json({ success: true, reports });
}

export async function reportGet(req: Request, res: Response) {
  const accountId = userIdFromSession(req);
  if (!accountId) return res.status(401).json({ success: false, error: "Authentication required" });

  const report = await getCloudWatcherReport(accountId, param(req.params.report_id));
  if (!report) {
    return res.status(404).json({ success: false, code: "report_not_found", error: "Report not found" });
  }

  return res.json({ success: true, report });
}

export async function reportPdfGet(req: Request, res: Response) {
  const accountId = userIdFromSession(req);
  if (!accountId) return res.status(401).json({ success: false, error: "Authentication required" });

  const report = await getCloudWatcherReport(accountId, param(req.params.report_id));
  if (!report) {
    return res.status(404).json({ success: false, code: "report_not_found", error: "Report not found" });
  }

  const pdf = await renderCloudWatcherReportPdf(report);
  const filename = `cloudwatcher-agent-report-${report.report_id}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", String(pdf.length));
  return res.send(pdf);
}
