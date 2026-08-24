import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzurePipCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    compiler.addResource(
      "azurerm_public_ip",
      name,
      {
        name: config.name || "sim-pip",
        resource_group_name: activeRgNameVal,
        location: r,
        allocation_method: config.allocationMethod || "Static",
        sku: config.sku || "Standard",
      },
      "azure_pip",
      false,
      [...activeRgDep, ...deps],
    );
  }
}
