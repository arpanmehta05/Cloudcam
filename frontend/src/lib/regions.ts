// Region constants by cloud provider.
// Used by both the RegionSelector dropdown and the RegionContext.

import { CLOUD_PROVIDER_REGISTRY, getCloudProviderDefinition, isCloudProvider as isRegisteredCloudProvider } from "@/lib/cloud/provider-registry";

export type CloudProvider = "aws" | "azure" | "gcp";

export interface CloudProviderInfo {
    value: CloudProvider;
    label: string;
    shortLabel: string;
    status: "available" | "partial" | "planned";
}

export interface CloudRegionInfo {
    value: string;
    label: string;
    group: string;
    flag: string;
}

export type AWSRegionInfo = CloudRegionInfo;

export interface RegionSelectOption {
    value: string;
    label: string;
}

export const CLOUD_PROVIDERS: CloudProviderInfo[] = Object.values(CLOUD_PROVIDER_REGISTRY).map((provider) => ({
    value: provider.id,
    label: provider.label,
    shortLabel: provider.shortLabel,
    status: provider.status,
}));

export const AWS_REGIONS: CloudRegionInfo[] = [
    { value: "us-east-1", label: "N. Virginia", group: "United States", flag: "US" },
    { value: "us-east-2", label: "Ohio", group: "United States", flag: "US" },
    { value: "us-west-1", label: "N. California", group: "United States", flag: "US" },
    { value: "us-west-2", label: "Oregon", group: "United States", flag: "US" },
    { value: "ap-south-2", label: "Hyderabad", group: "Asia Pacific", flag: "IN" },
    { value: "ap-south-1", label: "Mumbai", group: "Asia Pacific", flag: "IN" },
    { value: "ap-northeast-3", label: "Osaka", group: "Asia Pacific", flag: "JP" },
    { value: "ap-northeast-2", label: "Seoul", group: "Asia Pacific", flag: "KR" },
    { value: "ap-southeast-1", label: "Singapore", group: "Asia Pacific", flag: "SG" },
    { value: "ap-southeast-2", label: "Sydney", group: "Asia Pacific", flag: "AU" },
    { value: "ap-northeast-1", label: "Tokyo", group: "Asia Pacific", flag: "JP" },
    { value: "ca-central-1", label: "Central", group: "Canada", flag: "CA" },
    { value: "eu-central-1", label: "Frankfurt", group: "Europe", flag: "DE" },
    { value: "eu-west-1", label: "Ireland", group: "Europe", flag: "IE" },
    { value: "eu-west-2", label: "London", group: "Europe", flag: "GB" },
    { value: "eu-west-3", label: "Paris", group: "Europe", flag: "FR" },
    { value: "eu-north-1", label: "Stockholm", group: "Europe", flag: "SE" },
    { value: "sa-east-1", label: "Sao Paulo", group: "South America", flag: "BR" },
];

export const AZURE_REGIONS: CloudRegionInfo[] = [
    { value: "eastus", label: "East US", group: "United States", flag: "US" },
    { value: "eastus2", label: "East US 2", group: "United States", flag: "US" },
    { value: "centralus", label: "Central US", group: "United States", flag: "US" },
    { value: "westus2", label: "West US 2", group: "United States", flag: "US" },
    { value: "westus3", label: "West US 3", group: "United States", flag: "US" },
    { value: "canadacentral", label: "Canada Central", group: "Canada", flag: "CA" },
    { value: "brazilsouth", label: "Brazil South", group: "South America", flag: "BR" },
    { value: "northeurope", label: "North Europe", group: "Europe", flag: "IE" },
    { value: "westeurope", label: "West Europe", group: "Europe", flag: "NL" },
    { value: "uksouth", label: "UK South", group: "Europe", flag: "GB" },
    { value: "francecentral", label: "France Central", group: "Europe", flag: "FR" },
    { value: "germanywestcentral", label: "Germany West Central", group: "Europe", flag: "DE" },
    { value: "centralindia", label: "Central India", group: "Asia Pacific", flag: "IN" },
    { value: "southindia", label: "South India", group: "Asia Pacific", flag: "IN" },
    { value: "japaneast", label: "Japan East", group: "Asia Pacific", flag: "JP" },
    { value: "koreacentral", label: "Korea Central", group: "Asia Pacific", flag: "KR" },
    { value: "southeastasia", label: "Southeast Asia", group: "Asia Pacific", flag: "SG" },
    { value: "australiaeast", label: "Australia East", group: "Asia Pacific", flag: "AU" },
];

export const GCP_REGIONS: CloudRegionInfo[] = [
    { value: "us-central1", label: "Iowa", group: "United States", flag: "US" },
    { value: "us-east1", label: "South Carolina", group: "United States", flag: "US" },
    { value: "us-east4", label: "Northern Virginia", group: "United States", flag: "US" },
    { value: "us-west1", label: "Oregon", group: "United States", flag: "US" },
    { value: "us-west2", label: "Los Angeles", group: "United States", flag: "US" },
    { value: "europe-west1", label: "Belgium", group: "Europe", flag: "BE" },
    { value: "europe-west2", label: "London", group: "Europe", flag: "GB" },
    { value: "europe-west3", label: "Frankfurt", group: "Europe", flag: "DE" },
    { value: "europe-west4", label: "Eemshaven", group: "Europe", flag: "NL" },
    { value: "asia-east1", label: "Taiwan", group: "Asia Pacific", flag: "TW" },
    { value: "asia-northeast1", label: "Tokyo", group: "Asia Pacific", flag: "JP" },
    { value: "asia-south1", label: "Mumbai", group: "Asia Pacific", flag: "IN" },
    { value: "asia-southeast1", label: "Singapore", group: "Asia Pacific", flag: "SG" },
    { value: "australia-southeast1", label: "Sydney", group: "Asia Pacific", flag: "AU" },
    { value: "southamerica-east1", label: "São Paulo", group: "South America", flag: "BR" },
    { value: "northamerica-northeast1", label: "Montréal", group: "Canada", flag: "CA" }
];

export const REGION_GROUPS = [
    "United States",
    "Asia Pacific",
    "Canada",
    "Europe",
    "South America",
] as const;

export const DEFAULT_PROVIDER: CloudProvider = "aws";
export const DEFAULT_REGIONS: Record<CloudProvider, string> = {
    aws: getCloudProviderDefinition("aws").defaultRegion,
    azure: getCloudProviderDefinition("azure").defaultRegion,
    gcp: getCloudProviderDefinition("gcp").defaultRegion,
};
export const DEFAULT_REGION = DEFAULT_REGIONS.aws;
export const GLOBAL_REGION = "all";

export function getProviderInfo(provider: CloudProvider): CloudProviderInfo {
    return CLOUD_PROVIDERS.find(item => item.value === provider) || CLOUD_PROVIDERS[0];
}

export function isCloudProvider(value: string | undefined): value is CloudProvider {
    return isRegisteredCloudProvider(value);
}

export function getRegionsForProvider(provider: CloudProvider): CloudRegionInfo[] {
    if (provider === "azure") return AZURE_REGIONS;
    if (provider === "gcp") return GCP_REGIONS;
    return AWS_REGIONS;
}

function formatAwsRegionLabel(region: CloudRegionInfo): string {
    if (region.value.startsWith("us-east")) return `US East (${region.label})`;
    if (region.value.startsWith("us-west")) return `US West (${region.label})`;
    if (region.value.startsWith("eu-")) return `Europe (${region.label})`;
    if (region.value.startsWith("ap-")) return `Asia Pacific (${region.label})`;
    if (region.value.startsWith("sa-")) return `South America (${region.label})`;
    if (region.value.startsWith("ca-")) return `Canada (${region.label})`;
    return region.label;
}

function titleCaseRegionToken(token: string): string {
    const match = token.match(/^([a-z]+)(\d+)$/i);
    const word = match ? match[1] : token;
    const suffix = match ? ` ${match[2]}` : "";
    const normalized = word.toLowerCase() === "us" ? "US" : word.charAt(0).toUpperCase() + word.slice(1);
    return `${normalized}${suffix}`;
}

function formatGcpRegionLabel(region: CloudRegionInfo): string {
    const valueLabel = region.value.split("-").map(titleCaseRegionToken).join(" ");
    return `${valueLabel} (${region.label})`;
}

export function getRegionSelectOptions(provider: CloudProvider = DEFAULT_PROVIDER): RegionSelectOption[] {
    return getRegionsForProvider(provider).map((region) => ({
        value: region.value,
        label: provider === "aws"
            ? formatAwsRegionLabel(region)
            : provider === "gcp"
                ? formatGcpRegionLabel(region)
                : region.label,
    }));
}

/** Look up region info by value */
export function getRegionInfo(regionValue: string, provider: CloudProvider = DEFAULT_PROVIDER): CloudRegionInfo | undefined {
    return getRegionsForProvider(provider).find(r => r.value === regionValue);
}

/** Get all regions grouped by geography */
export function getGroupedRegions(provider: CloudProvider = DEFAULT_PROVIDER): Record<string, CloudRegionInfo[]> {
    const regions = getRegionsForProvider(provider);
    const grouped: Record<string, CloudRegionInfo[]> = {};
    for (const group of REGION_GROUPS) {
        grouped[group] = regions.filter(r => r.group === group);
    }
    return grouped;
}
