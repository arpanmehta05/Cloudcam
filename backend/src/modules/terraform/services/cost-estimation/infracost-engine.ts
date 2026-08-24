// Infracost CLI Engine
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { CostNodeInput, CostEstimationRequest, CostEstimationResult, CostWarning, CostBreakdown } from "./types";
import { formatServiceName } from "./helpers";
import { estimateWithPriceList } from "./price-list-engine";

const execAsync = promisify(exec);
const infracostApiKey = process.env.INFRACOST_API_KEY;


export function hasInfracost(): boolean {
  return !!(infracostApiKey && infracostApiKey.length > 10);
}

export async function estimateWithInfracost(
  request: CostEstimationRequest,
): Promise<CostEstimationResult> {
  const tmpDir = path.join(
    os.tmpdir(),
    `infracost_${request.sessionId}_${Date.now()}`,
  );
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const tfJson = generateTerraformJson(request);
    const tfPath = path.join(tmpDir, "main.tf.json");
    fs.writeFileSync(tfPath, JSON.stringify(tfJson, null, 2));

    // Generate Infracost config
    const infracostConfig = {
      version: 1,
      projects: [{ path: tmpDir }],
    };
    const configPath = path.join(tmpDir, "infracost.yml");
    fs.writeFileSync(configPath, JSON.stringify(infracostConfig, null, 2));

    // Run Infracost CLI
    const env = {
      ...process.env,
      INFRACOST_API_KEY: infracostApiKey!,
    };

    const { stdout } = await execAsync(
      `infracost breakdown --path ${tmpDir} --format json`,
      { env, timeout: 30_000, maxBuffer: 1024 * 1024 },
    );

    const infracostOutput = JSON.parse(stdout) as Record<string, unknown>;
    const result = parseInfracostOutput(infracostOutput, request);
    result.engine = "infracost";
    return result;
  } catch (err: any) {
    console.warn("Infracost CLI failed, falling back to Price List:", err.message);
    return estimateWithPriceList(request);
  } finally {
    // Cleanup temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/** Infracost JSON uses nested projects → breakdown → resources (not top-level costComponents). */
interface InfracostCostComponent {
  name?: string;
  hourlyCost?: number;
  monthlyCost?: number;
  unit?: string;
}

interface InfracostResourceRow {
  name?: string;
  resourceType?: string;
  resource_type?: string;
  /** Terraform address when present */
  metadata?: { filename?: string; filepath?: string };
  monthlyCost?: number;
  hourlyCost?: number;
  costComponents?: InfracostCostComponent[];
}

function readTotalMonthlyFromInfracost(output: Record<string, unknown>): number {
  const root = output.totalMonthlyCost;
  if (typeof root === "number" && root > 0) return root;

  const projects = output.projects as Array<{ breakdown?: { totalMonthlyCost?: number } }> | undefined;
  if (!Array.isArray(projects)) return 0;

  let sum = 0;
  for (const p of projects) {
    const t = p.breakdown?.totalMonthlyCost;
    if (typeof t === "number") sum += t;
  }
  return sum;
}

function collectInfracostResources(output: Record<string, unknown>): InfracostResourceRow[] {
  const out: InfracostResourceRow[] = [];

  const projects = output.projects as Array<{ breakdown?: { resources?: InfracostResourceRow[] } }> | undefined;
  if (Array.isArray(projects)) {
    for (const p of projects) {
      const resources = p.breakdown?.resources;
      if (Array.isArray(resources)) out.push(...resources);
    }
  }

  const rootBreakdown = output.breakdown as { resources?: InfracostResourceRow[] } | undefined;
  if (Array.isArray(rootBreakdown?.resources)) {
    out.push(...rootBreakdown.resources);
  }

  // Legacy / alternate shape: flat costComponents (single lump)
  const flat = output.costComponents as InfracostCostComponent[] | undefined;
  if (flat?.length && out.length === 0) {
    out.push({
      name: "aggregate",
      monthlyCost: flat.reduce((s, c) => s + (c.monthlyCost || 0), 0),
      costComponents: flat,
    });
  }

  return out;
}

/** Terraform resources are named `*.sim_<idx>` — same idx as request.nodes order. */
function resourceIndexFromName(name: string): number | null {
  const m = name.match(/\.sim_(\d+)\b/);
  if (m) return parseInt(m[1], 10);
  const m2 = name.match(/\bsim_(\d+)\b/);
  return m2 ? parseInt(m2[1], 10) : null;
}

function inferServiceFromResourceType(type: string | undefined): CostNodeInput["serviceId"] | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes("aws_instance")) return "ec2";
  if (t.includes("aws_s3_bucket")) return "s3";
  if (t.includes("aws_db_instance")) return "rds";
  if (t.includes("aws_lambda_function")) return "lambda";
  if (t.includes("azurerm_linux_virtual_machine")) return "azure_vm";
  if (t.includes("azurerm_storage_account")) return "azure_storage";
  if (t.includes("azurerm_mssql_database")) return "azure_sql";
  if (t.includes("azurerm_linux_function_app")) return "azure_function";
  if (t.includes("azurerm_virtual_network")) return "azure_vnet";
  if (t.includes("aws_autoscaling_group")) return "asg";
  if (t.includes("azurerm_linux_virtual_machine_scale_set")) return "azure_vmss";
  if (t.includes("google_compute_instance_group_manager") || t.includes("google_compute_autoscaler")) return "gcp_mig";
  return null;
}

function resourceTerraformType(row: InfracostResourceRow): string | undefined {
  return row.resourceType || row.resource_type;
}

function parseInfracostOutput(
  output: Record<string, unknown>,
  request: CostEstimationRequest,
): CostEstimationResult {
  const resources = collectInfracostResources(output);
  const apiTotal = readTotalMonthlyFromInfracost(output);

  const byIndex = new Map<number, InfracostResourceRow>();
  const unmatched: InfracostResourceRow[] = [];

  for (const r of resources) {
    const label = String(r.name || "");
    const idx = resourceIndexFromName(label);
    if (idx !== null && idx >= 0 && idx < request.nodes.length) {
      byIndex.set(idx, r);
    } else {
      unmatched.push(r);
    }
  }

  const warnings: CostWarning[] = [];

  const breakdown: CostBreakdown[] = request.nodes.map((node, idx) => {
    let row = byIndex.get(idx);

    if (!row && unmatched.length > 0) {
      const inferred = node.serviceId;
      const matchIdx = unmatched.findIndex(
        (u) => inferServiceFromResourceType(resourceTerraformType(u)) === inferred,
      );
      if (matchIdx >= 0) {
        row = unmatched[matchIdx];
        unmatched.splice(matchIdx, 1);
      }
    }

    if (!row) {
      return {
        service: node.serviceId,
        serviceName: formatServiceName(node.serviceId),
        monthlyCost: 0,
        components: [],
        supported: false,
      };
    }

    const comps = row.costComponents || [];
    const fromComponents = comps.reduce((s, c) => s + (c.monthlyCost || 0), 0);
    const monthly =
      typeof row.monthlyCost === "number" && row.monthlyCost > 0
        ? row.monthlyCost
        : fromComponents;

    return {
      service: node.serviceId,
      serviceName: formatServiceName(node.serviceId),
      monthlyCost: monthly,
      components: comps.length
        ? comps.map((c) => ({
            name: c.name || "Line item",
            unit: c.unit || "per month",
            quantity: 1,
            unitPrice: c.monthlyCost || 0,
            monthlyCost: c.monthlyCost || 0,
          }))
        : [
            {
              name: row.name || formatServiceName(node.serviceId),
              unit: "per month",
              quantity: 1,
              unitPrice: monthly,
              monthlyCost: monthly,
            },
          ],
      supported: monthly > 0,
    };
  });

  let sumBreakdown = breakdown.reduce((s, b) => s + b.monthlyCost, 0);

  if (breakdown.every((b) => !b.supported) && apiTotal > 0) {
    const perNode = apiTotal / (request.nodes.length || 1);
    breakdown.forEach((b) => {
      b.monthlyCost = perNode;
      b.supported = true;
      b.components = [
        {
          name: `Allocated share (${formatServiceName(b.service as CostNodeInput["serviceId"])})`,
          unit: "per month",
          quantity: 1,
          unitPrice: perNode,
          monthlyCost: perNode,
        },
      ];
    });
    sumBreakdown = breakdown.reduce((s, b) => s + b.monthlyCost, 0);
    warnings.push({
      code: "INFRACOST_ALLOCATED",
      message:
        "Infracost returned costs without per-resource mapping; total split evenly across nodes.",
      node: "global",
      severity: "info",
    });
  }

  const totalMonthlyCost =
    apiTotal > 0 ? apiTotal : sumBreakdown > 0 ? sumBreakdown : breakdown.reduce((s, b) => s + b.monthlyCost, 0);

  return {
    totalMonthlyCost,
    currency: "USD",
    engine: "infracost",
    breakdown,
    warnings,
    cached: false,
    estimatedAt: new Date().toISOString(),
  };
}

export function generateTerraformJson(request: CostEstimationRequest): any {
  const resources: Record<string, any> = {};

  request.nodes.forEach((node, idx) => {
    switch (node.serviceId) {
      case "ec2":
        resources[`aws_instance.sim_${idx}`] = {
          ami: (node.config.ami as string) || "ami-0abcdef1234567890",
          instance_type: (node.config.instanceType as string) || "t3.micro",
          tags: { Name: node.config.instanceName as string || `sim-ec2-${idx}` },
        };
        break;
      case "s3":
        resources[`aws_s3_bucket.sim_${idx}`] = {
          bucket: (node.config.bucketName as string) || `sim-bucket-${idx}`,
          versioning: node.config.versioning ? { enabled: true } : undefined,
          tags: { Name: `sim-s3-${idx}` },
        };
        break;
      case "rds":
        resources[`aws_db_instance.sim_${idx}`] = {
          engine: (node.config.engine as string) || "postgres",
          instance_class: (node.config.instanceClass as string) || "db.t3.micro",
          allocated_storage: (node.config.storageGb as number) || 20,
          db_name: (node.config.dbName as string) || "simdb",
          skip_final_snapshot: true,
          tags: { Name: `sim-rds-${idx}` },
        };
        break;
      case "lambda":
        resources[`aws_lambda_function.sim_${idx}`] = {
          function_name: (node.config.functionName as string) || `sim-lambda-${idx}`,
          runtime: (node.config.runtime as string) || "nodejs20.x",
          handler: (node.config.handler as string) || "index.handler",
          memory_size: (node.config.memoryMb as number) || 256,
          timeout: (node.config.timeoutSec as number) || 30,
          filename: "/dev/null",
          tags: { Name: `sim-lambda-${idx}` },
        };
        break;
      case "azure_vm":
        resources[`azurerm_network_interface.nic_${idx}`] = {
          name: `sim-nic-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          ip_configuration: {
            name: "internal",
            subnet_id: "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/sim-rg/providers/Microsoft.Network/virtualNetworks/sim-vnet/subnets/sim-subnet",
            private_ip_address_allocation: "Dynamic",
          },
        };
        resources[`azurerm_linux_virtual_machine.sim_${idx}`] = {
          name: (node.config.vmName as string) || `sim-vm-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          size: (node.config.vmSize as string) || "Standard_B1s",
          admin_username: "adminuser",
          network_interface_ids: [`\${azurerm_network_interface.nic_${idx}.id}`],
          admin_ssh_key: {
            username: "adminuser",
            public_key: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC3...",
          },
          os_disk: {
            caching: "ReadWrite",
            storage_account_type: "Standard_LRS",
          },
          source_image_reference: {
            publisher: "Canonical",
            offer: "0001-com-ubuntu-server-jammy",
            sku: "22_04-lts",
            version: "latest",
          },
        };
        break;
      case "azure_storage":
        resources[`azurerm_storage_account.sim_${idx}`] = {
          name: (node.config.storageAccountName as string) || `simstorage${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          account_tier: (node.config.accountTier as string) || "Standard",
          account_replication_type: (node.config.accountReplicationType as string) || "LRS",
        };
        break;
      case "azure_sql":
        resources[`azurerm_mssql_server.sim_server_${idx}`] = {
          name: `sim-sqlserver-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          version: "12.0",
          administrator_login: "missuser",
          administrator_login_password: "Password123!",
        };
        resources[`azurerm_mssql_database.sim_${idx}`] = {
          name: (node.config.databaseName as string) || `sim-db-${idx}`,
          server_id: `\${azurerm_mssql_server.sim_server_${idx}.id}`,
          sku_name: (node.config.skuName as string) || "Basic",
        };
        break;
      case "azure_function":
        resources[`azurerm_service_plan.sim_plan_${idx}`] = {
          name: `sim-plan-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          os_type: "Linux",
          sku_name: "Y1",
        };
        resources[`azurerm_linux_function_app.sim_${idx}`] = {
          name: (node.config.functionAppName as string) || `sim-func-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          storage_account_name: "simstorage",
          storage_account_access_key: "key",
          service_plan_id: `\${azurerm_service_plan.sim_plan_${idx}.id}`,
          site_config: {},
        };
        break;
      case "azure_vnet":
        resources[`azurerm_virtual_network.sim_${idx}`] = {
          name: (node.config.vnetName as string) || `sim-vnet-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          address_space: ["10.0.0.0/16"],
        };
        break;
      case "elb":
        resources[`aws_lb.sim_${idx}`] = {
          name: (node.config.lbName as string) || `sim-elb-${idx}`,
          load_balancer_type: "application",
          subnets: [`\${aws_subnet.sim_${idx}_public.id}`, `\${aws_subnet.sim_${idx}_public_b.id}`],
        };
        break;
      case "azure_lb":
        resources[`azurerm_public_ip.sim_${idx}`] = {
          name: `sim-pip-lb-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          allocation_method: "Static",
        };
        resources[`azurerm_lb.sim_${idx}`] = {
          name: (node.config.lbName as string) || `sim-lb-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          frontend_ip_configuration: {
            name: "PublicIPAddress",
            public_ip_address_id: `\${azurerm_public_ip.sim_${idx}.id}`,
          },
        };
        break;
      case "gcp_lb":
        resources[`google_compute_global_forwarding_rule.sim_${idx}`] = {
          name: (node.config.lbName as string) || `sim-lb-${idx}`,
          target: `\${google_compute_target_http_proxy.sim_${idx}.id}`,
          port_range: "80",
        };
        resources[`google_compute_target_http_proxy.sim_${idx}`] = {
          name: `sim-proxy-${idx}`,
          url_map: `\${google_compute_url_map.sim_${idx}.id}`,
        };
        resources[`google_compute_url_map.sim_${idx}`] = {
          name: `sim-url-map-${idx}`,
          default_service: `\${google_compute_backend_service.sim_${idx}.id}`,
        };
        resources[`google_compute_backend_service.sim_${idx}`] = {
          name: `sim-backend-${idx}`,
          health_checks: [`\${google_compute_http_health_check.sim_${idx}.id}`],
        };
        resources[`google_compute_http_health_check.sim_${idx}`] = {
          name: `sim-hc-${idx}`,
        };
        break;
      case "asg":
        resources[`aws_launch_template.sim_template_${idx}`] = {
          name_prefix: `sim-template-${idx}-`,
          image_id: (node.config.ami as string) || "ami-0abcdef1234567890",
          instance_type: (node.config.instanceType as string) || "t3.micro",
        };
        resources[`aws_autoscaling_group.sim_${idx}`] = {
          name: (node.config.instanceName as string) || `sim-asg-${idx}`,
          min_size: (node.config.minSize as number) || 1,
          max_size: (node.config.maxSize as number) || 3,
          desired_capacity: (node.config.desiredCapacity as number) || 1,
          launch_template: {
            id: `\${aws_launch_template.sim_template_${idx}.id}`,
            version: "$Latest",
          },
        };
        break;
      case "azure_vmss":
        resources[`azurerm_linux_virtual_machine_scale_set.sim_${idx}`] = {
          name: (node.config.instanceName as string) || `sim-vmss-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          sku: (node.config.vmSize as string) || "Standard_B1s",
          instances: (node.config.desiredCapacity as number) || 1,
          admin_username: (node.config.adminUsername as string) || "azureuser",
          admin_ssh_key: {
            username: (node.config.adminUsername as string) || "azureuser",
            public_key: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC3...",
          },
          os_disk: {
            caching: "ReadWrite",
            storage_account_type: (node.config.osDiskType as string) || "Standard_LRS",
          },
          source_image_reference: {
            publisher: (node.config.imagePublisher as string) || "Canonical",
            offer: (node.config.imageOffer as string) || "0001-com-ubuntu-server-jammy",
            sku: (node.config.imageSku as string) || "22_04-lts",
            version: "latest",
          },
          network_interface: {
            name: "nic",
            primary: true,
            ip_configuration: {
              name: "internal",
              primary: true,
              subnet_id: "/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/sim-rg/providers/Microsoft.Network/virtualNetworks/sim-vnet/subnets/sim-subnet",
            },
          },
        };
        break;
      case "gcp_mig":
        resources[`google_compute_instance_template.sim_template_${idx}`] = {
          name: `sim-template-${idx}`,
          machine_type: (node.config.machineType as string) || "e2-micro",
          disk: [{
            source_image: (node.config.image as string) || "projects/debian-cloud/global/images/family/debian-12",
          }],
          network_interface: [{
            network: "default",
          }],
        };
        resources[`google_compute_instance_group_manager.sim_${idx}`] = {
          name: (node.config.instanceName as string) || `sim-mig-${idx}`,
          base_instance_name: "sim-mig-instance",
          zone: (node.config.zone as string) || "us-central1-a",
          version: {
            instance_template: `\${google_compute_instance_template.sim_template_${idx}.id}`,
          },
        };
        resources[`google_compute_autoscaler.sim_autoscaler_${idx}`] = {
          name: `sim-autoscaler-${idx}`,
          zone: (node.config.zone as string) || "us-central1-a",
          target: `\${google_compute_instance_group_manager.sim_${idx}.id}`,
          autoscaling_policy: {
            min_replicas: (node.config.minSize as number) || 1,
            max_replicas: (node.config.maxSize as number) || 3,
          },
        };
        break;
      case "ecs": {
        const clusterName = `sim_cluster_${idx}`;
        const taskDefName = `sim_td_${idx}`;
        const serviceName = `sim_svc_${idx}`;
        const launchType = node.config.launchType || "FARGATE";
        const desiredCount = Number(node.config.desiredCount || 1);

        resources[`aws_ecs_cluster.${clusterName}`] = {
          name: (node.config.clusterName as string) || `sim-cluster-${idx}`,
        };

        const taskParams: any = {
          family: `sim-family-${idx}`,
          requires_compatibilities: [launchType],
          cpu: (node.config.cpu as string) || "256",
          memory: (node.config.memory as string) || "512",
          network_mode: launchType === "EC2" ? "bridge" : "awsvpc",
          container_definitions: JSON.stringify([
            {
              name: "app",
              image: "nginx:latest",
              cpu: Number(node.config.cpu || 256),
              memory: Number(node.config.memory || 512),
            }
          ]),
        };

        resources[`aws_ecs_task_definition.${taskDefName}`] = taskParams;

        const serviceParams: any = {
          name: (node.config.serviceName as string) || `sim-service-${idx}`,
          cluster: `\${aws_ecs_cluster.${clusterName}.id}`,
          task_definition: `\${aws_ecs_task_definition.${taskDefName}.arn}`,
          desired_count: desiredCount,
        };

        if (launchType === "FARGATE" && node.config.useFargateSpot === true) {
          serviceParams.capacity_provider_strategy = [
            {
              capacity_provider: "FARGATE",
              weight: 1,
              base: 0,
            },
            {
              capacity_provider: "FARGATE_SPOT",
              weight: Number(node.config.fargateSpotWeight || 1),
              base: 0,
            }
          ];
        } else {
          serviceParams.launch_type = launchType;
        }

        resources[`aws_ecs_service.${serviceName}`] = serviceParams;

        if (launchType === "EC2") {
          resources[`aws_instance.sim_ecs_host_${idx}`] = {
            ami: "ami-0abcdef1234567890",
            instance_type: "t3.micro",
            tags: { Name: `sim-ecs-host-${idx}` },
          };
        }
        break;
      }
      case "cloudfront":
        resources[`aws_cloudfront_distribution.sim_${idx}`] = {
          enabled: node.config.enabled !== false,
          price_class: (node.config.priceClass as string) || "PriceClass_All",
          origin: {
            domain_name: (node.config.originDomainName as string) || "sim-s3-bucket.s3.amazonaws.com",
            origin_id: `origin_${idx}`,
          },
          default_cache_behavior: {
            target_origin_id: `origin_${idx}`,
            viewer_protocol_policy: "allow-all",
            min_ttl: 0,
            default_ttl: (node.config.defaultCacheTtl as number) || 86400,
            max_ttl: 31536000,
          },
          viewer_certificate: {
            cloudfront_default_certificate: true,
          },
          restrictions: {
            geo_restriction: {
              restriction_type: "none",
            },
          },
          tags: { Name: `sim-cloudfront-${idx}` },
        };
        break;
      case "azure_cdn":
        resources[`azurerm_cdn_profile.sim_${idx}`] = {
          name: (node.config.profileName as string) || `sim-cdn-profile-${idx}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          sku: (node.config.skuName as string) || "Standard_Microsoft",
        };
        resources[`azurerm_cdn_endpoint.sim_${idx}`] = {
          name: (node.config.endpointName as string) || `sim-cdn-endpoint-${idx}`,
          profile_name: `\${azurerm_cdn_profile.sim_${idx}.name}`,
          resource_group_name: "sim-rg",
          location: request.region || "eastus",
          origin: {
            name: `origin-${idx}`,
            host_name: (node.config.originHostName as string) || "simstorage.blob.core.windows.net",
          },
        };
        break;
      case "gcp_cdn":
        resources[`google_compute_backend_service.sim_${idx}`] = {
          name: (node.config.cdnName as string) || `sim-gcp-cdn-${idx}`,
          enable_cdn: true,
          protocol: "HTTP",
          load_balancing_scheme: "EXTERNAL",
        };
        break;
    }
  });

  const isAzure = request.nodes.some((node) => node.serviceId.startsWith("azure_"));
  if (isAzure) {
    return {
      terraform: { required_providers: { azurerm: { source: "hashicorp/azurerm", version: "~> 3.0" } } },
      provider: { azurerm: { features: [{}], skip_provider_registration: true } },
      resource: resources,
    };
  }

  return {
    terraform: { required_providers: { aws: { source: "hashicorp/aws" } } },
    provider: { aws: { region: request.region } },
    resource: resources,
  };
}

// ─── Unsupported config warnings ─────────────────────────────────
