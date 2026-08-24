import { CostNodeInput, CostEstimationRequest, CostWarning } from "./types";

export function formatServiceName(serviceId: string): string {
  const names: Record<string, string> = {
    ec2: "EC2 Instance",
    s3: "S3 Bucket",
    rds: "RDS Database",
    lambda: "Lambda Function",
    azure_vm: "Azure Virtual Machine",
    azure_storage: "Azure Storage Account",
    azure_sql: "Azure SQL Database",
    azure_function: "Azure Function App",
    azure_vnet: "Azure Virtual Network",
    gcp_compute: "Compute Engine VM",
    gcp_storage: "Cloud Storage Bucket",
    gcp_sql: "Cloud SQL Database",
    gcp_function: "Cloud Run Function",
    gcp_gke: "GKE Cluster",
    elb: "Elastic Load Balancer",
    azure_lb: "Azure Load Balancer",
    gcp_lb: "Cloud Load Balancer",
    dockerhub: "Docker Hub",
    sg: "Security Group",
    azure_nsg: "Azure Network Security Group",
    gcp_firewall: "GCP Firewall",
    eip: "Elastic IP",
    azure_pip: "Azure Public IP",
    gcp_ip: "GCP Static IP",
    ebs: "EBS Volume",
    azure_disk: "Azure Managed Disk",
    gcp_disk: "GCP Persistent Disk",
    tg: "Target Group",
    azure_tg: "Azure Backend Pool",
    gcp_tg: "GCP Backend Service",
    apigateway: "API Gateway",
    ecr: "AWS ECR Repository",
    azure_acr: "Azure Container Registry",
    gcp_artifact_registry: "GCP Artifact Registry",
    dynamodb: "DynamoDB Table",
    github: "GitHub Repo",
  };
  return names[serviceId] || serviceId.toUpperCase();
}

export function collectUnsupportedWarnings(request: CostEstimationRequest): CostWarning[] {
  const warnings: CostWarning[] = [];
  const unsupportedInPriceList = new Set<string>(["dockerhub", "sg", "azure_nsg", "gcp_firewall", "tg", "azure_tg", "gcp_tg", "github"]);

  for (const node of request.nodes) {
    if (unsupportedInPriceList.has(node.serviceId)) {
      warnings.push({
        code: "UNSUPPORTED_BY_PRICE_LIST",
        message: `Node "${node.id}" (${formatServiceName(node.serviceId)}) pricing details are omitted or free`,
        node: node.id,
        severity: "info",
      });
    }
  }

  // Edge-based warnings
  const hasCrossRegion = request.edges.some(
    (e) => {
      const src = request.nodes.find((n) => n.id === e.source);
      const tgt = request.nodes.find((n) => n.id === e.target);
      return src && tgt && src.config.region !== tgt.config.region;
    },
  );
  if (hasCrossRegion) {
    warnings.push({
      code: "CROSS_REGION_TRANSFER",
      message: "Cross-region data transfer costs may apply and are not fully modeled",
      node: "global",
      severity: "warning",
    });
  }

  return warnings;
}
