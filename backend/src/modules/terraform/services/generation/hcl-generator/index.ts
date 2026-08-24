import { HclBuilder, type HclValue } from "../hcl-builder";
import type { TerraformCompiler } from "../compiler";
import type { ResourceNode } from "../graph-resolver";
import { generateVmInfoOutputs } from "./vm-info";
import { generateOtherOutputs } from "./other-outputs";

export function generateHclBlocks(
  compiler: TerraformCompiler,
  nodes: ResourceNode[]
): string[] {

  const blocks: string[] = [];

  const hasVm = compiler.req.nodes.some(
    (n) =>
      n.serviceId === "ec2" ||
      n.serviceId === "azure_vm" ||
      n.serviceId === "gcp_compute" ||
      n.serviceId === "asg" ||
      n.serviceId === "azure_vmss" ||
      n.serviceId === "gcp_mig"
  );
  const requiredProviders: any = {};

  const provider = (compiler as any).provider;
  const region = (compiler as any).region;

  if (provider === "azure") {
    requiredProviders.azurerm = {
      source: "hashicorp/azurerm",
      version: "~> 4.1.0",
    };
    if (hasVm) {
      requiredProviders.tls = {
        source: "hashicorp/tls",
        version: "~> 4.0.0",
      };
    }
  } else if (provider === "gcp") {
    requiredProviders.google = {
      source: "hashicorp/google",
      version: "~> 6.0",
    };
    if (hasVm) {
      requiredProviders.tls = {
        source: "hashicorp/tls",
        version: "~> 4.0.0",
      };
    }
  } else {
    requiredProviders.aws = { source: "hashicorp/aws", version: "~> 6.44.0" };
    if (hasVm) {
      requiredProviders.tls = {
        source: "hashicorp/tls",
        version: "~> 4.0.0",
      };
    }
  }

  const hasK8s = compiler.resources.some((r) => r.type.startsWith("kubernetes_"));
  if (hasK8s) {
    requiredProviders.kubernetes = {
      source: "hashicorp/kubernetes",
      version: "~> 2.35.0",
    };
  }

  blocks.push(
    HclBuilder.generateBlock(
      "terraform",
      [],
      {
        required_providers: requiredProviders,
      },
      ["required_providers"]
    )
  );

  // Provider configuration blocks
  if (provider === "azure") {
    blocks.push(
      HclBuilder.generateBlock(
        "provider",
        ["azurerm"],
        {
          features: {},
          resource_provider_registrations: "none",
        },
        ["features"]
      )
    );
  } else if (provider === "gcp") {
    blocks.push(
      HclBuilder.generateBlock("provider", ["google"], {
        region: region,
      })
    );
  } else {
    blocks.push(
      HclBuilder.generateBlock("provider", ["aws"], {
        region: region,
      })
    );
  }

  if (hasK8s) {
    const eksCluster = compiler.resources.find((r) => r.type === "aws_eks_cluster");
    if (eksCluster) {
      blocks.push(
        HclBuilder.generateBlock("provider", ["kubernetes"], {
          host: `\${aws_eks_cluster.${eksCluster.name}.endpoint}`,
          cluster_ca_certificate: `\${base64decode(aws_eks_cluster.${eksCluster.name}.certificate_authority[0].data)}`,
          token: `\${data.aws_eks_cluster_auth.cluster_${eksCluster.name}.token}`,
        })
      );
    }
  }

  // Cross-region AWS providers
  if (provider === "aws") {
    for (const r of (compiler as any).uniqueRegions) {
      if (r !== region) {
        blocks.push(
          HclBuilder.generateBlock("provider", ["aws"], {
            alias: `aws_${r.replace(/-/g, "_")}`,
            region: r,
          })
        );
      }
    }
  }

  // Variables, Locals
  for (const [key, val] of Object.entries((compiler as any).locals)) {
    blocks.push(HclBuilder.generateBlock("locals", [], { [key]: val } as Record<string, HclValue>));
  }

  // DataSource blocks
  for (const node of (compiler as any).dataSources) {
    blocks.push(
      HclBuilder.generateBlock(
        "data",
        [node.type, node.name],
        node.data,
        node.nestedBlocks
      )
    );
  }

  // Resource blocks
  for (const node of nodes) {
    blocks.push(
      HclBuilder.generateBlock(
        "resource",
        [node.type, node.name],
        node.data,
        node.nestedBlocks
      )
    );
  }

  // Generate Other outputs (Load Balancers, ECR/push, API Gateway, CDN)
  generateOtherOutputs(compiler, blocks);

  // Generate VM-specific info outputs
  const baseName = (compiler.req.name || "simulation")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();
  const shortId = compiler.req.deploymentId
    ? `-${compiler.req.deploymentId.substring(0, 8)}`
    : "";
  const suffix = compiler.getInfraSuffix(region);

  generateVmInfoOutputs(compiler, blocks, baseName, shortId, suffix);

  return blocks;
}
