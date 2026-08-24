import { Plan } from "../../../models/plan.model";
import { badRequest, notFound } from "../../../core/errors";
import type { PlanInput } from "./plans.types";

const KEY_RE = /^[a-z0-9][a-z0-9_-]*$/;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export async function listPlans() {
  return Plan.find({}).sort({ price: 1, createdAt: 1 }).lean();
}

export async function getPlan(key: string) {
  const plan = await Plan.findOne({ key: normalizeKey(key) });
  if (!plan) throw notFound(`Plan '${key}' not found`);
  return plan;
}

export async function createPlan(input: PlanInput) {
  if (!input.key || !input.name) {
    throw badRequest("A plan needs a key and a name");
  }
  const key = normalizeKey(input.key);
  if (!KEY_RE.test(key)) {
    throw badRequest(
      "Plan key must be lowercase letters, numbers, hyphen or underscore",
    );
  }
  if (await Plan.exists({ key })) {
    throw badRequest(`A plan with key '${key}' already exists`);
  }

  return Plan.create({
    key,
    name: input.name.trim(),
    description: input.description ?? null,
    price: input.price ?? 0,
    currency: input.currency ?? "USD",
    billingPeriod: input.billingPeriod ?? "monthly",
    features: input.features ?? {},
    limits: input.limits ?? {},
    isPublic: input.isPublic ?? true,
    isActive: input.isActive ?? true,
  });
}

export async function updatePlan(key: string, input: PlanInput) {
  const plan = await getPlan(key);

  if (input.name !== undefined) plan.name = input.name.trim();
  if (input.description !== undefined) plan.description = input.description;
  if (input.price !== undefined) plan.price = input.price;
  if (input.currency !== undefined) plan.currency = input.currency;
  if (input.billingPeriod !== undefined) plan.billingPeriod = input.billingPeriod;
  if (input.isPublic !== undefined) plan.isPublic = input.isPublic;
  if (input.isActive !== undefined) plan.isActive = input.isActive;
  if (input.features !== undefined) {
    plan.features = new Map(Object.entries(input.features));
  }
  if (input.limits !== undefined) {
    plan.limits = { ...plan.limits, ...input.limits };
  }

  await plan.save();
  return plan;
}

export async function deletePlan(key: string) {
  const plan = await getPlan(key);
  await plan.deleteOne();
  return { key: plan.key };
}
