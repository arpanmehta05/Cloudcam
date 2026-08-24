import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureVnetCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    compiler.addResource(
      "azurerm_virtual_network",
      name,
      {
        name: compiler.shortId
          ? `${config.vnetName}${compiler.shortId}`
          : config.vnetName,
        address_space: [config.addressSpace],
        location: r,
        resource_group_name: activeRgNameVal,
      },
      "azure_vnet",
      false,
      [...activeRgDep, ...deps],
    );
  }
}
