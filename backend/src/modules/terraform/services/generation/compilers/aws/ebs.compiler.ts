import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsEbsCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps, providerData } = args;

    // 1. Create EBS Volume
    compiler.addResource(
      "aws_ebs_volume",
      name,
      {
        ...providerData,
        availability_zone: config.availabilityZone || `${r}a`,
        size: Number(config.sizeGb || 20),
        type: config.volumeType || "gp3",
        tags: {
          Name: config.volumeName || name,
        },
      },
      "ebs",
      false,
      deps,
    );

    // 2. Attach connected EC2 instances
    const connectedEc2s = compiler.req.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "ec2");

    for (const ec2 of connectedEc2s) {
      const ec2Name = `sim_${ec2.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const isMultiCount = ec2.config.count && Number(ec2.config.count) > 1;
      const ec2Id = isMultiCount
        ? `\${aws_instance.${ec2Name}[0].id}`
        : resolveInterpolation("aws_instance", ec2Name, "id");

      compiler.addResource(
        "aws_volume_attachment",
        `attach_${name}_${ec2Name}`,
        {
          ...providerData,
          device_name: "/dev/sdh",
          volume_id: resolveInterpolation("aws_ebs_volume", name, "id"),
          instance_id: ec2Id,
        },
        "volume_attachment",
        true,
        [`aws_ebs_volume.${name}`, `aws_instance.${ec2Name}`],
      );
    }
  }
}
