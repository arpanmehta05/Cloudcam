import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureTgCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps, providerData } = args;
    const activeRgNameVal = args.rgNameVal || resolveInterpolation("azurerm_resource_group", suffix, "name");
    const activeRgDep = args.rgDep || [`azurerm_resource_group.${suffix}`];

    // Find the connected load balancer
    const connectedLbNode = compiler.req.nodes.find(
      (n) =>
        n.serviceId === "azure_lb" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    if (connectedLbNode) {
      const lbName = `sim_${connectedLbNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      
      // Create Backend Address Pool
      compiler.addResource(
        "azurerm_lb_backend_address_pool",
        name,
        {
          loadbalancer_id: resolveInterpolation("azurerm_lb", lbName, "id"),
          name: config.name || `tg-${name}`,
        },
        "backend_pool",
        false,
        [`azurerm_lb.${lbName}`],
      );

      // Attach connected VMs
      const connectedVms = compiler.req.edges
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => compiler.req.nodes.find((n) => n.id === id))
        .filter((n): n is TfNodeInput => !!n && n.serviceId === "azure_vm");

      for (const vm of connectedVms) {
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
