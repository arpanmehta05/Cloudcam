import { AppError } from "../../../core/errors";
import { estimateCost } from "../../../config/ai-pricing";
import { AiRequestLog, type AiPricingSource } from "../../../models/ai-request-log.model";
import { CustomModelPrice } from "../../../models/custom-model-price.model";
import type { FeedbackScope } from "../services/feedback.service";

export interface CustomPriceInput {
  modelName?: string;
  provider?: string;
  inputPricePerMToken?: number;
  outputPricePerMToken?: number;
  matchPattern?: "exact" | "prefix" | "regex";
  isActive?: boolean;
}

export interface ResolvedModelCost {
  cost: number;
  estimated: boolean;
  pricingSource: AiPricingSource;
  unpriced: boolean;
  customPriceId?: string;
  matchPattern?: "exact" | "prefix" | "regex";
}

function validate(input: CustomPriceInput) {
  if (!input.modelName?.trim()) throw new AppError({ code: "ERR_BAD_REQUEST", message: "modelName is required", status: 400 });
  if (!input.provider?.trim()) throw new AppError({ code: "ERR_BAD_REQUEST", message: "provider is required", status: 400 });
  validatePriceInput(input);
}

function validatePriceInput(input: CustomPriceInput) {
  if (input.inputPricePerMToken !== undefined && input.inputPricePerMToken < 0) {
    throw new AppError({ code: "ERR_BAD_REQUEST", message: "inputPricePerMToken must be non-negative", status: 400 });
  }
  if (input.outputPricePerMToken !== undefined && input.outputPricePerMToken < 0) {
    throw new AppError({ code: "ERR_BAD_REQUEST", message: "outputPricePerMToken must be non-negative", status: 400 });
  }
  if (input.matchPattern === "regex" && input.modelName) {
    try {
      new RegExp(input.modelName);
    } catch {
      throw new AppError({ code: "ERR_BAD_REQUEST", message: "modelName must be a valid regex when matchPattern is regex", status: 400 });
    }
  }
}

export async function listCustomPrices(scope: FeedbackScope) {
  const prices = await CustomModelPrice.find({ userId: scope.userId }).sort({ provider: 1, modelName: 1 }).lean();
  return { prices };
}

export async function createCustomPrice(scope: FeedbackScope, input: CustomPriceInput) {
  validate(input);
  const price = await CustomModelPrice.create({
    userId: scope.userId,
    tenantId: scope.tenantId || null,
    workspaceId: scope.workspaceId || null,
    modelName: input.modelName?.trim(),
    provider: input.provider?.trim(),
    inputPricePerMToken: input.inputPricePerMToken ?? 0,
    outputPricePerMToken: input.outputPricePerMToken ?? 0,
    matchPattern: input.matchPattern || "exact",
    isActive: input.isActive ?? true,
  });
  return { price };
}

export async function updateCustomPrice(scope: FeedbackScope, id: string, input: CustomPriceInput) {
  validatePriceInput(input);
  const price = await CustomModelPrice.findOneAndUpdate(
    { _id: id, userId: scope.userId },
    { $set: input },
    { new: true },
  );
  if (!price) throw new AppError({ code: "ERR_NOT_FOUND", message: "Custom price not found", status: 404 });
  return { price };
}

export async function deleteCustomPrice(scope: FeedbackScope, id: string) {
  const price = await CustomModelPrice.findOneAndUpdate(
    { _id: id, userId: scope.userId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!price) throw new AppError({ code: "ERR_NOT_FOUND", message: "Custom price not found", status: 404 });
  return { price };
}

export async function estimateCustomCost(input: {
  userId: string;
  workspaceId?: string | null;
  provider: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
}): Promise<ResolvedModelCost | null> {
  const prices = await CustomModelPrice.find({
    userId: input.userId,
    provider: input.provider,
    isActive: true,
    $or: [{ workspaceId: input.workspaceId || null }, { workspaceId: null }],
  }).sort({ workspaceId: -1, updatedAt: -1 }).lean();
  const price = prices.find((item) => {
    if (item.matchPattern === "exact") return item.modelName === input.modelName;
    if (item.matchPattern === "prefix") return input.modelName.startsWith(item.modelName);
    try {
      return new RegExp(item.modelName).test(input.modelName);
    } catch {
      return false;
    }
  });
  if (!price) return null;
  return {
    cost: Math.round((
      (input.promptTokens / 1_000_000) * price.inputPricePerMToken +
      (input.completionTokens / 1_000_000) * price.outputPricePerMToken
    ) * 1_000_000) / 1_000_000,
    estimated: true,
    pricingSource: "custom",
    unpriced: false,
    customPriceId: String(price._id),
    matchPattern: price.matchPattern,
  };
}

export async function resolveModelCost(input: {
  userId: string;
  workspaceId?: string | null;
  provider: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  precomputedCost?: number | null;
  pricingSource?: AiPricingSource | null;
  pricingEstimated?: boolean | null;
  unpriced?: boolean | null;
}): Promise<ResolvedModelCost> {
  // An app that *explicitly* declares its cost authoritative (pricingSource
  // "provided" or "custom") is trusted verbatim. A bare `cost` with no declared
  // source is NOT trusted over the platform's own rate tables — otherwise a
  // wrong number sent by the instrumented app would override everything and
  // roll up the trace. Compute from tokens whenever we can price the model.
  const hasPrecomputed = input.precomputedCost !== undefined && input.precomputedCost !== null;
  const authoritative = input.pricingSource === "provided" || input.pricingSource === "custom";
  if (hasPrecomputed && authoritative) {
    return {
      cost: input.precomputedCost as number,
      estimated: input.pricingEstimated ?? input.pricingSource !== "unpriced",
      pricingSource: input.pricingSource as AiPricingSource,
      unpriced: input.unpriced ?? input.pricingSource === "unpriced",
    };
  }

  const custom = await estimateCustomCost(input);
  if (custom) return custom;

  const fallback = estimateCost(input.provider, input.modelName, input.promptTokens, input.completionTokens);
  if (fallback.estimated) {
    return {
      cost: fallback.cost,
      estimated: true,
      pricingSource: "default",
      unpriced: false,
    };
  }

  // Model isn't in any price table. Fall back to whatever cost the app sent
  // (better than showing $0) before finally marking the span unpriced.
  if (hasPrecomputed) {
    return {
      cost: input.precomputedCost as number,
      estimated: input.pricingEstimated ?? false,
      pricingSource: input.pricingSource || "provided",
      unpriced: input.unpriced ?? false,
    };
  }

  return {
    cost: 0,
    estimated: false,
    pricingSource: "unpriced",
    unpriced: true,
  };
}

export async function listUnpricedModels(scope: FeedbackScope, limit = 20) {
  const cap = Math.min(Math.max(limit, 1), 100);
  const rows = await AiRequestLog.aggregate([
    {
      $match: {
        userId: scope.userId,
        ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
        ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
        unpriced: true,
      },
    },
    {
      $group: {
        _id: { provider: "$provider", model: "$modelName" },
        requests: { $sum: 1 },
        tokens: { $sum: "$totalTokens" },
        firstSeenAt: { $min: "$createdAt" },
        lastSeenAt: { $max: "$createdAt" },
        traceIds: { $addToSet: "$traceId" },
      },
    },
    { $sort: { lastSeenAt: -1, tokens: -1, requests: -1 } },
    { $limit: cap },
    {
      $project: {
        _id: 0,
        provider: "$_id.provider",
        model: "$_id.model",
        requests: 1,
        tokens: 1,
        firstSeenAt: 1,
        lastSeenAt: 1,
        traceIds: { $slice: ["$traceIds", 5] },
      },
    },
  ]);
  return { models: rows };
}
