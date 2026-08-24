import type { RiskLevel } from "../models/action.model";

export type ActionTier = 1 | 2 | 3 | 4;

export interface ActionDefinition {
  id: string;
  displayName: string;
  description: string;
  service: string;
  tier: ActionTier;
  riskLevel: RiskLevel;
  reversible: boolean;
  downtimeWarning?: string;
  requiredPermissions: string[];
  blastRadiusLimit: number; // max targets per execution
  requiresSnapshot?: boolean; // EBS snapshot before delete, etc.
}

// ─── TIER 1: Low Risk ───
const TIER_1_ACTIONS: ActionDefinition[] = [
  {
    id: "live-service-canvas-opened",
    displayName: "Open Live Service Canvas",
    description:
      "UI Navigation Action - Represents opening a live infrastructure visualization.",
    service: "ui",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
  {
    id: "live-region-selector-opened",
    displayName: "Open Live Region Selector",
    description:
      "UI audit event for opening the live infrastructure region selector.",
    service: "ui",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
  {
    id: "live-resource-selected",
    displayName: "Select Live Resource",
    description: "UI audit event for selecting a live infrastructure resource.",
    service: "ui",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
  {
    id: "live-action-confirmation-opened",
    displayName: "Open Live Action Confirmation",
    description:
      "UI audit event for opening a live action confirmation dialog.",
    service: "ui",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
  {
    id: "live-region-filter-changed",
    displayName: "Change Live Region Filter",
    description:
      "UI audit event for changing the live infrastructure region filter.",
    service: "ui",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
  {
    id: "live-service-canvas-synced",
    displayName: "Sync Live Service Canvas",
    description: "UI audit event for syncing live service canvas inventory.",
    service: "ui",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
  {
    id: "live-infrastructure-synced",
    displayName: "Sync Live Infrastructure",
    description: "UI audit event for syncing live infrastructure inventory.",
    service: "ui",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
  {
    id: "ec2-stop-idle",
    displayName: "Stop Idle EC2 Instances",
    description:
      "Stop EC2 instances with sustained low CPU (<10%) to eliminate wasted compute costs.",
    service: "ec2",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: ["ec2:StopInstances", "ec2:DescribeInstances"],
    blastRadiusLimit: 10,
  },
  {
    id: "s3-lifecycle",
    displayName: "Apply S3 Lifecycle Policy",
    description:
      "Add Intelligent-Tiering or Glacier transition rules to reduce storage costs.",
    service: "s3",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [
      "s3:PutLifecycleConfiguration",
      "s3:GetLifecycleConfiguration",
    ],
    blastRadiusLimit: 5,
  },
  {
    id: "ebs-snapshot",
    displayName: "Create EBS Snapshot",
    description: "Create a point-in-time snapshot of an EBS volume for backup.",
    service: "ebs",
    tier: 1,
    riskLevel: "low",
    reversible: false,
    requiredPermissions: ["ec2:CreateSnapshot", "ec2:DescribeVolumes"],
    blastRadiusLimit: 10,
  },
  {
    id: "rds-snapshot",
    displayName: "Create RDS Snapshot",
    description:
      "Create a manual snapshot of an RDS database instance for backup.",
    service: "rds",
    tier: 1,
    riskLevel: "low",
    reversible: false,
    requiredPermissions: ["rds:CreateDBSnapshot", "rds:DescribeDBInstances"],
    blastRadiusLimit: 5,
  },
  {
    id: "dynamodb-autoscale",
    displayName: "Enable DynamoDB Auto-Scaling",
    description:
      "Enable application auto-scaling on DynamoDB table read/write capacity.",
    service: "dynamodb",
    tier: 1,
    riskLevel: "low",
    reversible: true,
    requiredPermissions: [
      "application-autoscaling:RegisterScalableTarget",
      "application-autoscaling:PutScalingPolicy",
      "dynamodb:DescribeTable",
    ],
    blastRadiusLimit: 5,
  },
];

// ─── TIER 2: Medium Risk ───
const TIER_2_ACTIONS: ActionDefinition[] = [
  {
    id: "ec2-stop",
    displayName: "Stop EC2 Instance",
    description:
      "Stop a specific running EC2 instance. Can be restarted later.",
    service: "ec2",
    tier: 2,
    riskLevel: "medium",
    reversible: true,
    requiredPermissions: ["ec2:StopInstances", "ec2:DescribeInstances"],
    blastRadiusLimit: 5,
  },
  {
    id: "rds-stop",
    displayName: "Stop RDS Instance",
    description:
      "Stop an idle RDS database instance. Automatically restarts after 7 days.",
    service: "rds",
    tier: 2,
    riskLevel: "medium",
    reversible: true,
    downtimeWarning: "Database will be unavailable until restarted.",
    requiredPermissions: ["rds:StopDBInstance", "rds:DescribeDBInstances"],
    blastRadiusLimit: 3,
  },
  {
    id: "ebs-delete",
    displayName: "Delete Unused EBS Volume",
    description:
      "Delete an EBS volume with zero I/O. Requires a snapshot first.",
    service: "ebs",
    tier: 2,
    riskLevel: "medium",
    reversible: false,
    requiresSnapshot: true,
    requiredPermissions: [
      "ec2:DeleteVolume",
      "ec2:DescribeVolumes",
      "ec2:CreateSnapshot",
    ],
    blastRadiusLimit: 5,
  },
  {
    id: "rds-delete-snapshot",
    displayName: "Delete Stale RDS Snapshot",
    description:
      "Delete an old manual or automated RDS snapshot to save costs.",
    service: "rds",
    tier: 2,
    riskLevel: "medium",
    reversible: false,
    requiresSnapshot: false,
    requiredPermissions: ["rds:DeleteDBSnapshot", "rds:DescribeDBSnapshots"],
    blastRadiusLimit: 10,
  },
  {
    id: "s3-delete-bucket",
    displayName: "Delete Empty/Orphaned Target S3 Bucket",
    description:
      "Permanently delete an S3 bucket that has been flagged as orphaned. Warning: Verify it is empty.",
    service: "s3",
    tier: 3,
    riskLevel: "high",
    reversible: false,
    requiresSnapshot: false,
    requiredPermissions: [
      "s3:DeleteBucket",
      "s3:ListBucket",
      "s3:ListBucketVersions",
      "s3:DeleteObject",
      "s3:DeleteObjectVersion",
    ],
    blastRadiusLimit: 3,
  },
  {
    id: "ecs-scale",
    displayName: "Scale ECS Service",
    description:
      "Change the desired task count for an ECS service. Use to scale up or down.",
    service: "ecs",
    tier: 2,
    riskLevel: "medium",
    reversible: true,
    requiredPermissions: ["ecs:UpdateService", "ecs:DescribeServices"],
    blastRadiusLimit: 3,
  },
  {
    id: "asg-spot-migration",
    displayName: "Migrate ASG to Spot Instances",
    description:
      "Update an Auto Scaling Group's Mixed Instances Policy to add Spot capacity, reducing compute costs by up to 90%.",
    service: "ec2",
    tier: 2,
    riskLevel: "medium",
    reversible: true,
    downtimeWarning:
      "Spot Instances can be interrupted with 2-minute notice. Ensure workloads are fault-tolerant.",
    requiredPermissions: [
      "autoscaling:UpdateAutoScalingGroup",
      "autoscaling:DescribeAutoScalingGroups",
    ],
    blastRadiusLimit: 1,
  },
  {
    id: "purchase-savings-plan",
    displayName: "Purchase Savings Plan (Advisory)",
    description:
      "Generates a Savings Plan or Reserved Instance purchase recommendation. This is advisory only — no AWS changes are made.",
    service: "billing",
    tier: 1,
    riskLevel: "low",
    reversible: false,
    requiredPermissions: [],
    blastRadiusLimit: 1,
  },
];

// ─── TIER 3: High Risk ───
const TIER_3_ACTIONS: ActionDefinition[] = [
  {
    id: "ec2-rightsize",
    displayName: "Right-size EC2 Instance",
    description:
      "Change instance type to match actual utilization. Requires a stop/start cycle.",
    service: "ec2",
    tier: 3,
    riskLevel: "high",
    reversible: true,
    downtimeWarning:
      "Instance will be stopped and restarted with the new type. Expect 2-5 minutes of downtime. Public IP may change if not using Elastic IP.",
    requiredPermissions: [
      "ec2:ModifyInstanceAttribute",
      "ec2:StopInstances",
      "ec2:StartInstances",
      "ec2:DescribeInstances",
    ],
    blastRadiusLimit: 3,
  },
  {
    id: "lambda-optimize",
    displayName: "Optimize Lambda Memory",
    description:
      "Adjust Lambda memory allocation based on actual usage patterns.",
    service: "lambda",
    tier: 3,
    riskLevel: "high",
    reversible: true,
    requiredPermissions: [
      "lambda:UpdateFunctionConfiguration",
      "lambda:GetFunctionConfiguration",
    ],
    blastRadiusLimit: 5,
  },
  {
    id: "rds-resize",
    displayName: "Resize RDS Instance",
    description:
      "Change the RDS instance class to match workload. Causes brief downtime during modification.",
    service: "rds",
    tier: 3,
    riskLevel: "high",
    reversible: true,
    downtimeWarning:
      "Database will experience brief downtime during instance class change. Apply during maintenance window.",
    requiredPermissions: ["rds:ModifyDBInstance", "rds:DescribeDBInstances"],
    blastRadiusLimit: 1,
  },
];

// ─── TIER 4: Critical ───
const TIER_4_ACTIONS: ActionDefinition[] = [
  {
    id: "ec2-terminate",
    displayName: "Terminate EC2 Instance",
    description:
      "Permanently terminate an EC2 instance. This action is IRREVERSIBLE. All data on instance store volumes will be lost.",
    service: "ec2",
    tier: 4,
    riskLevel: "critical",
    reversible: false,
    requiredPermissions: ["ec2:TerminateInstances", "ec2:DescribeInstances"],
    blastRadiusLimit: 1,
  },
];

// ─── Registry ───
export const ACTION_REGISTRY: Record<string, ActionDefinition> = {};

[
  ...TIER_1_ACTIONS,
  ...TIER_2_ACTIONS,
  ...TIER_3_ACTIONS,
  ...TIER_4_ACTIONS,
].forEach((action) => {
  ACTION_REGISTRY[action.id] = action;
});

export const ALL_ACTIONS = Object.values(ACTION_REGISTRY);

export function getActionById(id: string): ActionDefinition | undefined {
  return ACTION_REGISTRY[id];
}

export function getActionsByService(service: string): ActionDefinition[] {
  return ALL_ACTIONS.filter((a) => a.service === service);
}

export function getActionsByTier(tier: ActionTier): ActionDefinition[] {
  return ALL_ACTIONS.filter((a) => a.tier === tier);
}

export function getActionsByRisk(risk: RiskLevel): ActionDefinition[] {
  return ALL_ACTIONS.filter((a) => a.riskLevel === risk);
}
