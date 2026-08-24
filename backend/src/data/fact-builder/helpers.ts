import { ParsedIntent } from "../../models/chat.model";

export interface Fact {
  id: string;
  type:
    | "metric"
    | "inventory"
    | "billing"
    | "security"
    | "calculated"
    | "log"
    | "knowledge";
  content: string;
  source: string;
  value?: number;
  unit?: string;
  /** The specific AWS resource ID this fact pertains to */
  resourceId?: string;
  /** The service type (e.g., ec2, lambda, rds, s3) */
  resourceType?: string;
  /** The AWS region this fact pertains to */
  region?: string;
}

export interface FactSheetResult {
  facts: Fact[];
  factSheet: string;
  rawData: Record<string, any>;
  dataQuality: {
    fetchedAt: string;
    complete: boolean;
    sourceStatuses: {
      inventory: "ok" | "partial" | "failed" | "skipped";
      metrics: "ok" | "partial" | "failed" | "skipped";
      billing: "ok" | "partial" | "failed" | "skipped";
      security: "ok" | "partial" | "failed" | "skipped";
      vpsLogs: "ok" | "partial" | "failed" | "skipped";
      productKnowledge: "ok" | "skipped";
    };
    failedSources: string[];
  };
}

export interface DimensionFilter {
  Name: string;
  Value: string;
}

export interface DimensionSetWithRegion {
  dimensions: DimensionFilter[];
  region?: string;
}

export function buildDimensionFilters(
  serviceName: string,
  extractedEntities?: ParsedIntent["extractedEntities"],
  inventory?: any,
): DimensionSetWithRegion[] {
  const filters: DimensionSetWithRegion[] = [];

  const entityDimensionMap: Record<
    string,
    {
      entityKey: keyof NonNullable<ParsedIntent["extractedEntities"]>;
      dimName: string;
    }[]
  > = {
    ec2: [{ entityKey: "instanceIds", dimName: "InstanceId" }],
    ebs: [{ entityKey: "instanceIds", dimName: "VolumeId" }],
    lambda: [{ entityKey: "functionNames", dimName: "FunctionName" }],
    rds: [{ entityKey: "dbIdentifiers", dimName: "DBInstanceIdentifier" }],
    s3: [{ entityKey: "bucketNames", dimName: "BucketName" }],
    ecs: [{ entityKey: "clusterNames", dimName: "ClusterName" }],
    eks: [{ entityKey: "clusterNames", dimName: "ClusterName" }],
  };

  const serviceMappings = entityDimensionMap[serviceName] || [];

  // 1. If user explicitly mentioned entities, use those
  if (extractedEntities) {
    for (const mapping of serviceMappings) {
      const entities = extractedEntities[mapping.entityKey] as
        | string[]
        | undefined;
      if (entities && entities.length > 0) {
        for (const entityValue of entities) {
          filters.push({
            dimensions: [{ Name: mapping.dimName, Value: entityValue }],
          });
        }
        return filters;
      }
    }
  }

  // 2. Otherwise, enumerate from inventory (top 10 per service)
  if (inventory) {
    const MAX_RESOURCES = 10;
    const inventoryMap: Record<
      string,
      { items: any[]; idField: string; dimName: string }
    > = {
      ec2: { items: inventory.ec2 || [], idField: "id", dimName: "InstanceId" },
      lambda: {
        items: inventory.lambda || [],
        idField: "name",
        dimName: "FunctionName",
      },
      rds: {
        items: inventory.rds || [],
        idField: "id",
        dimName: "DBInstanceIdentifier",
      },
      ebs: { items: inventory.ebs || [], idField: "id", dimName: "VolumeId" },
      dynamodb: {
        items: inventory.dynamodb || [],
        idField: "name",
        dimName: "TableName",
      },
      sqs: {
        items: inventory.sqs || [],
        idField: "name",
        dimName: "QueueName",
      },
      elasticache: {
        items: inventory.elasticache || [],
        idField: "id",
        dimName: "CacheClusterId",
      },
      redshift: {
        items: inventory.redshift || [],
        idField: "id",
        dimName: "ClusterIdentifier",
      },
      alb: {
        items: inventory.alb || [],
        idField: "arn",
        dimName: "LoadBalancer",
      },
    };

    const mapping = inventoryMap[serviceName];
    if (mapping && mapping.items.length > 0) {
      const items = mapping.items.slice(0, MAX_RESOURCES);
      for (const item of items) {
        const value = item[mapping.idField];
        if (value) {
          const dimValue =
            serviceName === "alb" && value.includes("loadbalancer/")
              ? value.split("loadbalancer/")[1]
              : value;
          filters.push({
            dimensions: [{ Name: mapping.dimName, Value: dimValue }],
            region: item.region,
          });
        }
      }
    }
  }

  return filters;
}

export function getResourceMeta(
  serviceName: string,
  dimensionValue: string,
  inventory: any,
): { name: string; details: string } {
  if (!inventory) return { name: dimensionValue, details: "" };

  const lookups: Record<
    string,
    {
      items: any[];
      idField: string;
      nameField: string;
      detailsFn: (item: any) => string;
    }
  > = {
    ec2: {
      items: inventory.ec2 || [],
      idField: "id",
      nameField: "name",
      detailsFn: (i: any) =>
        `type: ${i.type || "unknown"}, state: ${i.state || "unknown"}, AZ: ${i.az || "unknown"}`,
    },
    lambda: {
      items: inventory.lambda || [],
      idField: "name",
      nameField: "name",
      detailsFn: (i: any) =>
        `runtime: ${i.runtime || "unknown"}, memory: ${i.memory || "unknown"}MB`,
    },
    rds: {
      items: inventory.rds || [],
      idField: "id",
      nameField: "id",
      detailsFn: (i: any) =>
        `engine: ${i.engine || "unknown"}, class: ${i.instanceClass || "unknown"}`,
    },
    ebs: {
      items: inventory.ebs || [],
      idField: "id",
      nameField: "id",
      detailsFn: (i: any) =>
        `type: ${i.volumeType || "unknown"}, size: ${i.size || "unknown"}GB, attached: ${i.attachedTo || "unattached"}`,
    },
    dynamodb: {
      items: inventory.dynamodb || [],
      idField: "name",
      nameField: "name",
      detailsFn: (i: any) => `billingMode: ${i.billingMode || "unknown"}`,
    },
    elasticache: {
      items: inventory.elasticache || [],
      idField: "id",
      nameField: "id",
      detailsFn: (i: any) =>
        `engine: ${i.engine || "unknown"}, nodeType: ${i.nodeType || "unknown"}`,
    },
    redshift: {
      items: inventory.redshift || [],
      idField: "id",
      nameField: "id",
      detailsFn: (i: any) =>
        `nodeType: ${i.nodeType || "unknown"}, nodes: ${i.numberOfNodes || 1}`,
    },
    alb: {
      items: inventory.alb || [],
      idField: "arn",
      nameField: "name",
      detailsFn: (i: any) => `scheme: ${i.scheme || "unknown"}`,
    },
    sqs: {
      items: inventory.sqs || [],
      idField: "name",
      nameField: "name",
      detailsFn: () => "",
    },
  };

  const lookup = lookups[serviceName];
  if (!lookup) return { name: dimensionValue, details: "" };

  const item = lookup.items.find((i: any) => {
    const id = i[lookup.idField];
    if (!id) return false;
    if (serviceName === "alb")
      return id.includes(dimensionValue) || dimensionValue.includes(id);
    return (
      id === dimensionValue || id.toLowerCase() === dimensionValue.toLowerCase()
    );
  });

  if (!item) return { name: dimensionValue, details: "" };
  return {
    name: item[lookup.nameField] || dimensionValue,
    details: lookup.detailsFn(item),
  };
}

export function timeRangeToHours(timeRange: string): number {
  const fallback = 24;
  const match = /^\s*(\d+)\s*([hdwm])\s*$/i.exec(timeRange || "");
  if (!match) return fallback;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return fallback;

  let hours = fallback;
  if (unit === "h") hours = value;
  else if (unit === "d") hours = value * 24;
  else if (unit === "w") hours = value * 24 * 7;
  else if (unit === "m") hours = value * 24 * 30;

  return Math.max(1, Math.min(hours, 24 * 14));
}
