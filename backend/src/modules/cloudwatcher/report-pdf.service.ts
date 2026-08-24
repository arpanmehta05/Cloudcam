import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";

type ReportDetail = Awaited<ReturnType<typeof import("./reports.service").getCloudWatcherReport>>;

const M = 44;
const W = 524;

// Landing-page palette: blue / white / ink / slate only. Status is encoded by
// tone (blue = present/pass, ink = missing/fail, slate = partial/review).
const COLORS = {
  ink: "#0F172A",
  slate: "#475569",
  sub: "#64748B",
  muted: "#94A3B8",
  line: "#E2E8F0",
  panel: "#F8FAFC",
  blue: "#1A56DB",
  blueSoft: "#EFF6FF",
  white: "#FFFFFF",
};

// ── logo ────────────────────────────────────────────────────────────────────

let LOGO_SVG: string | null | undefined;
function loadLogoSvg(): string | null {
  if (LOGO_SVG !== undefined) return LOGO_SVG;
  const candidates = [
    path.resolve(process.cwd(), "../frontend/public/Logo.svg"),
    path.resolve(process.cwd(), "frontend/public/Logo.svg"),
    path.resolve(__dirname, "../../../../frontend/public/Logo.svg"),
    path.resolve(__dirname, "../../../../../frontend/public/Logo.svg"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        LOGO_SVG = fs.readFileSync(candidate, "utf8");
        return LOGO_SVG;
      }
    } catch {
      /* try next */
    }
  }
  LOGO_SVG = null;
  return LOGO_SVG;
}

// ── small data helpers ───────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pickStr(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = str(record[key]);
    if (value) return value;
  }
  return "";
}

function textList(value: unknown, limit = 50): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, limit)
    : [];
}

function scoreText(score: number | null | undefined) {
  return typeof score === "number" ? `${Math.round(score * 100)}` : "—";
}

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === "pass" || s === "present") return COLORS.blue;
  if (s === "fail" || s === "missing") return COLORS.ink;
  if (s === "manual_review" || s === "partial") return COLORS.slate;
  return COLORS.muted;
}

function severityColor(sev: string) {
  const s = sev.toLowerCase();
  return s === "critical" || s === "high" ? COLORS.ink : s === "medium" || s === "low" ? COLORS.slate : COLORS.muted;
}

// ── layout primitives ────────────────────────────────────────────────────────

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - M - 24) doc.addPage();
}

function section(doc: PDFKit.PDFDocument, title: string, sub?: string) {
  ensureSpace(doc, sub ? 100 : 80);
  doc.moveDown(0.9);
  doc.font("Helvetica-Bold").fontSize(12.5).fillColor(COLORS.ink).text(title, M, doc.y);
  const lineY = doc.y + 5;
  doc.moveTo(M, lineY).lineTo(M + W, lineY).lineWidth(1).strokeColor(COLORS.line).stroke();
  doc.y = lineY + 8;
  if (sub) {
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text(sub, M, doc.y, { width: W });
    doc.moveDown(0.5);
  }
}

function subSection(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 32);
  doc.moveDown(0.85);
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.ink).text(title, M, doc.y);
  doc.moveDown(0.35);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, opts: { color?: string; size?: number } = {}) {
  if (!text) return;
  ensureSpace(doc, 26);
  doc.font("Helvetica").fontSize(opts.size ?? 9.5).fillColor(opts.color ?? COLORS.ink).text(text, M, doc.y, { width: W, lineGap: 2 });
}

function bullets(doc: PDFKit.PDFDocument, items: string[], empty: string, color: string = COLORS.blue) {
  const rows = items.length ? items : [empty];
  for (const item of rows) {
    ensureSpace(doc, 22);
    const y = doc.y;
    doc.circle(M + 3, y + 4.5, 1.8).fillColor(items.length ? color : COLORS.muted).fill();
    doc.font("Helvetica").fontSize(9).fillColor(items.length ? COLORS.ink : COLORS.muted).text(item, M + 14, y, { width: W - 14, lineGap: 2 });
    doc.moveDown(0.35);
  }
}

// Outline chip with colored text. No fill — PDFKit mis-parses 8-digit hex
// (e.g. `#1A56DB14`) as a 32-bit int and produces garbage colors, so we never
// build a soft-tint that way. The thin stroke keeps it minimal.
function pill(doc: PDFKit.PDFDocument, text: string, color: string, x: number, y: number, width: number) {
  doc.roundedRect(x, y, width, 15, 4).lineWidth(0.9).strokeColor(color).stroke();
  doc.font("Helvetica-Bold").fontSize(7).fillColor(color).text(text.toUpperCase(), x + 2, y + 4.5, { width: width - 4, align: "center" });
}

function labeledValue(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, valueSize = 12) {
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.muted).text(label.toUpperCase(), x, y, { width });
  doc.font("Helvetica-Bold").fontSize(valueSize).fillColor(COLORS.ink).text(value || "—", x, y + 12, { width });
}

// ── header ───────────────────────────────────────────────────────────────────

function drawHeader(doc: PDFKit.PDFDocument) {
  const svg = loadLogoSvg();
  let textX = M + 40;
  if (svg) {
    try {
      SVGtoPDF(doc, svg, M, 30, { width: 30, height: 30, assumePt: true });
    } catch {
      textX = M;
    }
  } else {
    // fallback mark
    doc.roundedRect(M, 30, 30, 30, 7).fill(COLORS.blueSoft);
    doc.circle(M + 15, 45, 7).fillColor(COLORS.blue).fill();
  }
  doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.ink).text("CloudWatcher", textX, 32);
  doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text("Agent Harness Audit · by Rabbitt AI", textX + 1, 49);
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function renderCloudWatcherReportPdf(report: NonNullable<ReportDetail>): Promise<Buffer> {
  const raw = asRecord(report.raw_report_json);
  const target = asRecord(raw.target);
  const evidence = asRecord(target.evidence);
  const auditReport = asRecord(raw.audit_report);
  const scoring = asRecord(raw.scoring_inputs);
  const audit = asRecord(evidence.harness_audit);

  const executiveSummary = str(auditReport.executive_summary) || str(raw.raw_summary);
  const criticalGaps = textList(scoring.critical_gaps);
  const harnessGaps = textList(evidence.harness_gaps);
  const recommendations = textList(auditReport.final_recommendations);
  const modules = textList(auditReport.recommended_modules);
  const dataModels = textList(auditReport.data_models);
  const openQuestions = textList(auditReport.open_questions);
  const doNotBuild = textList(scoring.do_not_build_yet);
  const files = textList(evidence.files_inspected);
  const surfaces = textList(evidence.ai_surface_areas);
  const modelSites = textList(evidence.model_call_sites);
  const retrievalPaths = textList(evidence.retrieval_paths);
  const toolPaths = textList(evidence.tool_paths);
  const existingHarness = textList(evidence.existing_harness);
  const confidence = str(scoring.evidence_confidence);

  // detailed gap analysis rows
  const gapRows = (Array.isArray(auditReport.gap_analysis) ? auditReport.gap_analysis : []).map((g) => {
    const row = asRecord(g);
    return {
      area: pickStr(row, "area", "control", "harness_area", "category", "surface", "component"),
      severity: pickStr(row, "severity", "risk", "priority"),
      finding: pickStr(row, "finding", "gap", "issue", "description", "summary", "observation"),
      action: pickStr(row, "recommended_action", "action", "remediation", "fix", "recommendation"),
      validation: pickStr(row, "validation", "verification", "proof", "acceptance"),
    };
  }).filter((r) => r.finding || r.area);

  const scoreCaps = (Array.isArray(scoring.score_caps) ? scoring.score_caps : []).map((c) => {
    const row = asRecord(c);
    const capRaw = row.cap ?? row.max_score ?? row.value ?? row.ceiling;
    const cap = typeof capRaw === "number" ? (capRaw > 1 ? capRaw / 100 : capRaw) : null;
    return { area: pickStr(row, "area", "control", "harness_area", "category", "name"), reason: pickStr(row, "reason", "why", "justification", "detail", "description"), cap };
  }).filter((c) => c.area || c.reason);

  const roadmap = (Array.isArray(auditReport.roadmap) ? auditReport.roadmap : []).map((r, i) => {
    const row = asRecord(r);
    return { phase: pickStr(row, "phase", "goal") || `Phase ${i + 1}`, description: pickStr(row, "description", "detail", "goal"), timeframe: pickStr(row, "timeframe", "duration", "eta") };
  });

  const backlog = (Array.isArray(auditReport.backlog) ? auditReport.backlog : []).map((b, i) => {
    const row = asRecord(b);
    return { task: pickStr(row, "title", "description", "detail", "task") || `Task ${i + 1}`, ref: pickStr(row, "ticket", "id", "key"), priority: pickStr(row, "priority") };
  });

  const failing = report.test_results.filter((r) => r.pass_fail_status !== "pass");
  const passing = report.test_results.filter((r) => r.pass_fail_status === "pass");

  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: "LETTER", margin: M, bufferPages: true });
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // ── cover header ──
  drawHeader(doc);
  doc.font("Helvetica-Bold").fontSize(21).fillColor(COLORS.ink).text("Agent Harness Audit", M, 84);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.sub).text("Evidence-led assessment of the AI system's harness, gaps, and remediation plan.", M, 110, { width: W });

  // ── summary panel ── (only short values live in the fixed-height box)
  const panelY = 140;
  const panelH = 84;
  doc.roundedRect(M, panelY, W, panelH, 8).fillAndStroke(COLORS.panel, COLORS.line);
  labeledValue(doc, "Agent", report.agent_id || "Unknown", M + 16, panelY + 14, 160, 12);
  labeledValue(doc, "System type", report.system_type, M + 16, panelY + 48, 160, 11);
  labeledValue(doc, "Environment", pickStr(target, "environment") || "—", M + 210, panelY + 14, 150, 11);
  labeledValue(doc, "Maturity", pickStr(target, "maturity") || "—", M + 210, panelY + 48, 150, 11);
  // Score column, baseline-aligned "/100".
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.muted).text("EVIDENCE SCORE", M + 378, panelY + 14, { width: 130 });
  const scoreStr = scoreText(report.score);
  doc.font("Helvetica-Bold").fontSize(30);
  const scoreW = doc.widthOfString(scoreStr);
  doc.fillColor(COLORS.blue).text(scoreStr, M + 378, panelY + 28);
  doc.font("Helvetica").fontSize(11).fillColor(COLORS.muted).text("/100", M + 378 + scoreW + 4, panelY + 44);
  if (confidence) doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.sub).text(`${confidence} confidence`, M + 378, panelY + 62, { width: 130 });
  doc.y = panelY + panelH + 12;

  // Longer target facts flow below the panel so they can wrap freely.
  const metaLine = (label: string, value: string) => {
    if (!value) return;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.muted).text(label.toUpperCase(), M, doc.y, { continued: false });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.slate).text(value, M, doc.y, { width: W, lineGap: 1 });
    doc.moveDown(0.25);
  };
  metaLine("Model", pickStr(target, "model"));
  metaLine("Repository", pickStr(target, "repository"));
  doc.moveDown(0.1);
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(`Report ${report.report_id}  ·  Submitted ${new Date(report.submitted_at).toLocaleString()}`, M, doc.y, { width: W });

  // ── executive summary ──
  section(doc, "Executive Summary");
  if (executiveSummary) {
    for (const para of executiveSummary.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) paragraph(doc, para);
  } else {
    paragraph(doc, "No narrative summary was submitted with this report.", { color: COLORS.muted });
  }

  // ── score integrity ──
  if (criticalGaps.length || scoreCaps.length || doNotBuild.length) {
    section(doc, "Score Integrity", "CloudWatcher fails closed — a missing critical control caps the score regardless of other passes.");
    if (criticalGaps.length) {
      subSection(doc, "Critical gaps driving the cap");
      bullets(doc, criticalGaps, "None recorded.");
    }
    if (scoreCaps.length) {
      subSection(doc, "Applied score caps");
      for (const cap of scoreCaps) {
        ensureSpace(doc, 30);
        const y = doc.y;
        const head = cap.area ? cap.area.replace(/[_-]/g, " ") : "Cap";
        doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text(head + (cap.cap !== null ? `  (caps at ${Math.round(cap.cap * 100)}/100)` : ""), M + 14, y, { width: W - 14 });
        if (cap.reason) doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.slate).text(cap.reason, M + 14, doc.y, { width: W - 14, lineGap: 1 });
        doc.moveDown(0.35);
      }
    }
    if (doNotBuild.length) {
      subSection(doc, "Deliberately out of scope (do not build yet)");
      bullets(doc, doNotBuild, "");
    }
  }

  // ── harness coverage matrix ──
  section(doc, "Harness Coverage Matrix", "Every control area classified from the real codebase.");
  const entries = Object.entries(audit);
  if (!entries.length) {
    paragraph(doc, "No harness matrix was submitted.", { color: COLORS.muted });
  } else {
    for (const [area, status] of entries) {
      ensureSpace(doc, 22);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text(area.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), M, y, { width: 320 });
      pill(doc, String(status), statusColor(String(status)), M + 400, y - 3, 124);
      doc.y = y + 20;
    }
  }

  // ── gap analysis ──
  if (gapRows.length) {
    section(doc, "Gap Analysis", "Each gap, its severity, the fix, and the proof that closes it.");
    for (const gap of gapRows) {
      ensureSpace(doc, 60);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.ink).text(gap.area ? gap.area.replace(/[_-]/g, " ") : "Gap", M, y, { width: 380 });
      if (gap.severity) pill(doc, gap.severity, severityColor(gap.severity), M + 434, y - 3, 90);
      // Clear the pill height before the finding so text never runs under it.
      doc.y = Math.max(doc.y, y + 20);
      if (gap.finding) doc.font("Helvetica").fontSize(9).fillColor(COLORS.slate).text(gap.finding, M, doc.y, { width: W, lineGap: 1 });
      if (gap.action) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text("Fix: ", M, doc.y, { continued: true }).font("Helvetica").fillColor(COLORS.slate).text(gap.action, { width: W });
      }
      if (gap.validation) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.ink).text("Validate: ", M, doc.y, { continued: true }).font("Helvetica").fillColor(COLORS.slate).text(gap.validation, { width: W });
      }
      doc.moveDown(0.5);
      const ly = doc.y;
      doc.moveTo(M, ly).lineTo(M + W, ly).lineWidth(0.5).strokeColor(COLORS.line).stroke();
      doc.moveDown(0.4);
    }
  }

  // ── remediation roadmap ──
  section(doc, "Remediation Roadmap", "The plan of attack, in order.");
  if (roadmap.length) {
    roadmap.forEach((phase, index) => {
      ensureSpace(doc, 34);
      const y = doc.y;
      doc.circle(M + 6, y + 6, 8).fill(COLORS.blue);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.white).text(String(index + 1), M + 2.5, y + 2.5, { width: 8, align: "center" });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.ink).text(phase.phase + (phase.timeframe ? `  ·  ${phase.timeframe}` : ""), M + 22, y, { width: W - 22 });
      if (phase.description) doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.slate).text(phase.description, M + 22, doc.y, { width: W - 22, lineGap: 1 });
      doc.moveDown(0.5);
    });
  } else {
    paragraph(doc, "No roadmap was submitted.", { color: COLORS.muted });
  }

  // ── engineering backlog ──
  if (backlog.length) {
    section(doc, "Engineering Backlog", "Ready-to-assign tasks — work top to bottom.");
    backlog.forEach((item, index) => {
      ensureSpace(doc, 22);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.muted).text(String(index + 1).padStart(2, "0"), M, y + 1, { width: 20 });
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.ink).text(item.task, M + 24, y, { width: W - 24 - (item.ref ? 70 : 0), continued: false });
      if (item.ref) doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted).text(item.ref, M + W - 66, y + 1, { width: 66, align: "right" });
      doc.y = Math.max(doc.y, y + 16);
      doc.moveDown(0.15);
    });
  }

  // ── recommendations ──
  if (recommendations.length) {
    section(doc, "Final Recommendations", "What we would do first.");
    bullets(doc, recommendations, "");
  }

  // ── recommended architecture ──
  if (modules.length || dataModels.length) {
    section(doc, "Recommended Architecture");
    if (modules.length) {
      subSection(doc, "Modules");
      bullets(doc, modules, "");
    }
    if (dataModels.length) {
      subSection(doc, "Data models");
      bullets(doc, dataModels, "");
    }
  }

  // ── repository & surface evidence ──
  if (surfaces.length || modelSites.length || retrievalPaths.length || toolPaths.length || existingHarness.length || harnessGaps.length || files.length) {
    section(doc, "Repository & Surface Evidence", "What the audit actually inspected.");
    if (surfaces.length) {
      subSection(doc, "Detected AI surfaces");
      bullets(doc, surfaces, "");
    }
    if (modelSites.length) {
      subSection(doc, "Model call sites");
      bullets(doc, modelSites, "");
    }
    if (retrievalPaths.length) {
      subSection(doc, "Retrieval paths");
      bullets(doc, retrievalPaths, "");
    }
    if (toolPaths.length) {
      subSection(doc, "Tool / function paths");
      bullets(doc, toolPaths, "");
    }
    if (existingHarness.length) {
      subSection(doc, "Controls already in place");
      bullets(doc, existingHarness, "");
    }
    if (harnessGaps.length) {
      subSection(doc, "Controls missing or partial");
      bullets(doc, harnessGaps, "", COLORS.slate);
    }
    if (files.length) {
      subSection(doc, `Files inspected (${files.length})`);
      bullets(doc, files, "");
    }
  }

  // ── probe results ──
  section(doc, "Probe Results", `${failing.length} finding(s) needing attention · ${passing.length} passing check(s).`);
  if (failing.length) {
    for (const result of failing) {
      ensureSpace(doc, 52);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.ink).text(result.test_name, M, y, { width: 400 });
      pill(doc, result.pass_fail_status.replace(/_/g, " "), statusColor(result.pass_fail_status), M + 424, y - 3, 100);
      doc.y = Math.max(doc.y, y + 18);
      doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.muted).text(result.category.replace(/[_-]/g, " "), M, doc.y, { width: W });
      if (result.notes) doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.slate).text(result.notes, M, doc.y, { width: W, lineGap: 1 });
      const risk = asRecord(result.metadata).risk as Record<string, unknown> | undefined;
      const remediation = asRecord(result.metadata).remediation as Record<string, unknown> | undefined;
      if (risk && (str(risk.impact) || str(risk.severity))) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.ink).text("Risk: ", M, doc.y, { continued: true }).font("Helvetica").fillColor(COLORS.slate).text(`${str(risk.severity)} — ${str(risk.impact)}`.replace(/^ — /, ""), { width: W });
      }
      if (remediation && str(remediation.recommended_action)) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.ink).text("Fix: ", M, doc.y, { continued: true }).font("Helvetica").fillColor(COLORS.slate).text(str(remediation.recommended_action), { width: W });
      }
      doc.moveDown(0.5);
      const ly = doc.y;
      doc.moveTo(M, ly).lineTo(M + W, ly).lineWidth(0.5).strokeColor(COLORS.line).stroke();
      doc.moveDown(0.4);
    }
  } else {
    paragraph(doc, "No failed or review probes. All exercised checks passed.", { color: COLORS.muted });
  }
  if (passing.length) {
    subSection(doc, "Passing checks");
    bullets(doc, passing.map((p) => p.test_name), "");
  }

  if (openQuestions.length) {
    section(doc, "Open Questions");
    bullets(doc, openQuestions, "");
  }

  // ── footers ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted).text(`CloudWatcher Agent Watcher  ·  ${report.report_id}  ·  Page ${i + 1} of ${range.count}`, M, doc.page.height - 30, {
      width: W,
      align: "center",
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }

  doc.end();
  return done;
}
