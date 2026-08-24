import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureSqlCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    compiler.addResource(
      "azurerm_mssql_server",
      `server_${name}`,
      {
        name: `sim-${name}-sqlserver`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .substring(0, 60),
        resource_group_name: activeRgNameVal,
        location: r,
        version: "12.0",
        administrator_login: "sqladmin",
        administrator_login_password: "Rabbittize1234!",
      },
      "sqlserver",
      true,
      activeRgDep,
    );

    compiler.addResource(
      "azurerm_mssql_database",
      name,
      {
        name: config.dbName,
        server_id: resolveInterpolation(
          "azurerm_mssql_server",
          `server_${name}`,
          "id",
        ),
        collation: config.collation,
        max_size_gb: Math.ceil(config.maxSizeBytes / (1024 * 1024 * 1024)),
        sku_name: config.skuName,
      },
      "azure_sql",
      false,
      [`azurerm_mssql_server.server_${name}`, ...deps],
    );
  }
}
