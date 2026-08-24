import { TfNodeInput, TfEdgeInput } from "../../terraform/services/generation";
import { ServiceId } from "@rabbittwatch/types";

const SERVICE_ID_MAP: Record<string, ServiceId> = {
  // AWS
  aws_instance: "ec2",
  aws_autoscaling_group: "asg",
  aws_s3_bucket: "s3",
  aws_db_instance: "rds",
  aws_lambda_function: "lambda",
  aws_dynamodb_table: "dynamodb",
  aws_lb: "elb",
  aws_alb: "elb",
  aws_elb: "elb",
  aws_api_gateway_rest_api: "apigateway",
  aws_apigatewayv2_api: "apigateway",
  aws_ecr_repository: "ecr",
  aws_eip: "eip",
  aws_security_group: "sg",
  aws_lb_target_group: "tg",
  aws_ebs_volume: "ebs",
  aws_ecs_service: "ecs",
  aws_ecs_cluster: "ecs",
  aws_eks_cluster: "eks",
  aws_vpc: "vpc",
  aws_cloudfront_distribution: "cloudfront",

  // GCP
  google_compute_instance: "gcp_compute",
  google_compute_instance_group_manager: "gcp_mig",
  google_compute_region_instance_group_manager: "gcp_mig",
  google_storage_bucket: "gcp_storage",
  google_sql_database_instance: "gcp_sql",
  google_cloudfunctions_function: "gcp_function",
  google_cloudfunctions2_function: "gcp_function",
  google_container_cluster: "gcp_gke",
  google_compute_global_forwarding_rule: "gcp_lb",
  google_compute_forwarding_rule: "gcp_lb",
  google_artifact_registry_repository: "gcp_artifact_registry",
  google_compute_address: "gcp_ip",
  google_compute_global_address: "gcp_ip",
  google_compute_firewall: "gcp_firewall",
  google_compute_backend_service: "gcp_tg",
  google_compute_disk: "gcp_disk",
  google_apigateway_gateway: "apigateway",
  google_firestore_database: "dynamodb",
  google_cloud_run_service: "gcp_cloud_run",
  google_cloud_run_v2_service: "gcp_cloud_run",
  google_compute_network: "gcp_vpc",

  // Azure
  azurerm_virtual_machine: "azure_vm",
  azurerm_linux_virtual_machine: "azure_vm",
  azurerm_windows_virtual_machine: "azure_vm",
  azurerm_virtual_machine_scale_set: "azure_vmss",
  azurerm_linux_virtual_machine_scale_set: "azure_vmss",
  azurerm_lb: "azure_lb",
  azurerm_storage_account: "azure_storage",
  azurerm_mssql_server: "azure_sql",
  azurerm_postgresql_server: "azure_sql",
  azurerm_mysql_server: "azure_sql",
  azurerm_function_app: "azure_function",
  azurerm_linux_function_app: "azure_function",
  azurerm_virtual_network: "azure_vnet",
  azurerm_container_registry: "azure_acr",
  azurerm_public_ip: "azure_pip",
  azurerm_network_security_group: "azure_nsg",
  azurerm_lb_backend_address_pool: "azure_tg",
  azurerm_managed_disk: "azure_disk",
  azurerm_api_management: "apigateway",
  azurerm_cosmosdb_account: "dynamodb",
  azurerm_kubernetes_cluster: "azure_aks",
  azurerm_resource_group: "azure_rg",
};

interface RawResourceBlock {
  type: string;
  name: string;
  body: string;
}

interface ParsedTfNode extends TfNodeInput {
  position?: { x: number; y: number };
}

function normalizeConfig(serviceId: string, rawConfig: Record<string, any>): Record<string, any> {
  const config = { ...rawConfig };

  // Convert keys to camelCase if they are snake_case
  const camelConfig: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    camelConfig[camelKey] = value;
  }

  if (camelConfig.location && !camelConfig.region) {
    camelConfig.region = camelConfig.location;
  }

  if (serviceId === "azure_vmss" || serviceId === "asg" || serviceId === "gcp_mig") {
    if (camelConfig.instances !== undefined && camelConfig.desiredCapacity === undefined) {
      camelConfig.desiredCapacity = camelConfig.instances;
    }
  }

  // Handle specific fields
  if (serviceId === "s3" || serviceId === "gcp_storage" || serviceId === "azure_storage") {
    let nameVal = camelConfig.bucketName || camelConfig.bucketPrefix || camelConfig.bucket || camelConfig.name;
    if (typeof nameVal === "string") {
      if (nameVal.endsWith("-")) {
        nameVal = nameVal.slice(0, -1);
      }
    }
    camelConfig.bucketName = nameVal;
  }

  if (serviceId === "ec2" || serviceId === "gcp_compute" || serviceId === "azure_vm") {
    camelConfig.instanceName = camelConfig.Name || camelConfig.instanceName || camelConfig.name;
    camelConfig.instanceType = camelConfig.instanceType || camelConfig.machineType || camelConfig.size;
  }

  if (serviceId === "rds" || serviceId === "gcp_sql" || serviceId === "azure_sql") {
    camelConfig.dbName = camelConfig.dbName || camelConfig.databaseName || camelConfig.name || camelConfig.dbInstanceIdentifier;
    camelConfig.dbUsername = camelConfig.dbUsername || camelConfig.username || camelConfig.administratorLogin;
  }

  if (serviceId === "lambda" || serviceId === "gcp_function" || serviceId === "azure_function") {
    camelConfig.functionName = camelConfig.functionName || camelConfig.name;
  }

  if (serviceId === "dynamodb" || serviceId === "azure_cosmos" || serviceId === "gcp_firestore") {
    camelConfig.tableName = camelConfig.tableName || camelConfig.name;
  }

  if (serviceId === "ecs") {
    camelConfig.clusterName = camelConfig.clusterName || camelConfig.name;
  }

  if (serviceId === "eks") {
    camelConfig.clusterName = camelConfig.clusterName || camelConfig.name;
  }

  if (serviceId === "vpc" || serviceId === "gcp_vpc" || serviceId === "azure_vnet") {
    camelConfig.vpcName = camelConfig.Name || camelConfig.vpcName || camelConfig.name;
    if (Array.isArray(camelConfig.addressSpace)) {
      camelConfig.addressSpace = camelConfig.addressSpace[0] || "10.0.0.0/16";
    } else if (typeof camelConfig.addressSpace === "string" && camelConfig.addressSpace.startsWith("[") && camelConfig.addressSpace.endsWith("]")) {
      try {
        const parsed = JSON.parse(camelConfig.addressSpace.replace(/'/g, '"'));
        if (Array.isArray(parsed)) {
          camelConfig.addressSpace = parsed[0] || "10.0.0.0/16";
        }
      } catch (e) {}
    }
  }

  if (serviceId === "ecr" || serviceId === "gcp_artifact_registry" || serviceId === "azure_acr") {
    camelConfig.repositoryName = camelConfig.repositoryName || camelConfig.name;
  }

  if (serviceId === "sg") {
    camelConfig.name = camelConfig.Name || camelConfig.name;
  }

  if (serviceId === "tg") {
    camelConfig.name = camelConfig.Name || camelConfig.name;
  }

  if (serviceId === "ebs") {
    camelConfig.volumeName = camelConfig.Name || camelConfig.volumeName || camelConfig.name;
  }

  if (serviceId === "elb") {
    camelConfig.lbName = camelConfig.Name || camelConfig.lbName || camelConfig.name;
  }

  if (serviceId === "asg") {
    camelConfig.instanceName = camelConfig.Name || camelConfig.instanceName || camelConfig.name;
  }

  if (serviceId === "cloudfront") {
    camelConfig.distributionName = camelConfig.distributionName || camelConfig.name;
  }

  return camelConfig;
}

export class HclParserService {
  /**
   * Cleans comments and parses raw HCL string into structured resource blocks.
   */
  private extractResourceBlocks(hcl: string): RawResourceBlock[] {
    // 1. Remove single-line comments (# and //) and multi-line comments (/* */)
    let cleaned = hcl
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(?:^|\s)#.*$/gm, "")
      .replace(/(?:^|\s)\/\/.*$/gm, "");

    const blocks: RawResourceBlock[] = [];
    // 2. Scan for resource declarations using regex
    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
    let match;

    while ((match = resourceRegex.exec(cleaned)) !== null) {
      const type = match[1];
      const name = match[2];
      const startIdx = match.index + match[0].length;

      // Track braces to find end of block
      let braceCount = 1;
      let endIdx = startIdx;
      while (braceCount > 0 && endIdx < cleaned.length) {
        const char = cleaned[endIdx];
        if (char === "{") {
          braceCount++;
        } else if (char === "}") {
          braceCount--;
        }
        endIdx++;
      }

      const body = cleaned.substring(startIdx, endIdx - 1).trim();
      blocks.push({ type, name, body });
    }

    return blocks;
  }

  /**
   * Parses flat key-value configs inside resource body.
   */
  private parseConfig(body: string): Record<string, any> {
    const config: Record<string, any> = {};
    const lines = body.split("\n");
    let braceLevel = 0;

    for (const line of lines) {
      const cleanedLine = line.trim();
      if (!cleanedLine || cleanedLine.startsWith("#") || cleanedLine.startsWith("//")) {
        continue;
      }

      // Track braces to skip keys inside nested blocks
      let openBraces = 0;
      let closeBraces = 0;
      let inQuotes = false;
      for (let i = 0; i < cleanedLine.length; i++) {
        const char = cleanedLine[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (!inQuotes) {
          if (char === "{") openBraces++;
          else if (char === "}") closeBraces++;
        }
      }

      if (braceLevel === 0) {
        // Check for key = value patterns
        const eqIdx = cleanedLine.indexOf("=");
        if (eqIdx > 0) {
          const key = cleanedLine.substring(0, eqIdx).trim();
          let valStr = cleanedLine.substring(eqIdx + 1).trim();

          // Strip trailing comments if any
          valStr = valStr.split(/(?:^|\s)(?:#|\/\/)/)[0].trim();

          // Basic value parsing
          if (valStr.startsWith('"') && valStr.endsWith('"')) {
            config[key] = valStr.substring(1, valStr.length - 1);
          } else if (valStr.startsWith("[") && valStr.endsWith("]")) {
            try {
              config[key] = JSON.parse(valStr.replace(/'/g, '"'));
            } catch (e) {
              const inner = valStr.substring(1, valStr.length - 1).trim();
              if (!inner) {
                config[key] = [];
              } else {
                config[key] = inner.split(",").map(item => {
                  item = item.trim();
                  if (item.startsWith('"') && item.endsWith('"')) {
                    return item.substring(1, item.length - 1);
                  }
                  return item;
                });
              }
            }
          } else if (valStr === "true") {
            config[key] = true;
          } else if (valStr === "false") {
            config[key] = false;
          } else if (!isNaN(Number(valStr)) && valStr !== "") {
            config[key] = Number(valStr);
          } else {
            // Keep as string for interpolations or complex expressions
            config[key] = valStr;
          }
        }
      }

      braceLevel += openBraces - closeBraces;
      if (braceLevel < 0) braceLevel = 0;
    }

    return config;
  }

  /**
   * Determines all unique provider names (aws, gcp, azure, cloudflare, etc.) based on resource type prefixes.
   */
  private detectProviders(blocks: RawResourceBlock[]): string[] {
    const providers = new Set<string>();
    for (const block of blocks) {
      const parts = block.type.split("_");
      if (parts.length > 1) {
        let p = parts[0].toLowerCase();
        if (p === "google") p = "gcp";
        if (p === "azurerm") p = "azure";
        providers.add(p);
      }
    }
    return providers.size > 0 ? Array.from(providers) : ["aws"];
  }

  /**
   * Main parsing method to transform HCL string into React Flow nodes and edges.
   */
  public parse(hcl: string): { nodes: ParsedTfNode[]; edges: TfEdgeInput[]; provider: "aws" | "gcp" | "azure"; providers: string[] } {
    const blocks = this.extractResourceBlocks(hcl);
    const providers = this.detectProviders(blocks);
    const provider = (providers.find(p => ["aws", "gcp", "azure"].includes(p)) as "aws" | "gcp" | "azure") || "aws";

    const nodes: ParsedTfNode[] = [];
    const edges: TfEdgeInput[] = [];

    // Map to keep track of resource names and their generated node IDs
    const resourceMap: Record<string, string> = {};
    const helperResources = new Set<string>();

    for (const block of blocks) {
      const serviceId = SERVICE_ID_MAP[block.type];
      const key = `${block.type}.${block.name}`;
      if (serviceId) {
        let mappedId = block.name.toLowerCase();
        if (mappedId.startsWith(`sim_${serviceId}_`)) {
          mappedId = mappedId.substring(4);
        } else if (mappedId.startsWith(`${serviceId}_`)) {
          // Keep as is
        } else if (mappedId.startsWith("sim_")) {
          mappedId = `${serviceId}_${mappedId.substring(4)}`;
        } else {
          mappedId = `${serviceId}_${mappedId}`;
        }
        resourceMap[key] = mappedId;
      } else {
        helperResources.add(key);
      }
    }

    // 1. Generate Nodes
    for (const block of blocks) {
      const key = `${block.type}.${block.name}`;
      const nodeId = resourceMap[key];
      if (!nodeId) continue; // Skip helper resources

      const serviceId = SERVICE_ID_MAP[block.type];
      const parsedConfig = this.parseConfig(block.body);
      const normalized = normalizeConfig(serviceId, parsedConfig);

      // Determine display names/labels based on schema expectations
      let customName = block.name;
      if (normalized.name) customName = normalized.name;
      else if (normalized.bucketName) customName = normalized.bucketName;
      else if (normalized.instanceName) customName = normalized.instanceName;
      else if (normalized.lbName) customName = normalized.lbName;
      else if (normalized.vpcName) customName = normalized.vpcName;
      else if (normalized.tableName) customName = normalized.tableName;
      else if (normalized.functionName) customName = normalized.functionName;
      else if (normalized.dbName) customName = normalized.dbName;
      else if (normalized.clusterName) customName = normalized.clusterName;
      else if (normalized.repositoryName) customName = normalized.repositoryName;
      else if (normalized.volumeName) customName = normalized.volumeName;
      else if (normalized.distributionName) customName = normalized.distributionName;

      nodes.push({
        id: nodeId,
        serviceId,
        config: {
          ...normalized,
          name: customName,
          lbName: customName,
          instanceName: customName,
          bucketName: customName,
          vpcName: customName,
          tableName: customName,
          functionName: customName,
          dbName: customName,
          clusterName: customName,
          repositoryName: customName,
          volumeName: customName,
          distributionName: customName,
        },
        position: { x: 0, y: 0 }, // Position calculated during layout stage
      });
    }

    // Helper to resolve transitive targets
    const getTransitiveTargets = (sourceKey: string, currentKey: string, visited = new Set<string>()): string[] => {
      if (visited.has(currentKey)) return [];
      visited.add(currentKey);

      const nodeId = resourceMap[currentKey];
      if (nodeId && currentKey !== sourceKey) {
        return [nodeId];
      }

      const block = blocks.find(b => `${b.type}.${b.name}` === currentKey);
      if (!block) return [];

      const targets: string[] = [];
      const keysToCheck = [...Object.keys(resourceMap), ...Array.from(helperResources)];
      for (const targetKey of keysToCheck) {
        if (targetKey === currentKey) continue;
        const escapedKey = targetKey.replace(/\./g, "\\.");
        const refRegex = new RegExp(`(?:\\b|\\$|{|")${escapedKey}(?:\\b|\\.|}|")`, "i");
        if (refRegex.test(block.body)) {
          targets.push(...getTransitiveTargets(sourceKey, targetKey, visited));
        }
      }
      return targets;
    };

    // 2. Generate Edges (Dependencies)
    for (const block of blocks) {
      const key = `${block.type}.${block.name}`;
      const sourceId = resourceMap[key];
      if (sourceId) {
        const targets = getTransitiveTargets(key, key);
        for (const targetId of targets) {
          if (targetId !== sourceId && !edges.some(e => e.source === sourceId && e.target === targetId)) {
            edges.push({ source: sourceId, target: targetId });
          }
        }
      } else {
        const targets = getTransitiveTargets(key, key);
        if (targets.length >= 2) {
          for (let i = 0; i < targets.length; i++) {
            for (let j = i + 1; j < targets.length; j++) {
              const u = targets[i];
              const v = targets[j];
              let src = u;
              let tgt = v;
              if (u.startsWith("ec2_") && v.startsWith("tg_")) { src = u; tgt = v; }
              else if (v.startsWith("ec2_") && u.startsWith("tg_")) { src = v; tgt = u; }
              else if (u.startsWith("elb_") && v.startsWith("tg_")) { src = u; tgt = v; }
              else if (v.startsWith("elb_") && u.startsWith("tg_")) { src = v; tgt = u; }
              else if (u.startsWith("asg_") && v.startsWith("tg_")) { src = u; tgt = v; }
              else if (v.startsWith("asg_") && u.startsWith("tg_")) { src = v; tgt = u; }

              if (!edges.some(e => (e.source === src && e.target === tgt) || (e.source === tgt && e.target === src))) {
                edges.push({ source: src, target: tgt });
              }
            }
          }
        }
      }
    }

    // 3. Layout Nodes (3-Tier architecture positioning)
    const networkingServiceIds = ["vpc", "gcp_vpc", "azure_vnet", "sg", "azure_nsg", "gcp_firewall"];
    const computeDbServiceIds = [
      "ec2", "gcp_compute", "azure_vm", "asg", "gcp_mig", "azure_vmss",
      "rds", "gcp_sql", "azure_sql", "dynamodb", "gcp_firestore", "azure_cosmosdb_account",
      "lambda", "gcp_function", "azure_function"
    ];

    const layer1: ParsedTfNode[] = []; // Network
    const layer2: ParsedTfNode[] = []; // Compute/DB
    const layer3: ParsedTfNode[] = []; // Edge/Traffic/Storage

    for (const node of nodes) {
      if (networkingServiceIds.includes(node.serviceId)) {
        layer1.push(node);
      } else if (computeDbServiceIds.includes(node.serviceId)) {
        layer2.push(node);
      } else {
        layer3.push(node);
      }
    }

    // Assign positions based on layer grouping
    const horizontalSpacing = 300;

    layer1.forEach((node, idx) => {
      node.position = { x: idx * horizontalSpacing, y: 50 };
    });

    layer2.forEach((node, idx) => {
      node.position = { x: idx * horizontalSpacing, y: 250 };
    });

    layer3.forEach((node, idx) => {
      node.position = { x: idx * horizontalSpacing, y: 450 };
    });

    return { nodes, edges, provider, providers };
  }
}
