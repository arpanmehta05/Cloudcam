import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import { resolveInterpolation } from "../graph-resolver";
import type { TerraformCompiler } from "../compiler";

export function injectImplicitInfrastructureGcp(
  compiler: TerraformCompiler,
  baseName: string,
  shortId: string
) {
  const gceRegions = new Set<string>();
  const networkRegions = new Set<string>();

  for (const node of compiler.req.nodes) {
    const schema = ServiceSchemas[node.serviceId];
    if (!schema) continue;
    const config = schema.parse(node.config);
    const r = (config.region as string) || compiler.req.region;

    if (node.serviceId === "gcp_compute" || node.serviceId === "gcp_mig")
      gceRegions.add(r);
    if (
      node.serviceId === "gcp_compute" ||
      node.serviceId === "gcp_mig" ||
      node.serviceId === "gcp_gke" ||
      node.serviceId === "gcp_vpc" ||
      node.serviceId === "vpc"
    )
      networkRegions.add(r);
  }

  if (gceRegions.size > 0) {
    compiler.addResource(
      "tls_private_key",
      "simulation",
      {
        algorithm: "RSA",
        rsa_bits: 4096,
      },
      "tls",
      true
    );
  }

  for (const r of networkRegions) {
    const suffix = compiler.getInfraSuffix(r);

    const explicitVpcNode = compiler.req.nodes.find(
      (n) =>
        (n.serviceId === "gcp_vpc" || n.serviceId === "vpc") &&
        ((ServiceSchemas[n.serviceId]?.parse(n.config)?.region as string) ||
          compiler.req.region) === r
    );
    let explicitVpcConfig: any = null;
    if (explicitVpcNode) {
      const schema = ServiceSchemas[explicitVpcNode.serviceId];
      explicitVpcConfig = schema
        ? schema.parse(explicitVpcNode.config || {})
        : explicitVpcNode.config;
    }

    const networkNameVal = (
      explicitVpcConfig?.networkName ||
      explicitVpcConfig?.vpcName ||
      compiler.getRunName(baseName, shortId, "vpc", r)
    )
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .substring(0, 63);
    const subnetCidrVal =
      explicitVpcConfig?.subnetCidrBlock || "10.0.1.0/24";

    compiler.addResource(
      "google_compute_network",
      suffix,
      {
        name: networkNameVal,
        auto_create_subnetworks: false,
      },
      "vpc",
      true
    );

    compiler.addResource(
      "google_compute_subnetwork",
      `${suffix}_public`,
      {
        name: compiler.getRunName(baseName, shortId, "subnet", r).substring(
          0,
          63
        ),
        ip_cidr_range: subnetCidrVal,
        region: r,
        network: resolveInterpolation(
          "google_compute_network",
          suffix,
          "id"
        ),
      },
      "subnet",
      true,
      [`google_compute_network.${suffix}`]
    );

    const sshPortVal =
      explicitVpcConfig && explicitVpcConfig.sshPort !== undefined
        ? String(explicitVpcConfig.sshPort)
        : "22";
    const httpPortVal =
      explicitVpcConfig && explicitVpcConfig.httpPort !== undefined
        ? String(explicitVpcConfig.httpPort)
        : "80";
    const httpsPortVal =
      explicitVpcConfig && explicitVpcConfig.httpsPort !== undefined
        ? String(explicitVpcConfig.httpsPort)
        : "443";

    const allowedPorts = [sshPortVal, httpPortVal, httpsPortVal];
    for (const n of compiler.req.nodes) {
      if (n.serviceId === "gcp_compute" || n.serviceId === "gcp_mig") {
        const schema = ServiceSchemas[n.serviceId];
        const nConfig = schema ? schema.parse(n.config) : n.config;
        const nodeRegion = nConfig.region || compiler.req.region;
        if (nodeRegion === r) {
          const githubConfig = compiler.resolveGithubDependency(n.id);
          const appPort =
            nConfig.appPort || (githubConfig && githubConfig.appPort);
          if (appPort && !allowedPorts.includes(String(appPort))) {
            allowedPorts.push(String(appPort));
          }
        }
      }
    }

    compiler.addResource(
      "google_compute_firewall",
      `${suffix}_ssh_http`,
      {
        name: compiler.getRunName(baseName, shortId, "fw", r).substring(0, 63),
        network: resolveInterpolation(
          "google_compute_network",
          suffix,
          "name"
        ),
        allow: [{ protocol: "tcp", ports: allowedPorts }],
        source_ranges: ["0.0.0.0/0"],
        target_tags: ["cloudwatcher-sim"],
      },
      "sg",
      true,
      [`google_compute_network.${suffix}`],
      ["allow"]
    );
  }
}
