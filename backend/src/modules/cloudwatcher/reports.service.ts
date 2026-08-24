import { Types } from "mongoose";
import { CloudWatcherAgent } from "../../models/cloudwatcher-agent.model";
import { CloudWatcherReport } from "../../models/cloudwatcher-report.model";
import { CloudWatcherReportTestResult } from "../../models/cloudwatcher-report-test-result.model";
import { CloudWatcherReportInput } from "./report-validation";
import { enqueueCloudWatcherScoring } from "./scoring";

const REPORT_TTL_MS = 24 * 60 * 60 * 1000;

export async function createCloudWatcherReport(accountId: string, report: CloudWatcherReportInput) {
  const agent = await CloudWatcherAgent.findOneAndUpdate(
    { accountId, agentId: report.agent_id },
    {
      $setOnInsert: {
        accountId,
        agentId: report.agent_id,
      },
      $set: {
        displayName: report.agent_name || report.agent_id,
      },
    },
    { new: true, upsert: true },
  );

  const submittedAt = new Date(report.timestamp);
  const expiresAt = new Date(submittedAt.getTime() + REPORT_TTL_MS);

  const savedReport = await CloudWatcherReport.create({
    agentRef: agent._id,
    accountId,
    systemType: report.system_type,
    skillName: report.skill_name,
    skillVersion: report.skill_version,
    submittedAt,
    expiresAt,
    rawReportJson: report,
    status: "pending_score",
    score: null,
  });

  await CloudWatcherReportTestResult.insertMany(
    report.test_results.map((result) => ({
      reportRef: savedReport._id,
      category: result.category,
      testName: result.test_name,
      input: result.input,
      output: result.output,
      passFailStatus: result.pass_fail,
      notes: result.notes,
      latencyMs: result.latency_ms ?? null,
      costUsd: result.cost_usd ?? null,
      citations: result.citations,
      toolCalls: result.tool_calls,
      metadata: result.metadata ?? null,
      expiresAt,
    })),
  );

  enqueueCloudWatcherScoring(String(savedReport._id));
  return { reportId: String(savedReport._id) };
}

export async function listCloudWatcherAgents(accountId: string) {
  const agents = await CloudWatcherAgent.find({ accountId }).sort({ createdAt: -1 }).lean();
  const agentIds = agents.map((agent) => agent._id);
  const latestReports = await CloudWatcherReport.aggregate([
    { $match: { accountId, agentRef: { $in: agentIds } } },
    { $sort: { submittedAt: -1 } },
    {
      $group: {
        _id: "$agentRef",
        reportId: { $first: "$_id" },
        status: { $first: "$status" },
        score: { $first: "$score" },
        submittedAt: { $first: "$submittedAt" },
      },
    },
  ]);
  const latestByAgent = new Map(latestReports.map((report) => [String(report._id), report]));

  return agents.map((agent) => ({
    id: String(agent._id),
    agent_id: agent.agentId,
    display_name: agent.displayName,
    created_at: agent.createdAt,
    latest_report: latestByAgent.has(String(agent._id))
      ? {
        report_id: String(latestByAgent.get(String(agent._id)).reportId),
        status: latestByAgent.get(String(agent._id)).status,
        score: latestByAgent.get(String(agent._id)).score,
        submitted_at: latestByAgent.get(String(agent._id)).submittedAt,
      }
      : null,
  }));
}

export async function listCloudWatcherAgentReports(accountId: string, agentId: string) {
  const agent = await CloudWatcherAgent.findOne({ accountId, agentId }).lean();
  if (!agent) return null;

  const reports = await CloudWatcherReport.find({ accountId, agentRef: agent._id })
    .sort({ submittedAt: -1 })
    .select("_id systemType skillName skillVersion submittedAt status score")
    .lean();

  return reports.map((report) => ({
    report_id: String(report._id),
    system_type: report.systemType,
    skill_name: report.skillName,
    skill_version: report.skillVersion,
    submitted_at: report.submittedAt,
    status: report.status,
    score: report.score ?? null,
  }));
}

export async function getCloudWatcherReport(accountId: string, reportId: string) {
  if (!Types.ObjectId.isValid(reportId)) return null;

  const report = await CloudWatcherReport.findOne({ _id: reportId, accountId }).lean();
  if (!report) return null;

  const agent = await CloudWatcherAgent.findOne({ _id: report.agentRef, accountId }).lean();
  const testResults = await CloudWatcherReportTestResult.find({ reportRef: report._id })
    .sort({ createdAt: 1 })
    .lean();

  // Convert Mongoose Map → plain object so it serialises cleanly as JSON.
  const categoryScoresMap = report.categoryScores;
  const category_scores: Record<string, number> =
    categoryScoresMap instanceof Map
      ? Object.fromEntries(categoryScoresMap)
      : categoryScoresMap && typeof categoryScoresMap === "object"
        ? (categoryScoresMap as Record<string, number>)
        : {};

  return {
    report_id: String(report._id),
    agent_id: agent?.agentId || null,
    system_type: report.systemType,
    skill_name: report.skillName,
    skill_version: report.skillVersion,
    submitted_at: report.submittedAt,
    status: report.status,
    score: report.score ?? null,
    /** Evidence-adjusted score per category (0..1). Empty for reports scored before this feature. */
    category_scores,
    /** Actual score cap applied by the backend (0..1). null means no cap was triggered. */
    applied_score_cap: report.appliedScoreCap ?? null,
    /** Raw score before harness cap. When this differs from score, the cap is the reason. */
    raw_score_before_cap: report.rawScoreBeforeCap ?? null,
    raw_report_json: report.rawReportJson,
    test_results: testResults.map((result) => ({
      id: String(result._id),
      category: result.category,
      test_name: result.testName,
      input: result.input,
      output: result.output,
      pass_fail_status: result.passFailStatus,
      notes: result.notes,
      latency_ms: result.latencyMs ?? undefined,
      cost_usd: result.costUsd ?? undefined,
      citations: result.citations,
      tool_calls: result.toolCalls,
      metadata: result.metadata ?? undefined,
    })),
  };
}
