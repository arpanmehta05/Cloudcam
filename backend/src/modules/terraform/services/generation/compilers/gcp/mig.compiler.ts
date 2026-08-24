import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpMigCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps } = args;
    let zoneVal = config.zone || "us-central1-a";
    if (!zoneVal.startsWith(r)) {
      zoneVal = `${r}-a`;
    }
    const dbEnvVars = compiler.resolveDatabaseDependencies(node.id);
    const githubConfig = compiler.resolveGithubDependency(node.id);
    const dockerHubConfig = compiler.resolveDockerHubDependency(node.id);
    const mergedConfig = {
      ...config,
      ...(githubConfig || {}),
      ...(dockerHubConfig || {}),
    };
    const bootstrapScript = compiler.generateBootstrapScript(
      mergedConfig,
      dbEnvVars,
      "debian",
    );

    const connectedGcpStorageNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "gcp_storage" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let saName: string | undefined;
    const templateDeps = [
      `google_compute_subnetwork.${suffix}_public`,
      `google_compute_firewall.${suffix}_ssh_http`,
      `tls_private_key.simulation`,
      ...deps,
    ];

    if (connectedGcpStorageNodes.length > 0) {
      saName = `sa_${name}`;
      compiler.addResource(
        "google_service_account",
        saName,
        {
          account_id: `sa-${name}`
            .substring(0, 30)
            .toLowerCase()
            .replace(/_/g, "-"),
          display_name: `Service Account for GCP MIG ${config.instanceName}`,
        },
        "iam",
        true,
      );

      for (const storageNode of connectedGcpStorageNodes) {
        const gcsName = `sim_${storageNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        compiler.addResource(
          "google_storage_bucket_iam_member",
          `iam_${name}_${gcsName}`,
          {
            bucket: resolveInterpolation(
              "google_storage_bucket",
              gcsName,
              "name",
            ),
            role: "roles/storage.objectAdmin",
            member: `serviceAccount:\${google_service_account.${saName}.email}`,
          },
          "iam",
          true,
          [
            `google_service_account.${saName}`,
            `google_storage_bucket.${gcsName}`,
          ],
        );
      }
      templateDeps.push(`google_service_account.${saName}`);
    }

    const templateParams: any = {
      name_prefix: `${compiler.sanitizeGcpResourceName(config.instanceName)}-template-`,
      machine_type: config.machineType,
      disk: [
        {
          source_image: config.image,
          auto_delete: true,
          boot: true,
          disk_size_gb: Number(config.bootDiskGb || 20),
        },
      ],
      network_interface: [
        {
          subnetwork: resolveInterpolation(
            "google_compute_subnetwork",
            `${suffix}_public`,
            "id",
          ),
          ...(compiler.isRegionPrivate(r, "gcp") ? {} : { access_config: [{}] }),
        },
      ],
      metadata: {
        "ssh-keys": `cloudwatcher:\${tls_private_key.simulation.public_key_openssh}`,
        ...(bootstrapScript ? { "startup-script": bootstrapScript } : {}),
      },
    };

    if (saName) {
      templateParams.service_account = [
        {
          email: resolveInterpolation(
            "google_service_account",
            saName,
            "email",
          ),
          scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        },
      ];
    }

    // Create Instance Template
    compiler.addResource(
      "google_compute_instance_template",
      `template_${name}`,
      templateParams,
      "instance_template",
      true,
      templateDeps,
    );

    // Create Instance Group Manager
    const migParams: any = {
      name: compiler.sanitizeGcpResourceName(
        compiler.shortId
          ? `${config.instanceName}${compiler.shortId}`
          : config.instanceName,
      ),
      base_instance_name: compiler.sanitizeGcpResourceName(config.instanceName),
      zone: zoneVal,
      version: [
        {
          instance_template: resolveInterpolation(
            "google_compute_instance_template",
            `template_${name}`,
            "id",
          ),
        },
      ],
      named_port: [
        {
          name: "http",
          port: 80,
        },
      ],
    };

    compiler.addResource(
      "google_compute_instance_group_manager",
      name,
      migParams,
      "gcp_mig",
      false,
      [`google_compute_instance_template.template_${name}`],
    );

    // Create Autoscaler
    const autoscalerParams: any = {
      name: compiler.sanitizeGcpResourceName(
        compiler.shortId
          ? `${config.instanceName}-as${compiler.shortId}`
          : `${config.instanceName}-as`,
      ),
      zone: zoneVal,
      target: resolveInterpolation(
        "google_compute_instance_group_manager",
        name,
        "id",
      ),
      autoscaling_policy: [
        {
          max_replicas: Number(config.maxSize || 3),
          min_replicas: Number(config.minSize || 1),
          cooldown_period: 60,
          cpu_utilization: [
            {
              target: Number((config.cpuTarget || 60) / 100),
            },
          ],
        },
      ],
    };

    compiler.addResource(
      "google_compute_autoscaler",
      `autoscaler_${name}`,
      autoscalerParams,
      "autoscaler",
      true,
      [`google_compute_instance_group_manager.${name}`],
    );
  }
}
