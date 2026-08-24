import { User } from "../../../models/user.model";
import { Plan } from "../../../models/plan.model";
import { Subscription } from "../../../models/subscription.model";
import type { IPlanLimits } from "../../../models/plan.model";
import { badRequest, notFound } from "../../../core/errors";
import { resolveEntitlements } from "../entitlements.service";
import { mapToRecord } from "../util";

/** A tenant is a root/owner account (no tenantId, or tenantId === own id). */
function isOwner(u: any): boolean {
  return !u.tenantId || u.tenantId === u._id.toString();
}

function tenantIdOf(u: any): string {
  return u.tenantId || u._id.toString();
}

function cloudCount(u: any): number {
  let n = 0;
  if (u.awsCredentials?.roleArn) n++;
  if (u.azureCredentials?.subscriptionId) n++;
  if (u.gcpCredentials?.projectId) n++;
  return n;
}

export async function listTenants() {
  const [users, subscriptions] = await Promise.all([
    User.find({}).select(
      "name email tenantId createdAt awsCredentials.roleArn azureCredentials.subscriptionId gcpCredentials.projectId",
    ),
    Subscription.find({}).lean(),
  ]);

  const subByTenant = new Map(subscriptions.map((s) => [s.tenantId, s]));
  const seatCounts = new Map<string, number>();
  for (const u of users) {
    const tid = tenantIdOf(u);
    seatCounts.set(tid, (seatCounts.get(tid) || 0) + 1);
  }

  return users.filter(isOwner).map((u) => {
    const tid = tenantIdOf(u);
    const sub = subByTenant.get(tid) as any;
    const overrideCount = Object.keys(
      mapToRecord(sub?.overrides?.features),
    ).length;
    return {
      id: tid,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      seats: seatCounts.get(tid) || 1,
      clouds: cloudCount(u),
      planKey: sub?.planKey ?? null,
      overrides: overrideCount,
    };
  });
}

export async function getTenantDetail(tenantId: string) {
  const owner = await User.findById(tenantId).select("name email tenantId createdAt");
  if (!owner || !isOwner(owner)) throw notFound(`Tenant '${tenantId}' not found`);

  const subscription = await Subscription.findOne({ tenantId });
  const entitlements = await resolveEntitlements(tenantId);

  return {
    tenant: {
      id: tenantId,
      name: owner.name,
      email: owner.email,
      createdAt: owner.createdAt,
    },
    subscription: subscription
      ? {
          planKey: subscription.planKey,
          status: subscription.status,
          overrides: {
            features: Object.fromEntries(
              subscription.overrides?.features || new Map(),
            ),
            limits: subscription.overrides?.limits || {},
          },
        }
      : null,
    entitlements,
  };
}

export async function assignPlan(tenantId: string, planKey: string) {
  if (!planKey) throw badRequest("planKey is required");
  const plan = await Plan.findOne({ key: planKey.trim().toLowerCase() });
  if (!plan) throw notFound(`Plan '${planKey}' not found`);

  const subscription = await Subscription.findOneAndUpdate(
    { tenantId },
    { $set: { planKey: plan.key }, $setOnInsert: { tenantId } },
    { new: true, upsert: true },
  );
  return subscription;
}

export interface OverrideInput {
  features?: Record<string, boolean | null>; // null clears an override
  limits?: IPlanLimits;
}

export async function setOverrides(tenantId: string, input: OverrideInput) {
  const owner = await User.findById(tenantId).select("_id tenantId");
  if (!owner || !isOwner(owner)) throw notFound(`Tenant '${tenantId}' not found`);

  const subscription =
    (await Subscription.findOne({ tenantId })) ||
    new Subscription({ tenantId, planKey: "free" });

  if (input.features) {
    if (!subscription.overrides) {
      subscription.overrides = { features: new Map(), limits: {} } as any;
    }
    const fmap = subscription.overrides.features || new Map<string, boolean>();
    for (const [key, value] of Object.entries(input.features)) {
      if (value === null) fmap.delete(key);
      else fmap.set(key, value);
    }
    subscription.overrides.features = fmap;
  }

  if (input.limits) {
    subscription.overrides.limits = {
      ...subscription.overrides.limits,
      ...input.limits,
    };
  }

  await subscription.save();
  return subscription;
}
