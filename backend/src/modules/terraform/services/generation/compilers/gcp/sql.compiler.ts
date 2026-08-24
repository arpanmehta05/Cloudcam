import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpSqlCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;
    const connectedGcpComputeNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "gcp_compute" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    const sqlSettings: any = {
      tier: config.tier,
    };

    const sqlNestedBlocks = ["settings"];

    if (connectedGcpComputeNodes.length > 0) {
      sqlSettings.ip_configuration = {
        authorized_networks: [
          {
            value: "0.0.0.0/0",
            name: "allow-simulated-vms",
          },
        ],
      };
      sqlNestedBlocks.push("ip_configuration");
    }

    compiler.addResource(
      "google_sql_database_instance",
      `instance_${name}`,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `${config.instanceName}${compiler.shortId}`
            : config.instanceName,
        ),
        database_version: config.databaseVersion,
        region: r,
        settings: sqlSettings,
        deletion_protection: false,
      },
      "gcp_sql",
      true,
      [],
      sqlNestedBlocks,
    );

    compiler.addResource(
      "google_sql_database",
      name,
      {
        name: compiler.sanitizeGcpResourceName(config.databaseName),
        instance: resolveInterpolation(
          "google_sql_database_instance",
          `instance_${name}`,
          "name",
        ),
      },
      "gcp_sql",
      false,
      [`google_sql_database_instance.instance_${name}`, ...deps],
    );

    compiler.addResource(
      "google_sql_user",
      `user_${name}`,
      {
        name: "sqladmin",
        instance: resolveInterpolation(
          "google_sql_database_instance",
          `instance_${name}`,
          "name",
        ),
        password: "Rabbittize1234!",
      },
      "gcp_sql",
      true,
      [`google_sql_database_instance.instance_${name}`],
    );
  }
}
