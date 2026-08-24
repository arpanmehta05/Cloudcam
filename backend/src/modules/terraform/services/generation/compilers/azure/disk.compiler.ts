import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureDiskCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps } = args;
    const activeRgNameVal = args.rgNameVal || resolveInterpolation("azurerm_resource_group", suffix, "name");
    const activeRgDep = args.rgDep || [`azurerm_resource_group.${suffix}`];

    // 1. Create Managed Disk
    compiler.addResource(
      "azurerm_managed_disk",
      name,
      {
        name: config.diskName || name,
        location: r,
        resource_group_name: activeRgNameVal,
        storage_account_type: config.diskType || "Standard_LRS",
        create_option: "Empty",
        disk_size_gb: Number(config.sizeGb || 32),
      },
      "managed_disk",
      false,
      [...activeRgDep, ...deps],
    );

    // 2. Attach connected Azure VMs
    const connectedVms = compiler.req.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "azure_vm");

    for (const vm of connectedVms) {
      const vmName = `sim_${vm.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      
      compiler.addResource(
        "azurerm_virtual_machine_data_disk_attachment",
        `attach_${name}_${vmName}`,
        {
          managed_disk_id: resolveInterpolation("azurerm_managed_disk", name, "id"),
          virtual_machine_id: resolveInterpolation("azurerm_linux_virtual_machine", vmName, "id"),
          lun: "10",
          caching: "ReadWrite",
        },
        "disk_attachment",
        true,
        [
          `azurerm_managed_disk.${name}`,
          `azurerm_linux_virtual_machine.${vmName}`,
        ],
      );
    }
  }
}
