import axios from "axios";
import { ResourceInventory } from "../../models/aws.model";

export const DEFAULT_AZURE_REGION = "centralindia";

export interface AzureDiscoveryWarning {
    service: string;
    message: string;
}

export interface ResourceGraphRow {
    id: string;
    name: string;
    type: string;
    kind: string;
    location: string;
    resourceGroup: string;
    sku: any;
    tags: Record<string, string>;
    properties: any;
}

export function emptyInventory(): ResourceInventory {
    return {
        ec2: [],
        lambda: [],
        rds: [],
        s3: [],
        ecs: [],
        amplify: [],
        dynamodb: [],
        sqs: [],
        alb: [],
        alerts: [],
        ebs: [],
        eks: [],
        autoscaling: [],
        elasticache: [],
        redshift: [],
        cloudfront: [],
        efs: [],
        kinesis: [],
        sns: [],
        eventbridge: [],
        stepfunctions: [],
        waf: [],
        apigateway: [],
    };
}

export function finishInventory(inventory: ResourceInventory): ResourceInventory {
    const countKeys = Object.keys(inventory);
    inventory.counts = { total: 0 };
    let total = 0;

    for (const key of countKeys) {
        if (key.startsWith("__") || key === "counts" || key === "alerts") continue;
        if (Array.isArray(inventory[key])) {
            inventory.counts[key] = inventory[key].length;
            total += inventory[key].length;
        }
    }

    inventory.counts.total = total;
    return inventory;
}

export function normalizeAzureRegion(location: string | undefined): string {
    if (!location) return "global";
    return location.toLowerCase().replace(/\s+/g, "");
}

export function matchesRegion(resourceRegion: string | undefined, regionFilter: string): boolean {
    if (!regionFilter || regionFilter === "all") return true;
    return (resourceRegion || "").toLowerCase() === regionFilter.toLowerCase();
}

export function normalizeAzureId(id?: string | null): string {
    return (id || "").trim().toLowerCase();
}

export async function queryResourceGraph(
    token: string,
    subscriptionId: string,
    warnings: AzureDiscoveryWarning[]
): Promise<ResourceGraphRow[]> {
    try {
        const url = "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01";
        const payload = {
            subscriptions: [subscriptionId],
            query: "Resources | project id, name, type, kind, location, resourceGroup, sku, tags, properties",
            options: {
                resultFormat: "objectArray",
            },
        };

        const res = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            timeout: 20000,
        });

        const data = res.data?.data;
        if (Array.isArray(data)) {
            return data;
        }

        const rows = data?.rows || [];
        const columns = data?.columns || [];
        if (rows.length > 0 && columns.length > 0) {
            return rows.map((row: any[]) => {
                const obj: any = {};
                columns.forEach((col: any, idx: number) => {
                    obj[col.name] = row[idx];
                });
                return obj;
            });
        }

        return [];
    } catch (error: any) {
        const message = error?.response?.data?.error?.message || error?.message || "unknown error";
        warnings.push({ service: "Resource Graph", message });
        console.warn(`[azure/resources.provider] Resource Graph query failed: ${message}`);
        return [];
    }
}
