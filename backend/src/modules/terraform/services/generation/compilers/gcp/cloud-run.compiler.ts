import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpCloudRunCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;

    const serviceName = (config.serviceName || config.clusterName || `sim-run-${node.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 50);
    const cpu = config.cpu || "1";
    const memory = config.memory || "512Mi";
    const appPort = Number(config.appPort || 80);
    const desiredCount = Number(config.desiredCount || 1);

    // 1. Resolve edge connections to GCP Artifact Registry or unified ECR
    const connectedEcrNodes = compiler.req.nodes.filter(
      (n) =>
        (n.serviceId === "gcp_artifact_registry" || n.serviceId === "ecr") &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    const connectedDockerHubNodes = compiler.req.nodes.filter(
      (n) =>
        (n.serviceId as string) === "dockerhub" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let imageUrl = "nginx:latest";
    const ecrDeps: string[] = [];
    if (connectedEcrNodes.length > 0) {
      const ecrNode = connectedEcrNodes[0];
      const ecrName = `sim_${ecrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      
      const ecrConfig = ecrNode.serviceId === "ecr"
        ? (ServiceSchemas["ecr"]?.parse(ecrNode.config || {}) || {})
        : (ServiceSchemas["gcp_artifact_registry"]?.parse(ecrNode.config || {}) || {});

      const imageTag = ecrConfig.imageTag || "latest";
      imageUrl = `\${google_artifact_registry_repository.${ecrName}.location}-docker.pkg.dev/\${google_artifact_registry_repository.${ecrName}.project}/\${google_artifact_registry_repository.${ecrName}.repository_id}/sim-app:${imageTag}`;
      ecrDeps.push(`google_artifact_registry_repository.${ecrName}`);
    } else if (connectedDockerHubNodes.length > 0) {
      const dhNode = connectedDockerHubNodes[0];
      const schema = ServiceSchemas["dockerhub"];
      const dhConfig = schema ? schema.parse(dhNode.config || {}) : (dhNode.config || {});
      imageUrl = `${dhConfig.repository || "library/nginx"}:${dhConfig.tag || "latest"}`;
    }

    // 2. Create Google Cloud Run V2 Service
    compiler.addResource(
      "google_cloud_run_v2_service",
      name,
      {
        name: serviceName,
        location: r,
        ingress: "INGRESS_TRAFFIC_ALL",
        template: {
          containers: [
            {
              image: imageUrl,
              ports: [
                {
                  container_port: appPort,
                },
              ],
              resources: {
                limits: {
                  cpu: cpu,
                  memory: memory,
                },
              },
            },
          ],
          scaling: {
            max_instance_count: desiredCount,
          },
        },
      },
      "ecs",
      false,
      [...deps, ...ecrDeps],
      ["template", "containers", "ports", "resources", "limits", "scaling"],
    );

    // 3. Grant public read (no-auth) invoker access to the service endpoint
    compiler.addResource(
      "google_cloud_run_v2_service_iam_member",
      `noauth_${name}`,
      {
        location: resolveInterpolation("google_cloud_run_v2_service", name, "location"),
        project: resolveInterpolation("google_cloud_run_v2_service", name, "project"),
        name: resolveInterpolation("google_cloud_run_v2_service", name, "name"),
        role: "roles/run.invoker",
        member: "allUsers",
      },
      "ecs",
      true,
      [`google_cloud_run_v2_service.${name}`],
    );
  }
}
