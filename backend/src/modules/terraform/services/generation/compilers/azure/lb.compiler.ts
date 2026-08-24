import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureLbCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    const isPrivate = compiler.isRegionPrivate(r, "azure") || config.isPrivate === true || config.isPrivate === "true";

    const connectedPip = compiler.req.nodes.find(
      (n) =>
        n.serviceId === "azure_pip" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    const pipName = connectedPip
      ? `sim_${connectedPip.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`
      : `pip_${name}`;

    if (!isPrivate && !connectedPip) {
      // Create Public IP for LB
      compiler.addResource(
        "azurerm_public_ip",
        pipName,
        {
          name: `sim-pip-lb-${name}`,
          location: r,
          resource_group_name: activeRgNameVal,
          allocation_method: "Static",
          sku: "Standard",
        },
        "pip",
        true,
        activeRgDep,
      );
    }

    const frontendIpConfig = isPrivate
      ? {
          name: "LoadBalancerFrontEnd",
          subnet_id: resolveInterpolation(
            "azurerm_subnet",
            `${suffix}_public`,
            "id"
          ),
          private_ip_address_allocation: "Dynamic",
        }
      : {
          name: "PublicIPAddress",
          public_ip_address_id: resolveInterpolation(
            "azurerm_public_ip",
            pipName,
            "id",
          ),
        };

    const lbDeps = isPrivate
      ? [...activeRgDep, `azurerm_subnet.${suffix}_public`]
      : [...activeRgDep, `azurerm_public_ip.${pipName}`];

    // Create Load Balancer
    compiler.addResource(
      "azurerm_lb",
      name,
      {
        name: compiler.shortId
          ? `${config.lbName}${compiler.shortId}`
          : config.lbName,
        location: r,
        resource_group_name: activeRgNameVal,
        sku: "Standard",
        frontend_ip_configuration: [frontendIpConfig],
      },
      "azure_lb",
      false,
      lbDeps,
      ["frontend_ip_configuration"],
    );

    // Check if an explicit target group node is connected
    const connectedTgNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "azure_tg" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let backendPoolId: string;
    let ruleDeps: string[];

    if (connectedTgNodes.length > 0) {
      const tgNode = connectedTgNodes[0];
      const tgName = `sim_${tgNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      backendPoolId = resolveInterpolation("azurerm_lb_backend_address_pool", tgName, "id");
      ruleDeps = [
        `azurerm_lb.${name}`,
        `azurerm_lb_backend_address_pool.${tgName}`,
        `azurerm_lb_probe.${name}`,
      ];
    } else {
      // Fallback: Create implicit backend address pool
      compiler.addResource(
        "azurerm_lb_backend_address_pool",
        name,
        {
          loadbalancer_id: resolveInterpolation("azurerm_lb", name, "id"),
          name: "BackEndAddressPool",
        },
        "backend_pool",
        true,
        [`azurerm_lb.${name}`],
      );
      backendPoolId = resolveInterpolation("azurerm_lb_backend_address_pool", name, "id");
      ruleDeps = [
        `azurerm_lb.${name}`,
        `azurerm_lb_backend_address_pool.${name}`,
        `azurerm_lb_probe.${name}`,
      ];
    }

    // Health Probe
    compiler.addResource(
      "azurerm_lb_probe",
      name,
      {
        loadbalancer_id: resolveInterpolation("azurerm_lb", name, "id"),
        name: "http-running-probe",
        port: config.backendPort,
      },
      "probe",
      true,
      [`azurerm_lb.${name}`],
    );

    // Load Balancer Rule
    compiler.addResource(
      "azurerm_lb_rule",
      name,
      {
        loadbalancer_id: resolveInterpolation("azurerm_lb", name, "id"),
        name: "LBRule",
        protocol: "Tcp",
        frontend_port: config.frontendPort,
        backend_port: config.backendPort,
        frontend_ip_configuration_name: isPrivate ? "LoadBalancerFrontEnd" : "PublicIPAddress",
        backend_address_pool_ids: [backendPoolId],
        probe_id: resolveInterpolation("azurerm_lb_probe", name, "id"),
      },
      "rule",
      true,
      ruleDeps,
    );

    // Find all connected VMs and associate them (fallback/direct connection)
    if (connectedTgNodes.length === 0) {
      const connectedAzureVms = compiler.req.edges
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => compiler.req.nodes.find((n) => n.id === id))
        .filter((n): n is TfNodeInput => !!n && n.serviceId === "azure_vm");

      for (const vm of connectedAzureVms) {
        const vmName = `sim_${vm.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        compiler.addResource(
          "azurerm_network_interface_backend_address_pool_association",
          `assoc_${name}_${vmName}`,
          {
            network_interface_id: resolveInterpolation(
              "azurerm_network_interface",
              `nic_${vmName}`,
              "id",
            ),
            ip_configuration_name: "internal",
            backend_address_pool_id: resolveInterpolation(
              "azurerm_lb_backend_address_pool",
              name,
              "id",
            ),
          },
          "backend_association",
          true,
          [
            `azurerm_network_interface.nic_${vmName}`,
            `azurerm_lb_backend_address_pool.${name}`,
          ],
        );
      }
    }
  }
}
