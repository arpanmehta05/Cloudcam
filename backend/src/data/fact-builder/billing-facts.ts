import { Fact } from "./helpers";

export function buildBillingFacts(
  inventory: any,
  rawData: any,
  billingResults: any,
  startFactId: number,
  needsBilling: boolean,
): { facts: Fact[]; nextFactId: number } {
  const facts: Fact[] = [];
  let factId = startFactId;

  // 1. Process Billing Facts
  if (needsBilling && billingResults.status === "fulfilled" && billingResults.value) {
    const [mtdCost, forecast] = billingResults.value as any;
    rawData["billing"] = { mtd: mtdCost, forecast };
    facts.push({
      id: `FACT-${factId++}`,
      type: "billing",
      content: `Total Month-to-Date Spend: $${mtdCost.total.toFixed(2)} USD (${mtdCost.period.start} to ${mtdCost.period.end}).`,
      source: "AWS Cost Explorer (MTD)",
      value: mtdCost.total,
      unit: "USD",
    });
    if (forecast) {
      const projectedTotal = mtdCost.total + forecast.amount;
      facts.push({
        id: `FACT-${factId++}`,
        type: "billing",
        content: `Cost Forecast: Projected end-of-month ~$${projectedTotal.toFixed(2)} USD.`,
        source: "AWS Cost Explorer (Forecast)",
        value: projectedTotal,
        unit: "USD",
      });
    }
    mtdCost.breakdown.slice(0, 5).forEach((item: any) => {
      facts.push({
        id: `FACT-${factId++}`,
        type: "billing",
        content: `Cost Driver: ${item.service} = $${item.amount.toFixed(2)} (${mtdCost.total > 0 ? ((item.amount / mtdCost.total) * 100).toFixed(1) : 0}% of total).`,
        source: "AWS Cost Explorer",
      });
    });
  }

  // 2. Process Calculated Savings Facts
  if (inventory && rawData["billing"]?.mtd?.total > 0) {
    for (const inst of inventory.ec2 || []) {
      const cpuStats = rawData[`ec2_${inst.id}_cpu`];
      if (cpuStats && cpuStats.avg < 5) {
        const ec2Billing =
          rawData["billing"]?.mtd?.breakdown?.find((b: any) =>
            b.service?.includes("EC2"),
          )?.amount || 0;
        const cost = ec2Billing / (inventory.counts.ec2 || 1);
        facts.push({
          id: `FACT-${factId++}`,
          type: "calculated",
          content: `SAVINGS: EC2 "${inst.name || inst.id}" (${inst.id}) avg CPU ${cpuStats.avg.toFixed(1)}% -- idle. ~$${cost.toFixed(2)}/mo saveable.`,
          source: "Rabbittize Analysis",
          resourceId: inst.id,
          resourceType: "ec2",
          value: cost,
          unit: "USD/mo",
        });
      }
    }
    for (const db of inventory.rds || []) {
      const connStats = rawData[`rds_${db.id}_connections`];
      if (connStats && connStats.avg === 0 && connStats.max === 0) {
        const rdsBilling =
          rawData["billing"]?.mtd?.breakdown?.find((b: any) =>
            b.service?.includes("RDS"),
          )?.amount || 0;
        const cost = rdsBilling / (inventory.counts.rds || 1);
        facts.push({
          id: `FACT-${factId++}`,
          type: "calculated",
          content: `SAVINGS: RDS "${db.id}" has 0 connections -- unused. ~$${cost.toFixed(2)}/mo saveable.`,
          source: "Rabbittize Analysis",
          resourceId: db.id,
          resourceType: "rds",
          value: cost,
          unit: "USD/mo",
        });
      }
    }
  }

  return { facts, nextFactId: factId };
}
