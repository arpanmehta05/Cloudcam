import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpDiskCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps } = args;

    // 1. Create Compute Disk
    compiler.addResource(
      "google_compute_disk",
      name,
      {
        name: compiler.sanitizeGcpResourceName(config.diskName || name),
        zone: config.zone || `${r}-a`,
        size: Number(config.sizeGb || 30),
        type: config.diskType || "pd-standard",
      },
      "gcp_disk",
      false,
      deps,
    );

    // 2. Attach connected GCP compute VMs
    const connectedVms = compiler.req.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "gcp_compute");

    for (const vm of connectedVms) {
      const vmName = `sim_${vm.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      
      compiler.addResource(
        "google_compute_attached_disk",
        `attach_${name}_${vmName}`,
        {
          disk: resolveInterpolation("google_compute_disk", name, "id"),
          instance: resolveInterpolation("google_compute_instance", vmName, "id"),
        },
        "disk_attachment",
        true,
        [
          `google_compute_disk.${name}`,
          `google_compute_instance.${vmName}`,
        ],
      );
    }
  }
}
