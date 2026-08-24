import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import { resolveInterpolation } from "../graph-resolver";
import type { TerraformCompiler } from "../compiler";

export function injectAwsNetwork(
  compiler: TerraformCompiler,
  baseName: string,
  shortId: string,
  vpcRegions: Set<string>
) {
  for (const r of vpcRegions) {
    const suffix = compiler.getInfraSuffix(r);

    const explicitVpcNode = compiler.req.nodes.find(
      (n) =>
        (n.serviceId === "aws_vpc" || n.serviceId === "vpc") &&
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

    const isPrivateVal =
      explicitVpcConfig?.isPrivate === true ||
      explicitVpcConfig?.isPrivate === "true";
    const vpcNameVal = explicitVpcConfig?.vpcName || "sim-vpc";
    const vpcCidrVal = explicitVpcConfig?.cidrBlock || "10.0.0.0/16";
    const subnetACidr = explicitVpcConfig?.subnetCidrBlock || "10.0.1.0/24";

    // Calculate subnet B CIDR (e.g. increment the third octet)
    let subnetBCidr = "10.0.2.0/24";
    const parts = subnetACidr.split(".");
    if (parts.length === 4) {
      const thirdOctet = parseInt(parts[2], 10);
      if (!isNaN(thirdOctet)) {
        parts[2] = String(thirdOctet + 1);
        subnetBCidr = parts.join(".");
      }
    }

    compiler.addResource(
      "aws_vpc",
      suffix,
      {
        ...compiler.getProviderData(r),
        cidr_block: vpcCidrVal,
        enable_dns_support: true,
        enable_dns_hostnames: true,
        tags: {
          Name: compiler.shortId ? `${vpcNameVal}${compiler.shortId}` : vpcNameVal,
        },
      },
      "vpc",
      true
    );

    compiler.addResource(
      "aws_subnet",
      `${suffix}_public`,
      {
        ...compiler.getProviderData(r),
        vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
        cidr_block: subnetACidr,
        map_public_ip_on_launch: !isPrivateVal,
        availability_zone: `${r}a`,
        tags: {
          Name: compiler.getRunName(baseName, shortId, "public-subnet", r),
        },
      },
      "subnet",
      true,
      [`aws_vpc.${suffix}`]
    );

    const hasRdsInRegion = compiler.req.nodes.some(
      (n) =>
        n.serviceId === "rds" &&
        ((n.config?.region as string) || compiler.req.region) === r
    );
    const hasElbInRegion = compiler.req.nodes.some(
      (n) =>
        n.serviceId === "elb" &&
        ((n.config?.region as string) || compiler.req.region) === r
    );
    const hasAsgInRegion = compiler.req.nodes.some(
      (n) =>
        n.serviceId === "asg" &&
        ((n.config?.region as string) || compiler.req.region) === r
    );
    const hasEksInRegion = compiler.req.nodes.some(
      (n) =>
        n.serviceId === "eks" &&
        ((n.config?.region as string) || compiler.req.region) === r
    );

    if (
      hasRdsInRegion ||
      hasElbInRegion ||
      hasAsgInRegion ||
      hasEksInRegion
    ) {
      compiler.addResource(
        "aws_subnet",
        `${suffix}_public_b`,
        {
          ...compiler.getProviderData(r),
          vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
          cidr_block: subnetBCidr,
          map_public_ip_on_launch: !isPrivateVal,
          availability_zone: `${r}b`,
          tags: {
            Name: compiler.getRunName(baseName, shortId, "public-subnet-b", r),
          },
        },
        "subnet",
        true,
        [`aws_vpc.${suffix}`]
      );

      compiler.addResource(
        "aws_route_table_association",
        `${suffix}_public_b`,
        {
          ...compiler.getProviderData(r),
          subnet_id: resolveInterpolation(
            "aws_subnet",
            `${suffix}_public_b`,
            "id"
          ),
          route_table_id: resolveInterpolation(
            "aws_route_table",
            `${suffix}_public`,
            "id"
          ),
        },
        "route_table_association",
        true,
        [
          `aws_subnet.${suffix}_public_b`,
          `aws_route_table.${suffix}_public`,
        ]
      );
    }

    if (hasRdsInRegion) {
      compiler.addResource(
        "aws_db_subnet_group",
        `dsg_${suffix}`,
        {
          ...compiler.getProviderData(r),
          name: `${baseName}${shortId}-dsg-${r}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .substring(0, 60),
          subnet_ids: [
            resolveInterpolation("aws_subnet", `${suffix}_public`, "id"),
            resolveInterpolation("aws_subnet", `${suffix}_public_b`, "id"),
          ],
          tags: { Name: compiler.getRunName(baseName, shortId, "dsg", r) },
        },
        "db_subnet_group",
        true,
        [`aws_subnet.${suffix}_public`, `aws_subnet.${suffix}_public_b`]
      );
    }

    if (!isPrivateVal) {
      compiler.addResource(
        "aws_internet_gateway",
        suffix,
        {
          ...compiler.getProviderData(r),
          vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
          tags: { Name: compiler.getRunName(baseName, shortId, "igw", r) },
        },
        "igw",
        true,
        [`aws_vpc.${suffix}`]
      );
    }

    const rtRoutes = isPrivateVal
      ? []
      : [
          {
            cidr_block: "0.0.0.0/0",
            gateway_id: resolveInterpolation(
              "aws_internet_gateway",
              suffix,
              "id"
            ),
          },
        ];

    const rtDeps = [`aws_vpc.${suffix}`];
    if (!isPrivateVal) {
      rtDeps.push(`aws_internet_gateway.${suffix}`);
    }

    compiler.addResource(
      "aws_route_table",
      `${suffix}_public`,
      {
        ...compiler.getProviderData(r),
        vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
        route: rtRoutes,
        tags: { Name: compiler.getRunName(baseName, shortId, "rt", r) },
      },
      "route_table",
      true,
      rtDeps
    );

    compiler.addResource(
      "aws_route_table_association",
      `${suffix}_public`,
      {
        ...compiler.getProviderData(r),
        subnet_id: resolveInterpolation(
          "aws_subnet",
          `${suffix}_public`,
          "id"
        ),
        route_table_id: resolveInterpolation(
          "aws_route_table",
          `${suffix}_public`,
          "id"
        ),
      },
      "route_table_association",
      true,
      [`aws_subnet.${suffix}_public`, `aws_route_table.${suffix}_public`]
    );
  }
}
