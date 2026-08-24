"use client";

import { findService } from "../../../registry";

export const SERVICE_ID_MAP: Record<string, string> = {
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

export function camelCaseConfig(config: Record<string, any>): Record<string, any> {
  const camelConfig: Record<string, any> = {};
  for (const [key, value] of Object.entries(config)) {
    const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    camelConfig[camelKey] = value;
  }
  return camelConfig;
}

export function normalizeConfig(serviceId: string, rawConfig: Record<string, any>): Record<string, any> {
  const config = { ...rawConfig };
  const camelConfig = camelCaseConfig(config);

  if (camelConfig.location && !camelConfig.region) {
    camelConfig.region = camelConfig.location;
  }

  if (serviceId === "azure_vmss" || serviceId === "asg" || serviceId === "gcp_mig") {
    if (camelConfig.instances !== undefined && camelConfig.desiredCapacity === undefined) {
      camelConfig.desiredCapacity = camelConfig.instances;
    }
  }

  if (serviceId === "s3" || serviceId === "gcp_storage" || serviceId === "azure_storage") {
    let nameVal = camelConfig.bucketName || camelConfig.bucketPrefix || camelConfig.bucket || camelConfig.name;
    if (typeof nameVal === "string" && nameVal.endsWith("-")) {
      nameVal = nameVal.slice(0, -1);
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

  if (serviceId === "ecs" || serviceId === "eks") {
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

  if (serviceId === "sg" || serviceId === "tg") {
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

export function getBaseId(id: string, serviceId: string): string {
  let clean = id.toLowerCase();
  if (clean.startsWith("sim_")) clean = clean.substring(4);
  if (clean.startsWith(`${serviceId.toLowerCase()}_`)) clean = clean.substring(serviceId.length + 1);
  return clean;
}

export function parseTfJsonToGraph(json: any, existingNodes?: any[]) {
  const parsedNodes: any[] = [];
  const parsedEdges: any[] = [];
  const resourceMap: Record<string, string> = {};
  const helperResources = new Set<string>();

  const resources = json.resource || {};
  for (const [resType, resMap] of Object.entries(resources)) {
    if (typeof resMap !== "object" || resMap === null) continue;
    for (const [resName] of Object.entries(resMap)) {
      const serviceId = SERVICE_ID_MAP[resType];
      const key = `${resType}.${resName}`;
      if (serviceId) {
        const existingNode = existingNodes?.find((n) => {
          if (n.data?.serviceId !== serviceId) return false;
          const cleanNodeId = getBaseId(n.id, serviceId);
          const cleanResName = getBaseId(resName, serviceId);
          return cleanNodeId === cleanResName;
        });

        let mappedId = resName.toLowerCase();
        if (mappedId.startsWith(`sim_${serviceId}_`)) {
          mappedId = mappedId.substring(4);
        } else if (mappedId.startsWith("sim_")) {
          mappedId = `${serviceId}_${mappedId.substring(4)}`;
        } else if (!mappedId.startsWith(`${serviceId}_`)) {
          mappedId = `${serviceId}_${mappedId}`;
        }

        resourceMap[key] = existingNode ? existingNode.id : mappedId;
      } else {
        helperResources.add(key);
      }
    }
  }

  for (const [resType, resMap] of Object.entries(resources)) {
    if (typeof resMap !== "object" || resMap === null) continue;
    for (const [resName, resBody] of Object.entries(resMap)) {
      if (typeof resBody !== "object" || resBody === null) continue;
      const key = `${resType}.${resName}`;
      const nodeId = resourceMap[key];
      if (!nodeId) continue;

      const serviceId = SERVICE_ID_MAP[resType];
      const parsedConfig = camelCaseConfig(resBody as Record<string, any>);
      const normalized = normalizeConfig(serviceId, parsedConfig);

      let customName = resName;
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

      parsedNodes.push({
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
        }
      });
    }
  }

  const getTransitiveTargets = (sourceKey: string, currentKey: string, visited = new Set<string>()): string[] => {
    if (visited.has(currentKey)) return [];
    visited.add(currentKey);

    const nodeId = resourceMap[currentKey];
    if (nodeId && currentKey !== sourceKey) return [nodeId];

    const resType = currentKey.split(".")[0];
    const resName = currentKey.split(".")[1];
    const resBody = resources[resType]?.[resName];
    if (!resBody || typeof resBody !== "object") return [];

    const targets: string[] = [];
    const bodyStr = JSON.stringify(resBody);
    const keysToCheck = [...Object.keys(resourceMap), ...Array.from(helperResources)];
    for (const targetKey of keysToCheck) {
      if (targetKey !== currentKey && bodyStr.includes(targetKey)) {
        targets.push(...getTransitiveTargets(sourceKey, targetKey, visited));
      }
    }
    return targets;
  };

  for (const [resType, resMap] of Object.entries(resources)) {
    if (typeof resMap !== "object" || resMap === null) continue;
    for (const [resName] of Object.entries(resMap)) {
      const key = `${resType}.${resName}`;
      const sourceId = resourceMap[key];
      if (sourceId) {
        const targets = getTransitiveTargets(key, key);
        for (const targetId of targets) {
          if (targetId !== sourceId && !parsedEdges.some(e => e.source === sourceId && e.target === targetId)) {
            parsedEdges.push({ source: sourceId, target: targetId });
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

              if (!parsedEdges.some(e => (e.source === src && e.target === tgt) || (e.source === tgt && e.target === src))) {
                parsedEdges.push({ source: src, target: tgt });
              }
            }
          }
        }
      }
    }
  }

  return { nodes: parsedNodes, edges: parsedEdges };
}
