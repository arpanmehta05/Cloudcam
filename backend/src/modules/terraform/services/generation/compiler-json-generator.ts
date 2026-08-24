import type { TerraformCompiler } from "./compiler";
import type { ResourceNode } from "./graph-resolver";

export function buildJson(
  compiler: TerraformCompiler,
  nodes: ResourceNode[]
): any {
  const res: any = {};
  for (const node of nodes) {
    if (!res[node.type]) res[node.type] = {};
    res[node.type][node.name] = node.data;
  }

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
  let providerConfig: any = {};

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
    providerConfig = {
      azurerm: { features: {}, resource_provider_registrations: "none" },
    };
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
    providerConfig = { google: { region: region } };
  } else {
    requiredProviders.aws = { source: "hashicorp/aws", version: "~> 6.44.0" };
    if (hasVm) {
      requiredProviders.tls = {
        source: "hashicorp/tls",
        version: "~> 4.0.0",
      };
    }
    providerConfig = { aws: { region: region } };
  }

  const hasK8s = compiler.resources.some((r) => r.type.startsWith("kubernetes_"));
  if (hasK8s) {
    const eksCluster = compiler.resources.find((r) => r.type === "aws_eks_cluster");
    if (eksCluster) {
      requiredProviders.kubernetes = {
        source: "hashicorp/kubernetes",
        version: "~> 2.35.0",
      };
      providerConfig.kubernetes = {
        host: `\${aws_eks_cluster.${eksCluster.name}.endpoint}`,
        cluster_ca_certificate: `\${base64decode(aws_eks_cluster.${eksCluster.name}.certificate_authority[0].data)}`,
        token: `\${data.aws_eks_cluster_auth.cluster_${eksCluster.name}.token}`,
      };
    }
  }

  return {
    terraform: { required_providers: requiredProviders },
    provider: providerConfig,
    data: (compiler as any).dataSources.reduce((acc: any, node: any) => {
      if (!acc[node.type]) acc[node.type] = {};
      acc[node.type][node.name] = node.data;
      return acc;
    }, {}),
    resource: res,
  };
}
