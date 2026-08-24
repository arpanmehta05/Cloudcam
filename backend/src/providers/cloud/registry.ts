import { CloudProvider, CloudProviderAdapter, CloudProviderDefinition } from "./types";

export const CLOUD_PROVIDER_IDS = ["aws", "azure", "gcp"] as const satisfies readonly CloudProvider[];

const unavailableCapabilities: CloudProviderDefinition["defaultCapabilities"] = {
    inventory: "unavailable",
    metrics: "unavailable",
    logs: "unavailable",
    billing: "unavailable",
    security: "unavailable",
    insights: "unavailable",
};

const providers: Record<CloudProvider, CloudProviderAdapter> = {
    aws: {
        definition: {
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
            defaultCapabilities: {
                inventory: "ready",
                metrics: "ready",
                logs: "setup_required",
                billing: "ready",
                security: "ready",
                insights: "ready",
            },
        },
    },
    azure: {
        definition: {
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
            defaultCapabilities: {
                inventory: "ready",
                metrics: "ready",
                logs: "limited",
                billing: "limited",
                security: "limited",
                insights: "limited",
            },
        },
    },
    gcp: {
        definition: {
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
            defaultCapabilities: unavailableCapabilities,
        },
    },
};

export function isCloudProvider(value: string | undefined): value is CloudProvider {
    return !!value && Object.prototype.hasOwnProperty.call(providers, value);
}

export function getCloudProvider(provider: CloudProvider): CloudProviderAdapter {
    return providers[provider];
}

export function getCloudProviderDefinitions(): CloudProviderDefinition[] {
    return Object.values(providers).map(provider => provider.definition);
}

export function getCloudProviderIds(): CloudProvider[] {
    return [...CLOUD_PROVIDER_IDS];
}
