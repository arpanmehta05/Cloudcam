import { Feature } from "../../../models/feature.model";
import { Plan } from "../../../models/plan.model";
import { Subscription } from "../../../models/subscription.model";
import { badRequest, notFound } from "../../../core/errors";
import { mapToRecord } from "../util";

const KEY_RE = /^[a-z0-9][a-z0-9_-]*$/;

export interface FeatureInput {
  key?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

/** List features, each annotated with how many plans/tenants reference it. */
export async function listFeatures() {
  const [features, plans, subscriptions] = await Promise.all([
    Feature.find({}).sort({ createdAt: 1 }).lean(),
    Plan.find({}).select("features").lean(),
    Subscription.find({}).select("overrides.features").lean(),
  ]);

  const onPlans: Record<string, number> = {};
  for (const p of plans) {
    const f = mapToRecord(p.features as any);
    for (const [k, v] of Object.entries(f)) if (v) onPlans[k] = (onPlans[k] || 0) + 1;
  }
  const overrides: Record<string, number> = {};
  for (const s of subscriptions) {
    const f = mapToRecord((s as any).overrides?.features);
    for (const k of Object.keys(f)) overrides[k] = (overrides[k] || 0) + 1;
  }

  return features.map((f) => ({
    ...f,
    onPlans: onPlans[f.key] || 0,
    overrides: overrides[f.key] || 0,
  }));
}

export async function createFeature(input: FeatureInput) {
  if (!input.key || !input.name) {
    throw badRequest("A feature needs a key and a name");
  }
  const key = input.key.trim().toLowerCase();
  if (!KEY_RE.test(key)) {
    throw badRequest(
      "Feature key must be lowercase letters, numbers, hyphen or underscore",
    );
  }
  if (await Feature.exists({ key })) {
    throw badRequest(`A feature with key '${key}' already exists`);
  }
  return Feature.create({
    key,
    name: input.name.trim(),
    description: input.description ?? null,
    isActive: input.isActive ?? true,
  });
}

export async function updateFeature(key: string, input: FeatureInput) {
  const feature = await Feature.findOne({ key: key.trim().toLowerCase() });
  if (!feature) throw notFound(`Feature '${key}' not found`);
  if (input.name !== undefined) feature.name = input.name.trim();
  if (input.description !== undefined) feature.description = input.description;
  if (input.isActive !== undefined) feature.isActive = input.isActive;
  await feature.save();
  return feature;
}
