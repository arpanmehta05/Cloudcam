import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpLbCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;

    // Check if an explicit target group node is connected
    const connectedTgNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "gcp_tg" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let backendServiceId: string;
    let urlMapDeps: string[];

    if (connectedTgNodes.length > 0) {
      const tgNode = connectedTgNodes[0];
      const tgName = `sim_${tgNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      backendServiceId = resolveInterpolation(
        "google_compute_backend_service",
        tgName,
        "id",
      );
      urlMapDeps = [`google_compute_backend_service.${tgName}`];
    } else {
      // Fallback: Create implicit backend service and health check
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
                ? `${config.lbName}-ig${compiler.shortId}`
                : `${config.lbName}-ig`,
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
              ? `${config.lbName}-hc${compiler.shortId}`
              : `${config.lbName}-hc`,
          ),
          port: config.port,
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
              ? `${config.lbName}-backend${compiler.shortId}`
              : `${config.lbName}-backend`,
          ),
          protocol: "HTTP",
          port_name: "http",
          timeout_sec: 10,
          backend: backends,
          health_checks: [
            resolveInterpolation("google_compute_http_health_check", name, "id"),
          ],
        },
        "backend_service",
        true,
        backendDeps,
        ["backend"],
      );

      backendServiceId = resolveInterpolation(
        "google_compute_backend_service",
        name,
        "id",
      );
      urlMapDeps = [`google_compute_backend_service.${name}`];
    }

    // 4. URL Map
    compiler.addResource(
      "google_compute_url_map",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `${config.lbName}-urlmap${compiler.shortId}`
            : `${config.lbName}-urlmap`,
        ),
        default_service: backendServiceId,
      },
      "url_map",
      true,
      urlMapDeps,
    );

    // 5. HTTP Target Proxy
    compiler.addResource(
      "google_compute_target_http_proxy",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `${config.lbName}-proxy${compiler.shortId}`
            : `${config.lbName}-proxy`,
        ),
        url_map: resolveInterpolation("google_compute_url_map", name, "id"),
      },
      "proxy",
      true,
      [`google_compute_url_map.${name}`],
    );

    // 6. Global Forwarding Rule
    compiler.addResource(
      "google_compute_global_forwarding_rule",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `${config.lbName}${compiler.shortId}`
            : config.lbName,
        ),
        target: resolveInterpolation(
          "google_compute_target_http_proxy",
          name,
          "id",
        ),
        port_range: String(config.port),
      },
      "gcp_lb",
      false,
      [`google_compute_target_http_proxy.${name}`],
    );
  }
}
