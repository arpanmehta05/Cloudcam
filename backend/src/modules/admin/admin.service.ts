import { User } from "../../models/user.model";
import { Plan } from "../../models/plan.model";
import { Subscription } from "../../models/subscription.model";

function isOwner(u: any): boolean {
  return !u.tenantId || u.tenantId === u._id.toString();
}

export async function getOverview() {
  const [users, plans, subscriptions] = await Promise.all([
    User.find({}).select("tenantId").lean(),
    Plan.find({}).lean(),
    Subscription.find({ status: { $in: ["active", "trialing"] } }).lean(),
  ]);

  const tenantCount = users.filter(isOwner).length;
  const planByKey = new Map(plans.map((p) => [p.key, p]));

  let mrr = 0;
  let paidTenants = 0;
  let customDeals = 0;
  for (const sub of subscriptions) {
    const plan = planByKey.get(sub.planKey);
    if (!plan) continue;
    if (plan.price > 0) {
      paidTenants++;
      // Normalise yearly to a monthly figure for MRR.
      mrr += plan.billingPeriod === "yearly" ? plan.price / 12 : plan.price;
    }
    if (!plan.isPublic) customDeals++;
  }

  return {
    tenantCount,
    activePlans: plans.filter((p) => p.isActive).length,
    paidTenants,
    customDeals,
    mrr: Math.round(mrr),
    currency: plans[0]?.currency || "USD",
  };
}
