import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsEipCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, deps, providerData } = args;

    // 1. Generate Elastic IP
    compiler.addResource(
      "aws_eip",
      name,
      {
        ...providerData,
        domain: config.domain || "vpc",
      },
      "eip",
      false,
      deps,
    );

    // 2. Search connected EC2 instances for association
    const connectedEc2s =
      compiler.req.edges
        ?.filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => compiler.req.nodes.find((n) => n.id === id))
        .filter((n): n is TfNodeInput => !!n && n.serviceId === "ec2") ?? [];

    for (const ec2Node of connectedEc2s) {
      const ec2Name = `sim_${ec2Node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const assocName = `assoc_${name}_${ec2Name}`;

      compiler.addResource(
        "aws_eip_association",
        assocName,
        {
          ...providerData,
          instance_id: resolveInterpolation("aws_instance", ec2Name, "id"),
          allocation_id: resolveInterpolation("aws_eip", name, "id"),
        },
        "eip_association",
        true,
        [`aws_eip.${name}`, `aws_instance.${ec2Name}`],
      );
    }
  }
}
