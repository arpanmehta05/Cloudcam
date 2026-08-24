import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpComputeCompiler implements ResourceCompiler {
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

    const metadataParams: any = {
      ssh_keys: `cloudwatcher:\${tls_private_key.simulation.public_key_openssh}`,
    };
    if (bootstrapScript) {
      metadataParams["startup-script"] = bootstrapScript;
    }

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

    const connectedIp = compiler.req.nodes.find(
      (n) =>
        n.serviceId === "gcp_ip" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    // Scan for connected GCP Firewall nodes
    const connectedFwNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "gcp_firewall" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    const gceDeps = [
      `google_compute_subnetwork.${suffix}_public`,
      `google_compute_firewall.${suffix}_ssh_http`,
      `tls_private_key.simulation`,
      ...deps,
    ];

    const isPrivate = compiler.isRegionPrivate(r, "gcp");
    const accessConfig: any = {};
    let hasAccessConfig = !isPrivate;

    if (connectedIp) {
      const ipName = `sim_${connectedIp.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      accessConfig.nat_ip = resolveInterpolation(
        "google_compute_address",
        ipName,
        "address",
      );
      gceDeps.push(`google_compute_address.${ipName}`);
      hasAccessConfig = true;
    }

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
          display_name: `Service Account for GCE VM ${config.instanceName}`,
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
    }

    const gceParams: any = {
      name: compiler.sanitizeGcpResourceName(
        compiler.shortId
          ? `${config.instanceName}${compiler.shortId}`
          : config.instanceName,
      ),
      machine_type: config.machineType,
      zone: zoneVal,
      tags: (() => {
        const t = config.allowHttp
          ? ["cloudwatcher-sim", "http-server", "https-server"]
          : ["cloudwatcher-sim"];
        for (const fwNode of connectedFwNodes) {
          const fwName = `sim_${fwNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
          t.push(`tag-${fwName}`);
          gceDeps.push(`google_compute_firewall.${fwName}`);
        }
        return t;
      })(),
      boot_disk: {
        initialize_params: {
          image: config.image,
          size: config.bootDiskGb,
        },
      },
      network_interface: {
        subnetwork: resolveInterpolation(
          "google_compute_subnetwork",
          `${suffix}_public`,
          "id",
        ),
        ...(hasAccessConfig ? { access_config: accessConfig } : {}),
      },
      metadata: metadataParams,
    };

    const gceNestedBlocks = [
      "boot_disk",
      "initialize_params",
      "network_interface",
      "access_config",
    ];

    if (saName) {
      gceParams.service_account = {
        email: resolveInterpolation("google_service_account", saName, "email"),
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      };
      gceNestedBlocks.push("service_account");
      gceDeps.push(`google_service_account.${saName}`);
    }

    compiler.addResource(
      "google_compute_instance",
      name,
      gceParams,
      "gcp_compute",
      false,
      gceDeps,
      gceNestedBlocks,
    );
  }
}
