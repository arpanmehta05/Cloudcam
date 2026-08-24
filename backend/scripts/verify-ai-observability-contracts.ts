import assert from "node:assert/strict";
import { estimateCost } from "../src/config/ai-pricing";
import { AiDataset } from "../src/models/ai-dataset.model";
import { AiRequestLog } from "../src/models/ai-request-log.model";
import { AiTraceSpan } from "../src/models/ai-trace-span.model";
import { AiTrace } from "../src/models/ai-trace.model";
import { HumanFeedback } from "../src/models/human-feedback.model";
import { CustomModelPrice } from "../src/models/custom-model-price.model";
import { resolveModelCost } from "../src/modules/ai-observability/services/custom-pricing.service";
import { mapOtelToTraceEnvelopes } from "../src/modules/ai-observability/services/ingestion/otel-mapper";
import { normalizePromptMetadata } from "../src/modules/ai-observability/services/ingestion/prompt-metadata";
import { listObservations } from "../src/modules/ai-observability/services/observation-query.service";
import { PromptTemplate } from "../src/models/prompt-template.model";
import { PromptVersion } from "../src/models/prompt-version.model";
import { diffLines, diffPromptVersions } from "../src/modules/prompts/services/registry/prompt-diff.service";
import { buildPromptMetricsPipeline } from "../src/modules/prompts/services/registry/prompt-metrics.service";
import { resolvePrompt } from "../src/modules/prompts/services/registry/prompt-registry.service";
import { attachPromptPreviews } from "../src/services/ai-trace-preview.service";
import { getTraceDetail } from "../src/services/ai-trace-query.service";
import {
  exportDatasetRows,
  hashDatasetInput,
  rowsToCsv,
  validateDatasetRows,
} from "../src/modules/data-engine/services/dataset-item.service";
import { buildCostAttributionPipeline } from "../src/modules/ai-observability/services/cost-attribution.service";
import { sanitizeAuditMetadata } from "../src/modules/ai-observability/services/audit.service";
import { computeRetentionCutoffs } from "../src/modules/ai-observability/services/retention.service";
import { extractMentions } from "../src/modules/ai-observability/services/comments.service";
import { isProtectedLabel } from "../src/modules/prompts/services/registry/prompt-approval.service";
import {
  computeNextRetryDelayMs,
  signWebhookPayload,
  webhookMatchesEvent,
} from "../src/modules/ai-observability/services/webhooks.service";
import { isReportViewable } from "../src/modules/ai-observability/services/shared-reports.service";
import { levenshtein, runCodeEvaluator } from "../src/modules/evaluations/services/code-evaluator.service";
import { evaluatorMatchesTrace } from "../src/modules/evaluations/services/evaluator-registry.service";
import { analyzeJudgeCalibration } from "../src/modules/evaluations/services/llm-judge-calibration.service";
import {
  compareCandidates,
  evaluateCiGate,
} from "../src/modules/evaluations/services/experiments/ci-gate.service";
import { analyzeExperimentRegression } from "../src/modules/evaluations/services/experiments/regression-analysis.service";

type ChainResult<T> = {
  lean: () => Promise<T>;
  sort?: (sort: unknown) => ChainResult<T>;
  select?: (projection: unknown) => ChainResult<T>;
  limit?: (limit: number) => ChainResult<T>;
};

type ModelPatch = {
  model: Record<string, unknown>;
  key: string;
  original: unknown;
};

const patches: ModelPatch[] = [];

function chain<T>(value: T, onCall?: (method: string, arg: unknown) => void): ChainResult<T> {
  const result: ChainResult<T> = {
    lean: async () => value,
    sort: (sort) => {
      onCall?.("sort", sort);
      return result;
    },
    select: (projection) => {
      onCall?.("select", projection);
      return result;
    },
    limit: (limit) => {
      onCall?.("limit", limit);
      return result;
    },
  };
  return result;
}

function patch(model: Record<string, unknown>, key: string, replacement: unknown) {
  patches.push({ model, key, original: model[key] });
  model[key] = replacement;
}

function restorePatches() {
  while (patches.length) {
    const item = patches.pop();
    if (item) item.model[item.key] = item.original;
  }
}

async function verifyPromptAndOtelMapping() {
  const prompt = normalizePromptMetadata(
    { metadata: { prompt: { name: "checkout-summary", label: "prod" } } },
    { prompt: { version: "3", hash: "abc123" } },
  );
  assert.equal(prompt.promptName, "checkout-summary");
  assert.equal(prompt.promptLabel, "prod");
  assert.equal(prompt.promptVersion, "3");
  assert.equal(prompt.promptHash, "abc123");

  const envelopes = mapOtelToTraceEnvelopes({
    resourceSpans: [{
      resource: { attributes: [{ key: "service.name", value: { stringValue: "checkout-api" } }] },
      scopeSpans: [{
        scope: { name: "smoke" },
        spans: [{
          traceId: "trace-otel",
          spanId: "span-1",
          name: "chat.completion",
          startTimeUnixNano: "1700000000000000000",
          endTimeUnixNano: "1700000000500000000",
          attributes: [
            { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
            { key: "gen_ai.system", value: { stringValue: "openai" } },
            { key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
            { key: "gen_ai.usage.input_tokens", value: { intValue: "120" } },
            { key: "gen_ai.usage.output_tokens", value: { intValue: "40" } },
            { key: "prompt.name", value: { stringValue: "checkout-summary" } },
          ],
        }],
      }],
    }],
  });
  assert.equal(envelopes.length, 1);
  assert.equal(envelopes[0].trace.traceId, "trace-otel");
  assert.equal(envelopes[0].spans?.[0]?.kind, "llm");
  assert.equal(envelopes[0].spans?.[0]?.provider, "openai");
  assert.equal(envelopes[0].spans?.[0]?.promptTokens, 120);
  assert.equal(envelopes[0].spans?.[0]?.prompt?.name, "checkout-summary");
}

async function verifyPricingContract() {
  patch(CustomModelPrice as unknown as Record<string, unknown>, "find", () => chain([
    {
      _id: "price-1",
      modelName: "gpt-4o",
      provider: "openai",
      inputPricePerMToken: 1,
      outputPricePerMToken: 2,
      matchPattern: "exact",
    },
  ]));
  const custom = await resolveModelCost({
    userId: "user-1",
    provider: "openai",
    modelName: "gpt-4o",
    promptTokens: 1_000_000,
    completionTokens: 500_000,
  });
  assert.equal(custom.pricingSource, "custom");
  assert.equal(custom.unpriced, false);
  assert.equal(custom.cost, 2);

  restorePatches();
  patch(CustomModelPrice as unknown as Record<string, unknown>, "find", () => chain([]));
  const defaultPrice = await resolveModelCost({
    userId: "user-1",
    provider: "openai",
    modelName: "gpt-4o",
    promptTokens: 1000,
    completionTokens: 500,
  });
  assert.equal(defaultPrice.pricingSource, "default");
  assert.equal(defaultPrice.unpriced, false);

  const unknown = await resolveModelCost({
    userId: "user-1",
    provider: "unknown",
    modelName: "mystery-model",
    promptTokens: 1000,
    completionTokens: 500,
  });
  assert.equal(unknown.pricingSource, "unpriced");
  assert.equal(unknown.unpriced, true);
  assert.equal(unknown.cost, 0);

  const staticPrice = estimateCost("openai", "gpt-4o", 1000, 500);
  assert.equal(staticPrice.estimated, true);
  assert.ok(staticPrice.cost > 0);
}

async function verifyObservationQueryContract() {
  const calls: Array<[string, unknown]> = [];
  patch(AiTraceSpan as unknown as Record<string, unknown>, "find", (match: unknown) => {
    calls.push(["find", match]);
    return chain([
      {
        _id: "span-doc",
        traceId: "trace-1",
        spanId: "span-1",
        startedAt: new Date("2026-07-03T00:00:00.000Z"),
      },
    ], (method, arg) => calls.push([method, arg]));
  });

  const result = await listObservations(
    { userId: "user-1", workspaceId: "workspace-1" },
    {
      traceId: "trace-1",
      kind: "llm",
      promptName: "checkout-summary",
      minCost: "0.01",
      fields: "core,usage",
      limit: "1",
    },
  );
  const match = calls.find(([method]) => method === "find")?.[1] as Record<string, unknown>;
  const projection = calls.find(([method]) => method === "select")?.[1];
  assert.equal(match.userId, "user-1");
  assert.equal(match.workspaceId, "workspace-1");
  assert.equal(match.traceId, "trace-1");
  assert.equal(match.kind, "llm");
  assert.deepEqual(match.cost, { $gte: 0.01 });
  assert.equal(projection, "_id traceId spanId parentSpanId name kind status level startedAt durationMs promptTokens completionTokens totalTokens cost completionStartTime");
  assert.equal(result.observations.length, 1);
  assert.equal(result.nextCursor, null);
}

async function verifyTraceDetailContract() {
  patch(AiTrace as unknown as Record<string, unknown>, "findOne", () => chain({
    _id: "trace-doc",
    userId: "user-1",
    traceId: "trace-1",
    status: "success",
  }));
  patch(AiTraceSpan as unknown as Record<string, unknown>, "find", () => chain([{
    spanId: "span-1",
    traceId: "trace-1",
    kind: "llm",
  }]));
  patch(AiRequestLog as unknown as Record<string, unknown>, "find", () => chain([{
    requestId: "trace-1:span-1",
    traceId: "trace-1",
    spanId: "span-1",
  }]));
  patch(HumanFeedback as unknown as Record<string, unknown>, "find", () => chain([{
    _id: "score-1",
    traceId: "trace-1",
    spanId: "span-1",
    score: 92,
  }]));
  patch(AiDataset as unknown as Record<string, unknown>, "find", () => chain([{
    _id: "dataset-1",
    name: "Golden traces",
    items: [{
      requestId: "trace-1:span-1",
      createdAt: new Date("2026-07-03T00:00:00.000Z"),
      source: {
        traceId: "trace-1",
        spanId: "span-1",
        observationKind: "llm",
        createdFrom: "observation",
      },
    }],
  }]));

  const detail = await getTraceDetail({ userId: "user-1" }, "trace-1");
  assert.ok(detail);
  assert.equal(detail?.spans.length, 1);
  assert.equal(detail?.requests.length, 1);
  assert.equal(detail?.scores.length, 1);
  assert.equal(detail?.datasetLineage.length, 1);
  assert.equal(detail?.datasetLineage[0].datasetName, "Golden traces");
}

async function verifyTracePromptPreviewContract() {
  patch(AiTraceSpan as unknown as Record<string, unknown>, "find", () => chain([
    {
      traceId: "trace-1",
      spanId: "span-tool",
      kind: "tool",
      inputPreview: "tool payload",
      outputPreview: "tool result",
    },
    {
      traceId: "trace-1",
      spanId: "span-llm",
      kind: "llm",
      provider: "openai",
      modelName: "gpt-4o",
      inputPreview: "actual user prompt",
      outputPreview: "assistant response",
    },
  ]));
  patch(AiRequestLog as unknown as Record<string, unknown>, "find", () => chain([
    {
      traceId: "trace-2",
      requestId: "req-1",
      provider: "anthropic",
      modelName: "claude-sonnet",
      inputPreview: "request log prompt",
      outputPreview: "request log output",
    },
  ]));

  const rows = await attachPromptPreviews(
    { userId: "user-1" },
    [{ traceId: "trace-1" }, { traceId: "trace-2" }],
  );

  assert.equal(rows[0].promptPreview, "actual user prompt");
  assert.equal(rows[0].previewSource?.spanId, "span-llm");
  assert.equal(rows[0].previewSource?.provider, "openai");
  assert.equal(rows[1].promptPreview, "request log prompt");
  assert.equal(rows[1].previewSource?.requestId, "req-1");
}

async function verifyPromptDiffContract() {
  const lines = diffLines("hello\nworld", "hello\nthere\nworld");
  assert.deepEqual(lines, [
    { type: "same", text: "hello" },
    { type: "added", text: "there" },
    { type: "same", text: "world" },
  ]);

  const diff = diffPromptVersions(
    {
      version: "1.0.0",
      state: "production",
      environment: "prod",
      template: "Summarize {{order}}",
      systemPrompt: "Be terse.",
      variables: ["order"],
      contentHash: "sha256_a",
      providerDefaults: { model: "gpt-4o", temperature: 0.7 },
    } as never,
    {
      version: "1.1.0",
      state: "draft",
      environment: "prod",
      template: "Summarize {{order}} for {{customer}}",
      systemPrompt: "Be terse.",
      variables: ["order", "customer"],
      contentHash: "sha256_b",
      providerDefaults: { model: "gpt-4o-mini", temperature: 0.7 },
    } as never,
  );
  assert.equal(diff.identical, false);
  assert.deepEqual(diff.variableChanges.added, ["customer"]);
  assert.deepEqual(diff.variableChanges.removed, []);
  assert.equal(diff.configChanges.length, 1);
  assert.equal(diff.configChanges[0].field, "model");
  assert.ok(diff.template.some((line) => line.type === "added"));
  assert.ok(diff.systemPrompt.every((line) => line.type === "same"));
}

async function verifyPromptLabelResolveContract() {
  patch(PromptTemplate as unknown as Record<string, unknown>, "findOne", () => chain({
    _id: "template-1",
    slug: "checkout-summary",
    status: "active",
    defaultEnvironment: "prod",
    labels: { staging: "1.2.0" },
  }));
  const versionCalls: Array<Record<string, unknown>> = [];
  patch(PromptVersion as unknown as Record<string, unknown>, "findOne", (match: Record<string, unknown>) => {
    versionCalls.push(match);
    return chain({ _id: "version-1", version: "1.2.0", state: "draft", environment: "prod" });
  });

  const resolved = await resolvePrompt({ userId: "user-1" }, "checkout-summary", { label: "staging" });
  assert.equal(resolved.version.version, "1.2.0");
  assert.equal(versionCalls[0].version, "1.2.0");

  await assert.rejects(
    () => resolvePrompt({ userId: "user-1" }, "checkout-summary", { label: "missing-label" }),
    /No version bound to label/,
  );
}

async function verifyPromptMetricsPipelineContract() {
  const since = new Date("2026-07-01T00:00:00.000Z");
  const pipeline = buildPromptMetricsPipeline(
    { userId: "user-1", workspaceId: "workspace-1" },
    "checkout-summary",
    since,
  );
  const match = (pipeline[0] as { $match: Record<string, unknown> }).$match;
  assert.equal(match.userId, "user-1");
  assert.equal(match.workspaceId, "workspace-1");
  assert.equal(match.promptSlug, "checkout-summary");
  assert.deepEqual(match.startedAt, { $gte: since });
  const group = (pipeline[1] as { $group: Record<string, unknown> }).$group;
  assert.deepEqual(group._id, { version: "$promptVersion", label: "$promptLabel" });
}

async function verifyDatasetItemContract() {
  const { valid, errors } = validateDatasetRows(
    [
      { inputPrompt: "Question 1", expectedOutput: "Answer 1", split: "regression" },
      { inputPrompt: "", expectedOutput: "no input" },
      { inputPrompt: "Question 2", expectedOutput: "" },
      { inputPrompt: "Question 3", expectedOutput: "Answer 3", tags: "a, b" },
    ],
    "train",
  );
  assert.equal(valid.length, 2);
  assert.equal(errors.length, 2);
  assert.equal(valid[0].split, "regression");
  assert.deepEqual(valid[1].tags, ["a", "b"]);
  assert.equal(valid[0].inputHash, hashDatasetInput("Question 1"));

  // Deterministic hashing enables duplicate detection.
  assert.equal(hashDatasetInput("dup"), hashDatasetInput("dup"));
  assert.notEqual(hashDatasetInput("a"), hashDatasetInput("b"));

  const rows = exportDatasetRows(
    {
      items: [
        {
          inputPrompt: "in-a",
          correctedOutput: "out-a",
          split: "train",
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        } as never,
        {
          inputPrompt: "in-b",
          correctedOutput: "out-b",
          split: "regression",
          createdAt: new Date("2026-07-02T00:00:00.000Z"),
        } as never,
      ],
    },
    "regression",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].input, "in-b");

  const csv = rowsToCsv([{ index: 0, input: "hello, world", expectedOutput: 'quote "x"', tags: ["a", "b"] }]);
  const lines = csv.split("\n");
  assert.ok(lines[0].startsWith("index,input,expectedOutput"));
  assert.ok(lines[1].includes('"hello, world"'));
  assert.ok(lines[1].includes('"quote ""x"""'));
}

async function verifyCodeEvaluatorContract() {
  assert.equal(runCodeEvaluator("exact_match", "Hello", "hello", { caseSensitive: false }).passed, true);
  assert.equal(runCodeEvaluator("exact_match", "Hello", "world").passed, false);
  assert.equal(runCodeEvaluator("contains", "the quick brown fox", "", { pattern: "quick" }).passed, true);
  assert.equal(runCodeEvaluator("regex", "order-12345", "", { pattern: "^order-\\d+$" }).passed, true);
  assert.equal(runCodeEvaluator("regex", "bad", "", { pattern: "[" }).passed, false);
  assert.equal(runCodeEvaluator("json_valid", '{"a":1}', "").passed, true);
  assert.equal(runCodeEvaluator("json_valid", "not json", "").passed, false);
  assert.equal(
    runCodeEvaluator("json_equals", '{"a":1,"b":2}', '{"b":2,"a":1}').passed,
    true,
  );
  assert.equal(
    runCodeEvaluator("json_equals", '{"x":{"y":5}}', '{"x":{"y":9}}', { path: "x" }).passed,
    false,
  );
  assert.equal(
    runCodeEvaluator("json_equals", '{"x":{"y":5},"t":1}', '{"x":{"y":5},"t":2}', { path: "x" }).passed,
    true,
  );
  assert.equal(runCodeEvaluator("numeric_range", " 42 ", "", { min: 0, max: 100 }).passed, true);
  assert.equal(runCodeEvaluator("numeric_range", "150", "", { min: 0, max: 100 }).passed, false);

  assert.equal(levenshtein("kitten", "sitting"), 3);
  const sim = runCodeEvaluator("levenshtein_similarity", "colour", "color", { threshold: 0.8 });
  assert.equal(sim.passed, true);
  assert.ok(sim.score >= 80);
  const dissim = runCodeEvaluator("levenshtein_similarity", "abc", "xyz", { threshold: 0.8 });
  assert.equal(dissim.passed, false);
}

function makeRun(candidateKey: string, scores: Array<number | null>, latency = 100, cost = 0.001) {
  return {
    candidateKey,
    items: scores.map((score, itemIndex) => ({
      itemIndex,
      status: score === null ? "failed" : "completed",
      judgeScore: score,
      latencyMs: latency,
      cost: { total: cost },
    })),
  } as never;
}

async function verifyCiGateContract() {
  const runs = [
    makeRun("baseline", [90, 80, 85]),
    makeRun("candidate", [95, 92, 88]),
  ];
  const comparison = compareCandidates(runs);
  const candidate = comparison.find((row) => row.candidateKey === "candidate");
  assert.ok(candidate);
  assert.equal(candidate?.avgScore, 92);
  assert.equal(candidate?.passRate, 1);

  const gate = evaluateCiGate(runs, { minPassRate: 0.9, minAvgScore: 90, maxAvgLatencyMs: 200 });
  assert.equal(gate.passed, true);
  assert.equal(gate.candidateKey, "candidate");
  assert.equal(gate.winner?.candidateKey, "candidate");

  const failing = evaluateCiGate(runs, { minAvgScore: 99 });
  assert.equal(failing.passed, false);
  assert.ok(failing.checks.some((check) => check.name === "min_avg_score" && !check.passed));

  // Regression against baseline.
  const regressed = evaluateCiGate(
    [makeRun("baseline", [95, 95]), makeRun("candidate", [70, 70])],
    { baselineCandidateKey: "baseline", maxScoreRegression: 5 },
  );
  assert.equal(regressed.passed, false);
}

async function verifyRegressionAnalysisContract() {
  const analysis = analyzeExperimentRegression(
    [
      makeRun("baseline", [95, 94, 96], 100, 0.001),
      makeRun("candidate", [70, 72, 68, null], 900, 0.01),
      makeRun("safe", [94, 95, 93], 120, 0.001),
    ],
    "baseline",
  );
  assert.equal(analysis.baselineCandidateKey, "baseline");
  assert.equal(analysis.summary.risk, "high");
  assert.equal(analysis.summary.regressionCount, 1);
  const candidate = analysis.candidates.find((row) => row.candidateKey === "candidate");
  assert.ok(candidate);
  assert.equal(candidate?.risk, "high");
  assert.ok(candidate?.signals.some((signal) => signal.name === "score_regression"));
  assert.ok(candidate?.signals.some((signal) => signal.name === "pass_rate_regression"));
  const safe = analysis.candidates.find((row) => row.candidateKey === "safe");
  assert.equal(safe?.risk, "low");
}

async function verifyEvaluatorMatchingContract() {
  const evaluator = {
    status: "active" as const,
    online: { enabled: true, samplingRate: 0.5, triggers: [], maxCostPerDay: null },
    scope: { environments: ["prod"], providers: [], models: [], prompts: [], endpoints: [], tags: [] },
  };
  // In-scope + roll below sampling rate → matches.
  assert.equal(evaluatorMatchesTrace(evaluator, { environment: "prod" }, 0.1), true);
  // Roll above sampling rate → no match.
  assert.equal(evaluatorMatchesTrace(evaluator, { environment: "prod" }, 0.9), false);
  // Out of environment scope → no match.
  assert.equal(evaluatorMatchesTrace(evaluator, { environment: "dev" }, 0.1), false);
  // Disabled → no match.
  assert.equal(
    evaluatorMatchesTrace({ ...evaluator, online: { ...evaluator.online, enabled: false } }, { environment: "prod" }, 0.1),
    false,
  );
  // Error trigger fires regardless of sampling roll.
  const errorEval = {
    ...evaluator,
    online: { enabled: true, samplingRate: 0, triggers: ["error"], maxCostPerDay: null },
  };
  assert.equal(evaluatorMatchesTrace(errorEval, { environment: "prod", status: "error" }, 0.99), true);
  assert.equal(evaluatorMatchesTrace(errorEval, { environment: "prod", status: "success" }, 0.0), false);
}

async function verifyJudgeCalibrationContract() {
  const calibrated = analyzeJudgeCalibration(
    [
      { judgeScore: 90, humanScore: 88 },
      { judgeScore: 75, humanScore: 78 },
      { judgeScore: 60, humanScore: 62 },
      { judgeScore: 85, humanScore: 82 },
      { judgeScore: 72, humanScore: 70 },
    ],
    { minSampleSize: 5, maxMeanAbsoluteError: 5, maxBias: 3, minAgreementRate: 0.8 },
  );
  assert.equal(calibrated.calibrated, true);
  assert.equal(calibrated.sampleCount, 5);
  assert.equal(calibrated.agreementRate, 1);
  assert.ok(calibrated.pearsonCorrelation !== null);

  const weak = analyzeJudgeCalibration(
    [
      { judgeScore: 95, humanScore: 40 },
      { judgeScore: 90, humanScore: 50 },
    ],
    { minSampleSize: 5, maxMeanAbsoluteError: 5, maxBias: 3, minAgreementRate: 0.8 },
  );
  assert.equal(weak.calibrated, false);
  assert.ok(weak.checks.some((check) => check.name === "min_sample_size" && !check.passed));
  assert.ok(weak.checks.some((check) => check.name === "max_mean_absolute_error" && !check.passed));
}

async function verifyCostAttributionContract() {
  const since = new Date("2026-06-01T00:00:00.000Z");
  const promptPipeline = buildCostAttributionPipeline(
    { userId: "user-1", workspaceId: "ws-1" },
    "prompt",
    since,
    25,
  );
  const match = (promptPipeline[0] as { $match: Record<string, unknown> }).$match;
  assert.equal(match.userId, "user-1");
  assert.equal(match.workspaceId, "ws-1");
  assert.deepEqual(match.startedAt, { $gte: since });
  // Prompt dimension requires a non-null promptSlug.
  assert.deepEqual(match.promptSlug, { $ne: null });
  const group = (promptPipeline[1] as { $group: Record<string, any> }).$group;
  assert.deepEqual(group._id, { slug: "$promptSlug", version: "$promptVersion", label: "$promptLabel" });
  assert.equal((promptPipeline[3] as { $limit: number }).$limit, 25);

  const userPipeline = buildCostAttributionPipeline({ userId: "user-1" }, "user", since);
  const userMatch = (userPipeline[0] as { $match: Record<string, unknown> }).$match;
  assert.deepEqual(userMatch.endUserId, { $ne: null });
  assert.equal(userMatch.workspaceId, undefined);
}

async function verifyGovernanceContract() {
  const sanitized = sanitizeAuditMetadata({
    prefix: "rw_live_ab",
    apiKey: "secret-value",
    nested: { token: "xyz", scopes: ["traces:write"] },
    scopes: ["traces:write"],
  });
  assert.equal(sanitized?.prefix, "rw_live_ab");
  assert.equal(sanitized?.apiKey, "[redacted]");
  assert.equal((sanitized?.nested as Record<string, unknown>).token, "[redacted]");
  assert.deepEqual((sanitized?.nested as Record<string, unknown>).scopes, ["traces:write"]);
  assert.equal(sanitizeAuditMetadata(null), null);

  const now = new Date("2026-07-03T00:00:00.000Z").getTime();
  const cutoffs = computeRetentionCutoffs(
    { rawPayloadDays: 30, traceMetadataDays: 90, scoreDays: 365, exportDays: 7 },
    now,
  );
  assert.equal(cutoffs.rawPayload.toISOString(), new Date(now - 30 * 86400000).toISOString());
  assert.equal(cutoffs.traceMetadata.toISOString(), new Date(now - 90 * 86400000).toISOString());
  assert.equal(cutoffs.score.toISOString(), new Date(now - 365 * 86400000).toISOString());
  // Raw payloads are cleared before metadata rows are deleted.
  assert.ok(cutoffs.rawPayload.getTime() > cutoffs.traceMetadata.getTime());
}

async function verifyCommentMentionContract() {
  // De-duplicates, preserves first-seen order, strips '@', ignores single-char.
  assert.deepEqual(
    extractMentions("cc @alice and @bob.smith, wdyt @alice? @x is too short"),
    ["alice", "bob.smith"],
  );
  assert.deepEqual(extractMentions("no mentions here"), []);
  assert.deepEqual(extractMentions(""), []);
  assert.deepEqual(extractMentions("email me at foo@bar please"), ["bar"]);
}

async function verifyPromptApprovalContract() {
  assert.equal(isProtectedLabel("production"), true);
  assert.equal(isProtectedLabel("PROD"), true);
  assert.equal(isProtectedLabel(" Live "), true);
  assert.equal(isProtectedLabel("staging"), false);
  assert.equal(isProtectedLabel("dev"), false);
}

async function verifyWebhookContract() {
  // Signature is deterministic and HMAC-based over `${ts}.${body}`.
  const sig = signWebhookPayload("whsec_test", 1000, "{\"a\":1}");
  assert.ok(sig.startsWith("sha256="));
  assert.equal(sig, signWebhookPayload("whsec_test", 1000, "{\"a\":1}"));
  assert.notEqual(sig, signWebhookPayload("whsec_test", 1001, "{\"a\":1}"));
  assert.notEqual(sig, signWebhookPayload("other", 1000, "{\"a\":1}"));

  // Exponential backoff, capped at 1h.
  assert.equal(computeNextRetryDelayMs(1), 1000);
  assert.equal(computeNextRetryDelayMs(2), 3000);
  assert.equal(computeNextRetryDelayMs(3), 9000);
  assert.equal(computeNextRetryDelayMs(20), 60 * 60 * 1000);

  // Wildcard and exact matching.
  assert.equal(webhookMatchesEvent(["*"], "trace.ingested"), true);
  assert.equal(webhookMatchesEvent(["prompt.deployed"], "prompt.deployed"), true);
  assert.equal(webhookMatchesEvent(["prompt.deployed"], "trace.error"), false);
}

async function verifySharedReportContract() {
  const now = 1_000_000;
  assert.equal(isReportViewable({ revoked: false, expiresAt: null }, now), true);
  assert.equal(isReportViewable({ revoked: true, expiresAt: null }, now), false);
  assert.equal(isReportViewable({ revoked: false, expiresAt: new Date(now + 1000) }, now), true);
  assert.equal(isReportViewable({ revoked: false, expiresAt: new Date(now - 1000) }, now), false);
}

async function main() {
  try {
    await verifyPromptAndOtelMapping();
    restorePatches();
    await verifyPricingContract();
    restorePatches();
    await verifyObservationQueryContract();
    restorePatches();
    await verifyTraceDetailContract();
    restorePatches();
    await verifyTracePromptPreviewContract();
    restorePatches();
    await verifyPromptDiffContract();
    await verifyPromptLabelResolveContract();
    restorePatches();
    await verifyPromptMetricsPipelineContract();
    await verifyDatasetItemContract();
    await verifyCodeEvaluatorContract();
    await verifyCiGateContract();
    await verifyRegressionAnalysisContract();
    await verifyEvaluatorMatchingContract();
    await verifyJudgeCalibrationContract();
    await verifyCostAttributionContract();
    await verifyGovernanceContract();
    await verifyCommentMentionContract();
    await verifyPromptApprovalContract();
    await verifyWebhookContract();
    await verifySharedReportContract();
    console.log("ai-observability-contracts-ok");
  } finally {
    restorePatches();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
