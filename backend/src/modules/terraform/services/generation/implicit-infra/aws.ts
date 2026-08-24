import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import type { TerraformCompiler } from "../compiler";
import { injectAwsNetwork } from "./aws-network";
import { injectAwsEksNetwork } from "./aws-eks-network";
import { injectAwsSecurity } from "./aws-security";

export function injectImplicitInfrastructureAws(
  compiler: TerraformCompiler,
  baseName: string,
  shortId: string
) {
  const ec2Regions = new Set<string>();
  const vpcRegions = new Set<string>();
  const lambdaRegions = new Set<string>();

  for (const node of compiler.req.nodes) {
    const schema = ServiceSchemas[node.serviceId];
    if (!schema) continue;
    const config = schema.parse(node.config);
    const r = (config.region as string) || compiler.req.region;

    if (node.serviceId === "ec2" || node.serviceId === "asg")
      ec2Regions.add(r);
    if (
      node.serviceId === "ec2" ||
      node.serviceId === "asg" ||
      node.serviceId === "rds" ||
      node.serviceId === "elb" ||
      node.serviceId === "aws_vpc" ||
      node.serviceId === "vpc" ||
      node.serviceId === "eks"
    )
      vpcRegions.add(r);
    if (node.serviceId === "lambda") lambdaRegions.add(r);
  }

  // Save the managed VPC regions state back to the compiler
  (compiler as any).managedVpcRegions = vpcRegions;

  // 1. Inject AWS Core Networking
  injectAwsNetwork(compiler, baseName, shortId, vpcRegions);

  // 2. Inject EKS-specific Private Routing and NAT Gateway
  injectAwsEksNetwork(compiler, baseName, shortId, vpcRegions);

  // 3. Inject AWS Key Pairs, Security Groups and IAM Role Policies
  injectAwsSecurity(compiler, baseName, shortId, ec2Regions, lambdaRegions, vpcRegions);
}
