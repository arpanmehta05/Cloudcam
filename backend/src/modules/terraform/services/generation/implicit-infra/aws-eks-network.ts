import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import { resolveInterpolation } from "../graph-resolver";
import type { TerraformCompiler } from "../compiler";

export function injectAwsEksNetwork(
  compiler: TerraformCompiler,
  baseName: string,
  shortId: string,
  vpcRegions: Set<string>
) {
  for (const r of vpcRegions) {
    const suffix = compiler.getInfraSuffix(r);

    const hasEksInRegion = compiler.req.nodes.some(
      (n) =>
        n.serviceId === "eks" &&
        ((n.config?.region as string) || compiler.req.region) === r
    );

    if (hasEksInRegion) {
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

      const subnetACidr = explicitVpcConfig?.subnetCidrBlock || "10.0.1.0/24";

      let privateACidr = "10.0.11.0/24";
      let privateBCidr = "10.0.12.0/24";
      const parts = subnetACidr.split(".");
      if (parts.length === 4) {
        const thirdOctet = parseInt(parts[2], 10);
        if (!isNaN(thirdOctet)) {
          parts[2] = String(thirdOctet + 10);
          privateACidr = parts.join(".");
          parts[2] = String(thirdOctet + 11);
          privateBCidr = parts.join(".");
        }
      }

      // 1. Create Private Subnet A
      compiler.addResource(
        "aws_subnet",
        `${suffix}_private`,
        {
          ...compiler.getProviderData(r),
          vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
          cidr_block: privateACidr,
          map_public_ip_on_launch: false,
          availability_zone: `${r}a`,
          tags: {
            Name: compiler.getRunName(baseName, shortId, "private-subnet", r),
          },
        },
        "subnet",
        true,
        [`aws_vpc.${suffix}`]
      );

      // 2. Create Private Subnet B
      compiler.addResource(
        "aws_subnet",
        `${suffix}_private_b`,
        {
          ...compiler.getProviderData(r),
          vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
          cidr_block: privateBCidr,
          map_public_ip_on_launch: false,
          availability_zone: `${r}b`,
          tags: {
            Name: compiler.getRunName(baseName, shortId, "private-subnet-b", r),
          },
        },
        "subnet",
        true,
        [`aws_vpc.${suffix}`]
      );

      // 3. Create Elastic IP for NAT Gateway
      compiler.addResource(
        "aws_eip",
        `nat_${suffix}`,
        {
          ...compiler.getProviderData(r),
          domain: "vpc",
          tags: {
            Name: compiler.getRunName(baseName, shortId, "nat-eip", r),
          },
        },
        "eip",
        true
      );

      // 4. Create NAT Gateway in Public Subnet A
      compiler.addResource(
        "aws_nat_gateway",
        suffix,
        {
          ...compiler.getProviderData(r),
          allocation_id: resolveInterpolation(
            "aws_eip",
            `nat_${suffix}`,
            "id"
          ),
          subnet_id: resolveInterpolation(
            "aws_subnet",
            `${suffix}_public`,
            "id"
          ),
          tags: {
            Name: compiler.getRunName(baseName, shortId, "nat-gw", r),
          },
        },
        "nat_gateway",
        true,
        [`aws_eip.nat_${suffix}`, `aws_subnet.${suffix}_public`]
      );

      // 5. Create Private Route Table
      compiler.addResource(
        "aws_route_table",
        `${suffix}_private`,
        {
          ...compiler.getProviderData(r),
          vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
          route: [
            {
              cidr_block: "0.0.0.0/0",
              nat_gateway_id: resolveInterpolation(
                "aws_nat_gateway",
                suffix,
                "id"
              ),
            },
          ],
          tags: {
            Name: compiler.getRunName(baseName, shortId, "private-rt", r),
          },
        },
        "route_table",
        true,
        [`aws_vpc.${suffix}`, `aws_nat_gateway.${suffix}`]
      );

      // 6. Associate Private Subnet A with Private Route Table
      compiler.addResource(
        "aws_route_table_association",
        `${suffix}_private`,
        {
          ...compiler.getProviderData(r),
          subnet_id: resolveInterpolation(
            "aws_subnet",
            `${suffix}_private`,
            "id"
          ),
          route_table_id: resolveInterpolation(
            "aws_route_table",
            `${suffix}_private`,
            "id"
          ),
        },
        "route_table_association",
        true,
        [
          `aws_subnet.${suffix}_private`,
          `aws_route_table.${suffix}_private`,
        ]
      );

      // 7. Associate Private Subnet B with Private Route Table
      compiler.addResource(
        "aws_route_table_association",
        `${suffix}_private_b`,
        {
          ...compiler.getProviderData(r),
          subnet_id: resolveInterpolation(
            "aws_subnet",
            `${suffix}_private_b`,
            "id"
          ),
          route_table_id: resolveInterpolation(
            "aws_route_table",
            `${suffix}_private`,
            "id"
          ),
        },
        "route_table_association",
        true,
        [
          `aws_subnet.${suffix}_private_b`,
          `aws_route_table.${suffix}_private`,
        ]
      );
    }
  }
}
