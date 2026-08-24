import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureCosmosDbCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    const dbAccountName = compiler.shortId
      ? `${config.tableName}${compiler.shortId}`
      : config.tableName;

    // 1. Cosmos DB Account
    compiler.addResource(
      "azurerm_cosmosdb_account",
      name,
      {
        name: dbAccountName.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 44),
        location: r,
        resource_group_name: activeRgNameVal,
        offer_type: "Standard",
        kind: "GlobalDocumentDB",
        consistency_policy: {
          consistency_level: "Session",
        },
        geo_location: [
          {
            location: r,
            failover_priority: 0,
          },
        ],
      },
      "dynamodb",
      false,
      [...activeRgDep, ...deps],
      ["consistency_policy", "geo_location"],
    );

    // 2. Cosmos DB SQL Database
    compiler.addResource(
      "azurerm_cosmosdb_sql_database",
      `db_${name}`,
      {
        name: config.dbName || "sim-db",
        resource_group_name: activeRgNameVal,
        account_name: resolveInterpolation("azurerm_cosmosdb_account", name, "name"),
      },
      "dynamodb",
      true,
      [`azurerm_cosmosdb_account.${name}`],
    );

    // 3. Cosmos DB SQL Container (equivalent to DynamoDB Table)
    const partitionKey = config.hashKey ? `/${config.hashKey}` : "/id";
    compiler.addResource(
      "azurerm_cosmosdb_sql_container",
      `container_${name}`,
      {
        name: config.tableName || "sim-container",
        resource_group_name: activeRgNameVal,
        account_name: resolveInterpolation("azurerm_cosmosdb_account", name, "name"),
        database_name: resolveInterpolation("azurerm_cosmosdb_sql_database", `db_${name}`, "name"),
        partition_key_path: partitionKey,
      },
      "dynamodb",
      true,
      [
        `azurerm_cosmosdb_account.${name}`,
        `azurerm_cosmosdb_sql_database.db_${name}`,
      ],
    );
  }
}
