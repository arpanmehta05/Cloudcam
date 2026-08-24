import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureAcrCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    const rawRegistryName = config.registryName || config.repositoryName || "simregistry";
    const sanitizedName = rawRegistryName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 50);

    compiler.addResource(
      "azurerm_container_registry",
      name,
      {
        name: sanitizedName,
        resource_group_name: activeRgNameVal,
        location: r,
        sku: config.sku || "Basic",
        admin_enabled: config.adminEnabled !== undefined ? config.adminEnabled : false,
      },
      "azure_acr",
      false,
      [...activeRgDep, ...deps],
    );
  }
}
