import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureStorageCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    let storageName = config.bucketName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (compiler.shortId) {
      const depSuffix = compiler.shortId.replace(/-/g, "");
      storageName = `${storageName.substring(0, 24 - depSuffix.length)}${depSuffix}`;
    } else {
      storageName = storageName.substring(0, 24);
    }
    compiler.addResource(
      "azurerm_storage_account",
      name,
      {
        name: storageName,
        resource_group_name: activeRgNameVal,
        location: r,
        account_tier: config.accountTier,
        account_replication_type: config.replicationType,
        account_kind: config.accountKind,
      },
      "azure_storage",
      false,
      [...activeRgDep, ...deps],
    );
    if (config.policy) {
      let rulesArray: any[] = [
        {
          name: "default-rule",
          enabled: true,
          filters: {
            prefix_match: ["container1"],
            blob_types: ["blockBlob"],
          },
          actions: {
            base_blob: {
              tier_to_cool_after_days_since_modification_greater_than: 30,
            },
          },
        },
      ];

      try {
        const parsed = JSON.parse(config.policy);
        if (Array.isArray(parsed)) {
          rulesArray = parsed;
        } else if (parsed.rule) {
          rulesArray = Array.isArray(parsed.rule) ? parsed.rule : [parsed.rule];
        } else if (parsed.rules) {
          rulesArray = Array.isArray(parsed.rules) ? parsed.rules : [parsed.rules];
        }
      } catch (e) {
        // Fallback to default rulesArray
      }

      compiler.addResource(
        "azurerm_storage_management_policy",
        `${name}_policy`,
        {
          storage_account_id: resolveInterpolation("azurerm_storage_account", name, "id"),
          rule: rulesArray,
        },
        "azure_storage_policy",
        true,
        [`azurerm_storage_account.${name}`],
        ["rule", "filters", "actions", "base_blob"],
      );
    }
  }
}
