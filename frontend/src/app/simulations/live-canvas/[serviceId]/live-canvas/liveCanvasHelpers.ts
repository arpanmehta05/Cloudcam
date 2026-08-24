import type { Node as FlowNode } from "reactflow";

export const LIVE_CANVAS_LAYOUT_ANIMATION_MS = 520;
export const LIVE_CANVAS_LAYOUT_ANIMATION_SETTLE_MS = LIVE_CANVAS_LAYOUT_ANIMATION_MS + 120;

export const MAPPERS: Record<string, (item: any, x: number, y: number) => FlowNode> = {
  ec2: (item, x, y) => ({
    id: `ec2_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "ec2",
      label: item.name || item.id,
      config: { instanceType: item.type, instanceName: item.name },
    },
  }),
  s3: (item, x, y) => ({
    id: `s3_${item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "s3",
      label: item.name,
      config: { bucketName: item.name },
    },
  }),
  rds: (item, x, y) => ({
    id: `rds_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "rds",
      label: item.id,
      config: {
        engine: item.engine,
        ...(item.type === "snapshot"
          ? { type: "Snapshot", allocatedStorage: item.allocatedStorage ? `${item.allocatedStorage} GB` : "N/A" }
          : { instanceClass: item.class }
        ),
      },
    },
  }),
  lambda: (item, x, y) => ({
    id: `lambda_${item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "lambda",
      label: item.name,
      config: { functionName: item.name, memoryMb: item.memory },
    },
  }),
  dynamodb: (item, x, y) => ({
    id: `dynamodb_${item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "dynamodb",
      label: item.name,
      config: { tableName: item.name },
    },
  }),
  apigateway: (item, x, y) => ({
    id: `apigateway_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "apigateway",
      label: item.name || item.id,
      config: { name: item.name },
    },
  }),
  ecs: (item, x, y) => ({
    id: `ecs_${item.id || item.cluster}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "ecs",
      label: item.name || item.cluster,
      config: { clusterName: item.cluster },
    },
  }),
  eks: (item, x, y) => ({
    id: `eks_${item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "eks",
      label: item.name,
      config: { clusterName: item.name, version: item.version },
    },
  }),
  azure_vm: (item, x, y) => ({
    id: `azure_vm_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "azure_vm",
      label: item.name || item.id,
      config: { vmSize: item.type, instanceName: item.name, resourceGroup: item.resourceGroup },
    },
  }),
  azure_storage: (item, x, y) => ({
    id: `azure_storage_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "azure_storage",
      label: item.name,
      config: { bucketName: item.name, accountKind: item.kind, replicationType: item.skuName, resourceGroup: item.resourceGroup },
    },
  }),
  azure_sql: (item, x, y) => ({
    id: `azure_sql_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "azure_sql",
      label: item.name || item.id,
      config: { dbName: item.name, skuName: item.class, resourceGroup: item.resourceGroup },
    },
  }),
  azure_function: (item, x, y) => ({
    id: `azure_function_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "azure_function",
      label: item.name,
      config: { functionName: item.name, runtime: item.runtime, resourceGroup: item.resourceGroup },
    },
  }),
  azure_vnet: (item, x, y) => ({
    id: `azure_vnet_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "azure_vnet",
      label: item.name,
      config: { vnetName: item.name, addressSpace: item.addressPrefixes?.join(", "), resourceGroup: item.resourceGroup },
    },
  }),
  aws_vpc: (item, x, y) => ({
    id: `aws_vpc_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "aws_vpc",
      label: item.name || "sim-vpc",
      config: { vpcName: item.name || "sim-vpc", cidrBlock: "10.0.0.0/16", subnetCidrBlock: "10.0.1.0/24" },
    },
  }),
  gcp_vpc: (item, x, y) => ({
    id: `gcp_vpc_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "gcp_vpc",
      label: item.name || "sim-vpc-network",
      config: { networkName: item.name || "sim-vpc-network", cidrBlock: "10.0.0.0/16", subnetCidrBlock: "10.0.1.0/24" },
    },
  }),
  vpc: (item, x, y) => ({
    id: `vpc_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "vpc",
      label: item.name || "sim-vpc",
      config: { vpcName: item.name || "sim-vpc", cidrBlock: "10.0.0.0/16", subnetCidrBlock: "10.0.1.0/24" },
    },
  }),
  gcp_compute: (item, x, y) => ({
    id: `gcp_compute_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "gcp_compute",
      label: item.name || item.id,
      config: { machineType: item.type, zone: item.zone },
    },
  }),
  gcp_storage: (item, x, y) => ({
    id: `gcp_storage_${item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "gcp_storage",
      label: item.name,
      config: { bucketName: item.name, storageClass: item.storageClass },
    },
  }),
  gcp_sql: (item, x, y) => ({
    id: `gcp_sql_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "gcp_sql",
      label: item.name || item.id,
      config: { engineVersion: item.engine, tier: item.class },
    },
  }),
  gcp_function: (item, x, y) => ({
    id: `gcp_function_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "gcp_function",
      label: item.name,
      config: { functionName: item.name, runtime: item.runtime, entryPoint: item.entryPoint || "N/A" },
    },
  }),
  gcp_gke: (item, x, y) => ({
    id: `gcp_gke_${item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "gcp_gke",
      label: item.name,
      config: { clusterName: item.name, nodeCount: item.nodeCount, location: item.zone || item.location },
    },
  }),
  eip: (item, x, y) => ({
    id: `eip_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "eip",
      label: item.publicIp || item.id,
      config: { publicIp: item.publicIp, associationId: item.associationId, instanceId: item.instanceId },
    },
  }),
  sg: (item, x, y) => ({
    id: `sg_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "sg",
      label: item.name || item.id,
      config: { groupId: item.id, groupName: item.name, description: item.description, vpcId: item.vpcId },
    },
  }),
  tg: (item, x, y) => ({
    id: `tg_${item.arn || item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "tg",
      label: item.name,
      config: { targetGroupArn: item.arn, targetGroupName: item.name, loadBalancer: item.loadBalancer },
    },
  }),
  ecr: (item, x, y) => ({
    id: `ecr_${item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "ecr",
      label: item.name,
      images: item.images || [],
      config: { repositoryName: item.name, repositoryUri: item.uri, repositoryArn: item.arn },
    },
  }),
  cloudfront: (item, x, y) => ({
    id: `cloudfront_${item.id}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "cloudfront",
      label: item.name || item.domain || item.domainName || item.id,
      config: { distributionId: item.id, domainName: item.domain || item.domainName, status: item.status },
    },
  }),
  azure_cdn: (item, x, y) => ({
    id: `azure_cdn_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "azure_cdn",
      label: item.name,
      config: { endpointName: item.name, endpointUrl: item.url, resourceGroup: item.resourceGroup },
    },
  }),
  gcp_cdn: (item, x, y) => ({
    id: `gcp_cdn_${item.id || item.name}`,
    type: "service",
    position: { x, y },
    data: {
      serviceId: "gcp_cdn",
      label: item.name,
      config: { cdnName: item.name, cdnIp: item.ip },
    },
  }),
};

export function inventoryKeyForService(serviceId: string): string {
  const map: Record<string, string> = {
    azure_vm: "ec2",
    azure_storage: "s3",
    azure_sql: "rds",
    azure_function: "lambda",
    azure_vnet: "efs",
    azure_aks: "eks",
    aws_vpc: "efs",
    gcp_vpc: "efs",
    vpc: "efs",
    gcp_compute: "ec2",
    gcp_storage: "s3",
    gcp_sql: "rds",
    gcp_function: "lambda",
    gcp_gke: "eks",
    azure_cdn: "cloudfront",
    gcp_cdn: "cloudfront",
  };
  return map[serviceId] || serviceId;
}

export function metricServiceForProvider(serviceId: string): string {
  const map: Record<string, string> = {
    azure_vm: "compute",
    azure_storage: "storage",
    azure_sql: "database",
    azure_function: "serverless",
    azure_vnet: "networking",
    aws_vpc: "networking",
    gcp_vpc: "networking",
    vpc: "networking",
    gcp_compute: "compute",
    gcp_storage: "storage",
    gcp_sql: "database",
    gcp_function: "serverless",
    gcp_gke: "container",
    cloudfront: "networking",
    azure_cdn: "networking",
    gcp_cdn: "networking",
  };
  return map[serviceId] || serviceId;
}

export function formatConfigKey(key: string): string {
  const acr = ["uri", "arn", "ip", "dns", "id", "db", "vm", "vpc", "sg", "tg", "ecs", "eks", "s3", "ebs", "ecr"];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      const lower = word.toLowerCase();
      if (acr.includes(lower)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

export function findPublicIp(item: any): string {
  if (!item) return "";
  const direct = [
    item.publicIp,
    item.publicIP,
    item.public_ip,
    item.publicIPAddress,
    item.public_ip_address,
    item.ipAddress,
    item.externalIp,
    item.externalIP,
    item.natIp,
    item.natIP,
  ].find((value) => typeof value === "string" && value.trim());
  if (direct) return direct.trim();

  const networkInterfaces = item.networkInterfaces || item.networkProfile?.networkInterfaces || [];
  for (const nic of Array.isArray(networkInterfaces) ? networkInterfaces : []) {
    const accessConfigs = nic.accessConfigs || nic.networkIPConfigs || nic.ipConfigurations || [];
    for (const config of Array.isArray(accessConfigs) ? accessConfigs : []) {
      const candidate =
        config.natIP ||
        config.natIp ||
        config.publicIp ||
        config.publicIPAddress ||
        config.public_ip_address ||
        config.properties?.publicIPAddress?.properties?.ipAddress;
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }

  const publicIps = item.publicIps || item.publicIPAddresses || item.publicIpAddresses || [];
  const firstPublicIp = Array.isArray(publicIps) ? publicIps.find((value) => typeof value === "string" && value.trim()) : "";
  return firstPublicIp ? firstPublicIp.trim() : "";
}

export function deriveLiveInfraKeyName(item: any, serviceId: string, provider: string): string {
  const explicit = item?.keyName || item?.key_name || item?.sshKeyName || item?.metadata?.keyName;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim().replace(/\.pem$/i, "");

  const label = String(item?.name || item?.id || serviceId || "instance")
    .replace(/[^a-z0-9-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "instance";

  if ((provider === "azure" || provider === "gcp") && !label.includes(`-${provider}-`)) {
    const match = label.match(/^(.+)-([a-f0-9]{8})$/i);
    if (match) return `${match[1]}-${provider}-${match[2]}-key`;
  }

  return `${label}-key`;
}

