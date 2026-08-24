import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureFunctionCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    let saName = `saforfunc${name}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (saName.length > 24) {
      saName = saName.substring(0, 16) + saName.substring(saName.length - 8);
    }
    compiler.addResource(
      "azurerm_storage_account",
      `storage_${name}`,
      {
        name: saName,
        resource_group_name: activeRgNameVal,
        location: r,
        account_tier: "Standard",
        account_replication_type: "LRS",
      },
      "azure_storage",
      true,
      activeRgDep,
    );

    compiler.addResource(
      "azurerm_service_plan",
      `plan_${name}`,
      {
        name: `sim-plan-${name}`,
        resource_group_name: activeRgNameVal,
        location: r,
        os_type: "Linux",
        sku_name: config.skuName,
      },
      "plan",
      true,
      activeRgDep,
    );

    compiler.addResource(
      "azurerm_linux_function_app",
      name,
      {
        name: compiler.shortId
          ? `${config.functionName}${compiler.shortId}`
          : config.functionName,
        resource_group_name: activeRgNameVal,
        location: r,
        storage_account_name: resolveInterpolation(
          "azurerm_storage_account",
          `storage_${name}`,
          "name",
        ),
        storage_account_access_key: resolveInterpolation(
          "azurerm_storage_account",
          `storage_${name}`,
          "primary_access_key",
        ),
        service_plan_id: resolveInterpolation(
          "azurerm_service_plan",
          `plan_${name}`,
          "id",
        ),
        site_config: {},
      },
      "azure_function",
      false,
      [
        ...activeRgDep,
        `azurerm_storage_account.storage_${name}`,
        `azurerm_service_plan.plan_${name}`,
        ...deps,
      ],
      ["site_config"],
    );
  }
}
