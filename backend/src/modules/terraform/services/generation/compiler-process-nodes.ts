import { ServiceSchemas } from "../../../../config/terraform-schemas";
import { parseConfigSafely } from "./helpers";
import { resolveInterpolation } from "./graph-resolver";
import type { CompilerArgs } from "./compilers/base.compiler";
import { awsRegistry, azureRegistry, gcpRegistry } from "./registry";
import type { TerraformCompiler } from "./compiler";

export function processNodes(compiler: TerraformCompiler) {
  const dependencyMap = new Map<string, string[]>();
  for (const edge of compiler.req.edges) {
    if (!dependencyMap.has(edge.target)) dependencyMap.set(edge.target, []);
    dependencyMap.get(edge.target)!.push(edge.source);
  }

  const provider = (compiler as any).provider;
  const region = (compiler as any).region;

  const typeMap: any = {
    ec2: "aws_instance",
    s3: "aws_s3_bucket",
    rds: "aws_db_instance",
    lambda: "aws_lambda_function",
    dynamodb: "aws_dynamodb_table",
    azure_vm: "azurerm_linux_virtual_machine",
    azure_storage: "azurerm_storage_account",
    azure_sql: "azurerm_mssql_database",
    azure_function: "azurerm_linux_function_app",
    azure_vnet: "azurerm_virtual_network",
    azure_aks: "azurerm_kubernetes_cluster",
    aws_vpc: "aws_vpc",
    gcp_compute: "google_compute_instance",
    gcp_storage: "google_storage_bucket",
    gcp_sql: "google_sql_database_instance",
    gcp_function: "google_cloudfunctions2_function",
    gcp_gke: "google_container_cluster",
    gcp_cloud_run: "google_cloud_run_v2_service",
    gcp_vpc: "google_compute_network",
    vpc:
      provider === "azure"
        ? "azurerm_virtual_network"
        : provider === "gcp"
          ? "google_compute_network"
          : "aws_vpc",
    elb: "aws_lb",
    azure_lb: "azurerm_lb",
    gcp_lb: "google_compute_global_forwarding_rule",
    asg: "aws_autoscaling_group",
    azure_vmss: "azurerm_linux_virtual_machine_scale_set",
    gcp_mig: "google_compute_instance_group_manager",
    apigateway: "aws_apigatewayv2_api",
    ecr: "aws_ecr_repository",
    azure_acr: "azurerm_container_registry",
    gcp_artifact_registry: "google_artifact_registry_repository",
    eip: "aws_eip",
    azure_pip: "azurerm_public_ip",
    gcp_ip: "google_compute_address",
    sg: "aws_security_group",
    azure_nsg: "azurerm_network_security_group",
    gcp_firewall: "google_compute_firewall",
    tg: "aws_lb_target_group",
    azure_tg: "azurerm_lb_backend_address_pool",
    gcp_tg: "google_compute_backend_service",
    ebs: "aws_ebs_volume",
    azure_disk: "azurerm_managed_disk",
    gcp_disk: "google_compute_disk",
    ecs:
      provider === "azure"
        ? "azurerm_kubernetes_cluster"
        : provider === "gcp"
          ? "google_cloud_run_v2_service"
          : "aws_ecs_cluster",
    eks:
      provider === "azure"
        ? "azurerm_kubernetes_cluster"
        : provider === "gcp"
          ? "google_container_cluster"
          : "aws_eks_cluster",
  };

  for (const node of compiler.req.nodes) {
    const schema = ServiceSchemas[node.serviceId];
    if (!schema) continue;

    if (
      node.serviceId === "vpc" ||
      node.serviceId === "aws_vpc" ||
      node.serviceId === "gcp_vpc" ||
      node.serviceId === "azure_vnet"
    ) {
      continue;
    }

    const config = parseConfigSafely(schema, node.config);
    let r = (config.region as string) || region;
    if (r && r.includes("azurerm_resource_group")) {
      const explicitRgNode = compiler.req.nodes.find(
        (n) => n.serviceId === "azure_rg"
      );
      if (explicitRgNode && explicitRgNode.config?.location) {
        r = explicitRgNode.config.location as string;
      }
    }
    const suffix = compiler.getInfraSuffix(r);
    const providerData = compiler.getProviderData(r);

    const name = `sim_${node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;

    const deps = (dependencyMap.get(node.id) || [])
      .map((depId) => {
        if (depId === node.id) return null;
        const depNode = compiler.req.nodes.find((n) => n.id === depId);
        if (!depNode) return null;

        const computeServices = [
          "ec2",
          "lambda",
          "ecs",
          "azure_vm",
          "azure_function",
          "gcp_compute",
          "gcp_function",
          "asg",
          "azure_vmss",
          "gcp_mig",
        ];
        const storageServices = [
          "s3",
          "rds",
          "dynamodb",
          "ecr",
          "azure_storage",
          "azure_sql",
          "azure_acr",
          "gcp_storage",
          "gcp_sql",
          "gcp_artifact_registry",
        ];
        if (
          computeServices.includes(depNode.serviceId) &&
          storageServices.includes(node.serviceId)
        ) {
          return null;
        }
        if (
          depNode.serviceId === "elb" ||
          depNode.serviceId === "azure_lb" ||
          depNode.serviceId === "gcp_lb" ||
          depNode.serviceId === "tg" ||
          depNode.serviceId === "azure_tg" ||
          depNode.serviceId === "gcp_tg" ||
          depNode.serviceId === "ebs" ||
          depNode.serviceId === "azure_disk" ||
          depNode.serviceId === "gcp_disk" ||
          depNode.serviceId === "sg" ||
          depNode.serviceId === "azure_nsg" ||
          depNode.serviceId === "gcp_firewall" ||
          depNode.serviceId === "eip" ||
          depNode.serviceId === "azure_pip" ||
          depNode.serviceId === "gcp_ip" ||
          node.serviceId === "elb" ||
          node.serviceId === "azure_lb" ||
          node.serviceId === "gcp_lb" ||
          node.serviceId === "tg" ||
          node.serviceId === "azure_tg" ||
          node.serviceId === "gcp_tg" ||
          node.serviceId === "ebs" ||
          node.serviceId === "azure_disk" ||
          node.serviceId === "gcp_disk" ||
          node.serviceId === "sg" ||
          node.serviceId === "azure_nsg" ||
          node.serviceId === "gcp_firewall" ||
          node.serviceId === "eip" ||
          node.serviceId === "azure_pip" ||
          node.serviceId === "gcp_ip"
        )
          return null;
        if (!typeMap[depNode.serviceId]) return null;
        const depName = `sim_${depNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        return `${typeMap[depNode.serviceId]}.${depName}`;
      })
      .filter((d): d is string => d !== null);

    const args: CompilerArgs = {
      node,
      config,
      name,
      r,
      suffix,
      deps: node.serviceId === "azure_rg" ? [] : deps,
      providerData,
    };

    if (provider === "azure") {
      const existingRg = process.env.AZURE_RESOURCE_GROUP;
      const explicitRgNode = compiler.req.nodes.find(
        (n) => n.serviceId === "azure_rg"
      );

      if (explicitRgNode) {
        const rawRgName = explicitRgNode.id
          .replace("azurerm_resource_group_", "")
          .replace("azure_rg_", "")
          .replace("rg_", "");
        args.rgDep = [`azurerm_resource_group.${rawRgName}`];
        args.rgNameVal = resolveInterpolation(
          "azurerm_resource_group",
          rawRgName,
          "name"
        );
      } else {
        args.rgDep = existingRg ? [] : [`azurerm_resource_group.${suffix}`];
        args.rgNameVal = existingRg
          ? `\${data.azurerm_resource_group.${suffix}.name}`
          : resolveInterpolation("azurerm_resource_group", suffix, "name");
      }

      const comp = azureRegistry[node.serviceId];
      if (comp) {
        comp.compile(args, compiler);
      }
    } else if (provider === "gcp") {
      const comp = gcpRegistry[node.serviceId];
      if (comp) {
        comp.compile(args, compiler);
      }
    } else {
      const comp = awsRegistry[node.serviceId];
      if (comp) {
        comp.compile(args, compiler);
      }
    }
  }
}
