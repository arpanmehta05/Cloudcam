import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpGkeCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { config, name, r, suffix, deps } = args;
    let locationVal = config.location || `${r}-a`;
    if (locationVal.includes("-") && !locationVal.startsWith(r)) {
      locationVal = `${r}-a`;
    }
    compiler.addResource(
      "google_container_cluster",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `${config.clusterName}${compiler.shortId}`
            : config.clusterName,
          40,
        ),
        location: locationVal,
        remove_default_node_pool: true,
        initial_node_count: 1,
        network: resolveInterpolation("google_compute_network", suffix, "name"),
        subnetwork: resolveInterpolation(
          "google_compute_subnetwork",
          `${suffix}_public`,
          "name",
        ),
        deletion_protection: false,
      },
      "gcp_gke",
      false,
      [
        `google_compute_network.${suffix}`,
        `google_compute_subnetwork.${suffix}_public`,
        ...deps,
      ],
    );

    compiler.addResource(
      "google_container_node_pool",
      `nodes_${name}`,
      {
        name: `${config.clusterName}-pool`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .substring(0, 40),
        location: locationVal,
        cluster: resolveInterpolation("google_container_cluster", name, "name"),
        node_count: config.nodeCount,
        node_config: {
          machine_type: config.machineType,
        },
      },
      "gcp_gke",
      true,
      [`google_container_cluster.${name}`],
      ["node_config"],
    );
  }
}
