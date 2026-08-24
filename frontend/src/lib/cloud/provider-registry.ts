import type { CloudProvider } from "@/lib/regions";
import type { CloudProviderCapabilities } from "./provider-status";

export type CloudProviderLifecycleStatus = "available" | "partial" | "planned";

export type ProviderServiceSignal = {
    label: string;
    value: string;
    href: string;
    accent: string;
};

export type CloudProviderDefinition = {
    id: CloudProvider;
    label: string;
    shortLabel: string;
    status: CloudProviderLifecycleStatus;
    defaultRegion: string;
    globalRegion: string;
    setupHref: string;
    setupObject: string;
    accountName: string;
    connectTitle: string;
    metricsSource: string;
    alarmLabel: string;
    logSetupLabel: string;
    defaultCapabilities: CloudProviderCapabilities;
    serviceSignals: ProviderServiceSignal[];
};

const unavailableCapabilities: CloudProviderCapabilities = {
    inventory: "unavailable",
    metrics: "unavailable",
    logs: "unavailable",
    billing: "unavailable",
    security: "unavailable",
    insights: "unavailable",
};

export const CLOUD_PROVIDER_IDS = ["aws", "azure", "gcp"] as const satisfies readonly CloudProvider[];

export const CLOUD_PROVIDER_REGISTRY: Record<CloudProvider, CloudProviderDefinition> = {
    aws: {
        id: "aws",
        label: "Amazon Web Services",
        shortLabel: "AWS",
        status: "available",
        defaultRegion: "ap-south-1",
        globalRegion: "all",
        setupHref: "/settings/aws",
        setupObject: "CloudFormation stack",
        accountName: "AWS account",
        connectTitle: "AWS Account Not Connected",
        metricsSource: "CloudWatch",
        alarmLabel: "CloudWatch Alarms",
        logSetupLabel: "CloudWatch log groups",
        defaultCapabilities: {
            inventory: "ready",
            metrics: "ready",
            logs: "setup_required",
            billing: "ready",
            security: "ready",
            insights: "ready",
        },
        serviceSignals: [
            { label: "Compute", value: "EC2 / Lambda", href: "/dashboards/ec2", accent: "#1A56DB" },
            { label: "Data", value: "RDS / S3", href: "/dashboards/rds", accent: "#06B6D4" },
            { label: "Security", value: "Security Hub / IAM", href: "/dashboards/security", accent: "#22C55E" },
            { label: "FinOps", value: "Cost Explorer", href: "/dashboards/cost", accent: "#F97316" },
        ],
    },
    azure: {
        id: "azure",
        label: "Microsoft Azure",
        shortLabel: "Azure",
        status: "partial",
        defaultRegion: "centralindia",
        globalRegion: "all",
        setupHref: "/settings/azure",
        setupObject: "ARM deployment",
        accountName: "Azure subscription",
        connectTitle: "Azure Subscription Not Connected",
        metricsSource: "Azure Monitor",
        alarmLabel: "Azure Alert Rules",
        logSetupLabel: "Azure Activity Logs",
        defaultCapabilities: {
            inventory: "ready",
            metrics: "ready",
            logs: "limited",
            billing: "limited",
            security: "limited",
            insights: "limited",
        },
        serviceSignals: [
            { label: "Compute", value: "VMs / Functions", href: "/dashboards/ec2", accent: "#1A56DB" },
            { label: "Data", value: "Azure SQL / Storage", href: "/dashboards/rds", accent: "#06B6D4" },
            { label: "Security", value: "Defender / IAM", href: "/dashboards/security", accent: "#22C55E" },
            { label: "FinOps", value: "Cost Management", href: "/dashboards/cost", accent: "#F97316" },
        ],
    },
    gcp: {
        id: "gcp",
        label: "Google Cloud Platform",
        shortLabel: "GCP",
        status: "partial",
        defaultRegion: "asia-south1",
        globalRegion: "all",
        setupHref: "/settings/gcp",
        setupObject: "service account",
        accountName: "GCP project",
        connectTitle: "GCP Project Not Connected",
        metricsSource: "Cloud Monitoring",
        alarmLabel: "Cloud Monitoring Alert Policies",
        logSetupLabel: "Cloud Logging",
        defaultCapabilities: unavailableCapabilities,
        serviceSignals: [
            { label: "Compute", value: "Compute Engine / Cloud Run", href: "/dashboards/ec2", accent: "#1A56DB" },
            { label: "Data", value: "Cloud SQL / Storage", href: "/dashboards/rds", accent: "#06B6D4" },
            { label: "Security", value: "SCC / IAM", href: "/dashboards/security", accent: "#22C55E" },
            { label: "FinOps", value: "Billing Export", href: "/dashboards/cost", accent: "#F97316" },
        ],
    },
};

export function getCloudProviderDefinition(provider: CloudProvider): CloudProviderDefinition {
    return CLOUD_PROVIDER_REGISTRY[provider] || CLOUD_PROVIDER_REGISTRY.aws;
}

export function getCloudProviderIds(): CloudProvider[] {
    return [...CLOUD_PROVIDER_IDS];
}

export function isCloudProvider(value: string | undefined): value is CloudProvider {
    return !!value && Object.prototype.hasOwnProperty.call(CLOUD_PROVIDER_REGISTRY, value);
}
