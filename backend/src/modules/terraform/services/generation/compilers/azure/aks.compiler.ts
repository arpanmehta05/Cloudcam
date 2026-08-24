import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureAksCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    const nodeCount = config.nodeCount || config.desiredCount || 1;
    const vmSize = config.nodeVmSize || "Standard_B2s";
    const clusterName = config.clusterName || config.serviceName || `sim-aks-${node.id.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

    // 1. Create AKS Cluster
    compiler.addResource(
      "azurerm_kubernetes_cluster",
      name,
      {
        name: clusterName,
        location: r,
        resource_group_name: activeRgNameVal,
        dns_prefix: config.dnsPrefix || "simaks",
        default_node_pool: {
          name: "default",
          node_count: nodeCount,
          vm_size: vmSize,
        },
        identity: {
          type: "SystemAssigned",
        },
      },
      "ecs",
      false,
      [...activeRgDep, ...deps],
      ["default_node_pool", "identity"],
    );

    // 2. Resolve edge connections to Azure Container Registry (ACR)
    const connectedAcrNodes = compiler.req.nodes.filter(
      (n) =>
        (n.serviceId === "azure_acr" || n.serviceId === "ecr") &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    if (connectedAcrNodes.length > 0) {
      const acrNode = connectedAcrNodes[0];
      const acrName = `sim_${acrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;

      compiler.addResource(
        "azurerm_role_assignment",
        `role_aks_acr_${name}`,
        {
          principal_id: `\${azurerm_kubernetes_cluster.${name}.kubelet_identity[0].object_id}`,
          role_definition_name: "AcrPull",
          scope: resolveInterpolation("azurerm_container_registry", acrName, "id"),
          skip_service_principal_aad_check: true,
        },
        "ecs",
        false,
        [
          `azurerm_kubernetes_cluster.${name}`,
          `azurerm_container_registry.${acrName}`,
        ],
      );
    }
  }
}
