import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpTgCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps } = args;

    // Find all connected GCP VMs
    const connectedGcpVms =
      compiler.req.edges
        ?.filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => compiler.req.nodes.find((n) => n.id === id))
        .filter(
          (n): n is TfNodeInput => !!n && n.serviceId === "gcp_compute",
        ) ?? [];

    // Find all connected GCP MIGs
    const connectedGcpMigs =
      compiler.req.edges
        ?.filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => compiler.req.nodes.find((n) => n.id === id))
        .filter((n): n is TfNodeInput => !!n && n.serviceId === "gcp_mig") ??
      [];

    const vmInstancesLinks = connectedGcpVms.map((vm) => {
      const vmName = `sim_${vm.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      return resolveInterpolation(
        "google_compute_instance",
        vmName,
        "self_link",
      );
    });
    const vmDeps = connectedGcpVms.map((vm) => {
      const vmName = `sim_${vm.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      return `google_compute_instance.${vmName}`;
    });

    // 1. Unmanaged Instance Group (only if connected VMs exist)
    if (connectedGcpVms.length > 0) {
      compiler.addResource(
        "google_compute_instance_group",
        name,
        {
          name: compiler.sanitizeGcpResourceName(
            compiler.shortId
              ? `ig-${name}${compiler.shortId}`
              : `ig-${name}`,
          ),
          zone: `${r}-a`,
          instances: vmInstancesLinks,
        },
        "instance_group",
        true,
        vmDeps,
      );
    }

    // 2. Health Check
    compiler.addResource(
      "google_compute_http_health_check",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `hc-${name}${compiler.shortId}`
            : `hc-${name}`,
        ),
        port: Number(config.port || 80),
        request_path: "/",
      },
      "health_check",
      true,
    );

    // 3. Backend Service
    const backends: any[] = [];
    const backendDeps: string[] = [`google_compute_http_health_check.${name}`];

    if (connectedGcpVms.length > 0) {
      backends.push({
        group: resolveInterpolation(
          "google_compute_instance_group",
          name,
          "id",
        ),
      });
      backendDeps.push(`google_compute_instance_group.${name}`);
    }

    for (const mig of connectedGcpMigs) {
      const migName = `sim_${mig.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      backends.push({
        group: resolveInterpolation(
          "google_compute_instance_group_manager",
          migName,
          "instance_group",
        ),
      });
      backendDeps.push(`google_compute_instance_group_manager.${migName}`);
    }

    compiler.addResource(
      "google_compute_backend_service",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `backend-${name}${compiler.shortId}`
            : `backend-${name}`,
        ),
        protocol: config.protocol || "HTTP",
        port_name: "http",
        timeout_sec: 10,
        backend: backends,
        health_checks: [
          resolveInterpolation("google_compute_http_health_check", name, "id"),
        ],
      },
      "backend_service",
      false,
      backendDeps,
      ["backend"],
    );
  }
}
