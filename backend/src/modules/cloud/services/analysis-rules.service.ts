// Rule-based infrastructure analysis — runs in milliseconds, no AI needed.
// Generates recommendations, diagnosis, and optimizations from raw metrics + inventory.

import { FactSheetResult } from "../../../data/fact-builder";
import { SERVICE_REGISTRY, CostRule } from "../../../data/service-registry";

export interface Recommendation {
    id: string;
    title: string;
    description: string;
    impact: "high" | "medium" | "low";
    category: "cost" | "performance" | "security" | "reliability";
    savings: string;
    action: string;
}

export interface Diagnosis {
    title: string;
    status: "healthy" | "warning" | "critical";
    details: string;
}

export interface Optimization {
    id: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
    savings: string;
    action: string;
}

export interface Insights {
    recommendations: Recommendation[];
    diagnosis: Diagnosis[];
    optimizations: Optimization[];
}

// Get estimated monthly cost for a service from billing breakdown
function getServiceCost(rawData: Record<string, any>, serviceKeyword: string): number {
    const breakdown = rawData.billing?.mtd?.breakdown || [];
    const found = breakdown.find((b: any) => b.service?.toLowerCase().includes(serviceKeyword.toLowerCase()));
    return found?.amount || 0;
}

// Estimate per-resource cost from total service cost and resource count
function perResourceCost(serviceCost: number, count: number): number {
    return count > 0 ? serviceCost / count : 0;
}

// Format savings string
function fmtSavings(dollars: number): string {
    return `$${Math.max(0, Math.round(dollars))}/mo`;
}

export function analyzeRules(rawData: Record<string, any>, facts: any[]): Insights {
    const recs: Recommendation[] = [];
    const diag: Diagnosis[] = [];
    const opts: Optimization[] = [];
    let recId = 1;
    let optId = 1;

    const inventory = rawData.inventory;
    const mtdTotal = rawData.billing?.mtd?.total || 0;
    const ec2Cost = getServiceCost(rawData, "EC2");
    const rdsCost = getServiceCost(rawData, "RDS");
    const lambdaCost = getServiceCost(rawData, "Lambda");
    const ebsCost = getServiceCost(rawData, "EBS");
    const s3Cost = getServiceCost(rawData, "Amazon S3");
    const ec2PerInstance = perResourceCost(ec2Cost, inventory?.counts?.ec2 || 0);
    const rdsPerInstance = perResourceCost(rdsCost, inventory?.counts?.rds || 0);

    // ═══════════════════════════════════════════════════════
    // EC2 Analysis
    // ═══════════════════════════════════════════════════════
    for (const inst of (inventory?.ec2 || [])) {
        const cpuStats = rawData[`ec2_${inst.id}_cpu`];
        const id = inst.id;
        const name = inst.name || id;
        const cpuAvg = cpuStats?.avg ?? null;
        const statusCheck = rawData[`ec2_${id}_status_check`];

        // Idle detection
        if (cpuAvg !== null && cpuAvg < 2) {
            const saving = Math.round(ec2PerInstance * 0.8 * 100) / 100;
            recs.push({
                id: `rec-${recId++}`,
                title: `Stop idle EC2 instance "${name}"`,
                description: `Instance ${name} (${id}) has avg CPU ${cpuAvg.toFixed(1)}% over 7 days. It's essentially idle, wasting ~$${saving}/mo.`,
                impact: "high",
                category: "cost",
                savings: fmtSavings(saving),
                action: `aws ec2 stop-instances --instance-ids ${id}`,
            });
            opts.push({
                id: `opt-${optId++}`,
                title: `Terminate "${name}" after snapshot`,
                description: `Create a snapshot then terminate ${name}. Re-launch only when needed. Saves full instance cost.`,
                priority: "high",
                effort: "medium",
                savings: fmtSavings(ec2PerInstance),
                action: `aws ec2 create-image --instance-id ${id} --name backup-${id}`,
            });
        } else if (cpuAvg !== null && cpuAvg < 15) {
            const saving = Math.round(ec2PerInstance * 0.4 * 100) / 100;
            recs.push({
                id: `rec-${recId++}`,
                title: `Right-size underutilized EC2 "${name}"`,
                description: `Instance ${name} (${id}) avg CPU ${cpuAvg.toFixed(1)}%. Consider downsizing to save ~40%.`,
                impact: "medium",
                category: "cost",
                savings: fmtSavings(saving),
                action: `Navigate to EC2 → ${name} → Actions → Instance State → Stop, then change instance type.`,
            });
        }

        // High CPU
        if (cpuAvg !== null && cpuAvg > 80) {
            recs.push({
                id: `rec-${recId++}`,
                title: `High CPU on EC2 "${name}" — performance risk`,
                description: `Instance ${name} (${id}) avg CPU ${cpuAvg.toFixed(1)}%. Risk of throttling and degraded performance.`,
                impact: "high",
                category: "performance",
                savings: "$0/mo",
                action: `Review application performance, consider Auto Scaling or larger instance type.`,
            });
        }

        // Status check failures
        if (statusCheck && statusCheck.max > 0) {
            recs.push({
                id: `rec-${recId++}`,
                title: `EC2 "${name}" has status check failures`,
                description: `Instance ${name} (${id}) reported ${statusCheck.max.toFixed(0)} failed status checks. Possible OS or hardware issue.`,
                impact: "high",
                category: "reliability",
                savings: "$0/mo",
                action: `Check EC2 console → ${name} → Status checks tab. Consider reboot or replace instance.`,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // RDS Analysis
    // ═══════════════════════════════════════════════════════
    for (const db of (inventory?.rds || [])) {
        const connStats = rawData[`rds_${db.id}_connections`];
        const cpuStats = rawData[`rds_${db.id}_cpu`];
        const name = db.id;
        const connAvg = connStats?.avg ?? null;
        const rdsCpuAvg = cpuStats?.avg ?? null;

        // Zero connections → unused
        if (connAvg !== null && connAvg === 0) {
            recs.push({
                id: `rec-${recId++}`,
                title: `Stop unused RDS instance "${name}"`,
                description: `RDS ${name} has 0 connections over 7 days. It's unused but still running.`,
                impact: "high",
                category: "cost",
                savings: fmtSavings(rdsPerInstance),
                action: `aws rds stop-db-instance --db-instance-identifier ${name}`,
            });
        }

        // Low CPU → right-size
        if (rdsCpuAvg !== null && rdsCpuAvg < 10 && connAvg !== null && connAvg > 0) {
            const saving = Math.round(rdsPerInstance * 0.3 * 100) / 100;
            recs.push({
                id: `rec-${recId++}`,
                title: `Right-size underutilized RDS "${name}"`,
                description: `RDS ${name} avg CPU ${rdsCpuAvg.toFixed(1)}% with active connections. Consider smaller instance class.`,
                impact: "medium",
                category: "cost",
                savings: fmtSavings(saving),
                action: `Review RDS console → ${name} → Modify → choose smaller instance class.`,
            });
        }

        // High CPU
        if (rdsCpuAvg !== null && rdsCpuAvg > 80) {
            recs.push({
                id: `rec-${recId++}`,
                title: `High CPU on RDS "${name}" — performance risk`,
                description: `RDS ${name} avg CPU ${rdsCpuAvg.toFixed(1)}%. Risk of slow queries and connection timeouts.`,
                impact: "high",
                category: "performance",
                savings: "$0/mo",
                action: `Review slow query log, add read replicas, or upgrade instance class.`,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // EBS Analysis
    // ═══════════════════════════════════════════════════════
    for (const vol of (inventory?.ebs || [])) {
        const name = vol.id;
        // Unattached volumes
        if (vol.attachedTo === "unattached" || vol.attachedTo === "none" || !vol.attachedTo) {
            recs.push({
                id: `rec-${recId++}`,
                title: `Delete orphaned EBS volume "${name}"`,
                description: `EBS volume ${name} (${vol.size || "?"}GB, ${vol.volumeType || "unknown"}) is not attached to any instance.`,
                impact: "medium",
                category: "cost",
                savings: fmtSavings(perResourceCost(ebsCost, inventory?.counts?.ebs || 1)),
                action: `aws ec2 delete-volume --volume-id ${name}`,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // Lambda Analysis
    // ═══════════════════════════════════════════════════════
    for (const fn of (inventory?.lambda || [])) {
        const invStats = rawData[`lambda_${fn.name}_invocations`];
        const errStats = rawData[`lambda_${fn.name}_errors`];
        const durStats = rawData[`lambda_${fn.name}_duration`];
        const name = fn.name;
        const invocations = invStats?.avg ?? null;
        const errors = errStats?.avg ?? null;
        const duration = durStats?.avg ?? null;

        // High error rate
        if (invocations !== null && invocations > 10 && errors !== null && errors > invocations * 0.05) {
            recs.push({
                id: `rec-${recId++}`,
                title: `High error rate on Lambda "${name}"`,
                description: `Lambda ${name} has ${errors.toFixed(0)} errors out of ${invocations.toFixed(0)} invocations (${((errors / invocations) * 100).toFixed(1)}% error rate).`,
                impact: "high",
                category: "reliability",
                savings: fmtSavings(perResourceCost(lambdaCost, inventory?.counts?.lambda || 1) * 0.1),
                action: `Check CloudWatch Logs → /aws/lambda/${name} → review error patterns.`,
            });
        }

        // Never invoked
        if (invocations !== null && invocations === 0) {
            recs.push({
                id: `rec-${recId++}`,
                title: `Unused Lambda function "${name}"`,
                description: `Lambda ${name} has 0 invocations over 7 days. Consider if it's still needed.`,
                impact: "low",
                category: "cost",
                savings: fmtSavings(perResourceCost(lambdaCost, inventory?.counts?.lambda || 1)),
                action: `Review Lambda → ${name}. Delete if no longer needed.`,
            });
        }

        // Long duration
        if (duration !== null && duration > 3000) {
            opts.push({
                id: `opt-${optId++}`,
                title: `Optimize slow Lambda "${name}"`,
                description: `Lambda ${name} avg duration ${duration.toFixed(0)}ms. Consider increasing memory (faster CPU) or refactoring.`,
                priority: "medium",
                effort: "medium",
                savings: fmtSavings(perResourceCost(lambdaCost, inventory?.counts?.lambda || 1) * 0.2),
                action: `Lambda → ${name} → Configuration → General configuration → Edit → increase memory.`,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // S3 Analysis
    // ═══════════════════════════════════════════════════════
    for (const bucket of (inventory?.s3 || [])) {
        const name = bucket.name;
        opts.push({
            id: `opt-${optId++}`,
            title: `Add lifecycle policy to S3 "${name}"`,
            description: `Configure S3 lifecycle rules to transition old objects to Glacier/S3 IA, reducing storage costs.`,
            priority: "low",
            effort: "low",
            savings: fmtSavings(perResourceCost(s3Cost, inventory?.counts?.s3 || 1) * 0.15),
            action: `S3 → ${name} → Management → Lifecycle rules → Create rule.`,
        });
    }

    // ═══════════════════════════════════════════════════════
    // ECS Analysis
    // ═══════════════════════════════════════════════════════
    for (const svc of (inventory?.ecs || [])) {
        const cpuStats = rawData[`ecs_${svc.name || svc.serviceName}_cpu`];
        if (cpuStats?.avg != null && cpuStats.avg < 10) {
            recs.push({
                id: `rec-${recId++}`,
                title: `Low CPU on ECS service "${svc.name || svc.serviceName}"`,
                description: `ECS service avg CPU ${cpuStats.avg.toFixed(1)}%. Consider reducing desired task count or task CPU/memory.`,
                impact: "medium",
                category: "cost",
                savings: fmtSavings(perResourceCost(getServiceCost(rawData, "ECS"), inventory?.counts?.ecs || 1) * 0.3),
                action: `ECS → ${svc.cluster} → ${svc.name || svc.serviceName} → Update → reduce desired count or task definition.`,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // Security Diagnosis
    // ═══════════════════════════════════════════════════════
    const security = rawData.security;
    if (security) {
        if (security.threats?.status?.includes("Access Denied")) {
            diag.push({
                title: "GuardDuty",
                status: "warning",
                details: "Cannot access GuardDuty. IAM role lacks permissions.",
            });
        } else if (security.threats?.count > 0) {
            diag.push({
                title: "GuardDuty",
                status: "critical",
                details: `${security.threats.count} active threats detected.`,
            });
        } else {
            diag.push({ title: "GuardDuty", status: "healthy", details: "No active threats." });
        }

        if (security.iam?.mfaStatus && !security.iam.mfaStatus.includes("Access Denied")) {
            if (security.iam.mfaStatus.includes("No MFA") || security.iam.mfaStatus.includes("Disabled")) {
                diag.push({
                    title: "IAM MFA",
                    status: "critical",
                    details: security.iam.mfaStatus,
                });
            } else {
                diag.push({ title: "IAM MFA", status: "healthy", details: security.iam.mfaStatus });
            }
        }

        if (security.compliance?.providerStatus && !security.compliance.providerStatus.includes("Access Denied")) {
            if (security.compliance.highRiskFindings > 0) {
                diag.push({
                    title: "SecurityHub",
                    status: "warning",
                    details: `${security.compliance.highRiskFindings} high/critical findings.`,
                });
            } else {
                diag.push({ title: "SecurityHub", status: "healthy", details: "No critical findings." });
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // VPS Log Analysis
    // ═══════════════════════════════════════════════════════
    const vpsLogs = rawData.vpsLogs;
    if (vpsLogs) {
        const errors = Number(vpsLogs?.totals?.errors || 0);
        const windowHours = Number(vpsLogs?.windowHours || 24);
        if (errors > 100) {
            diag.push({
                title: "VPS Application Errors",
                status: "warning",
                details: `${errors} errors in ${windowHours}h. Review top errors for patterns.`,
            });
        } else if (errors > 0) {
            diag.push({
                title: "VPS Application Errors",
                status: "healthy",
                details: `${errors} errors in ${windowHours}h. Within normal range.`,
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // Billing Health
    // ═══════════════════════════════════════════════════════
    if (mtdTotal > 0) {
        const forecast = rawData.billing?.forecast?.amount || 0;
        const projected = mtdTotal + forecast;
        diag.push({
            title: "Monthly Spend",
            status: "healthy",
            details: `$${mtdTotal.toFixed(2)} MTD, ~$${projected.toFixed(2)} projected for the month.`,
        });

        // Cost drivers to watch
        const breakdown = rawData.billing?.mtd?.breakdown || [];
        const topService = breakdown[0];
        if (topService && mtdTotal > 0 && (topService.amount / mtdTotal) > 0.5) {
            diag.push({
                title: "Cost Concentration",
                status: "warning",
                details: `${topService.service} accounts for ${((topService.amount / mtdTotal) * 100).toFixed(0)}% of spend ($${topService.amount.toFixed(2)}). High concentration risk.`,
            });
        }
    }

    // Infrastructure health summary
    if (inventory) {
        const total = inventory.counts?.total || 0;
        diag.push({
            title: "Infrastructure Scan",
            status: "healthy",
            details: `${total} active resources scanned across ${inventory.counts.ec2 || 0} EC2, ${inventory.counts.lambda || 0} Lambda, ${inventory.counts.rds || 0} RDS, ${inventory.counts.s3 || 0} S3.`,
        });
    }

    // Sort recommendations by impact
    recs.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.impact] - order[b.impact];
    });

    return { recommendations: recs, diagnosis: diag, optimizations: opts };
}
