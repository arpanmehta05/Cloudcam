import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsSgCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, suffix, deps, providerData } = args;

    const rawRules = Array.isArray(config.rules) ? config.rules : [];
    const ingressRules: any[] = [];
    const egressRules: any[] = [];

    for (const rule of rawRules) {
      const formattedRule = {
        from_port: Number(rule.fromPort || 80),
        to_port: Number(rule.toPort || 80),
        protocol: rule.protocol || "tcp",
        cidr_blocks:
          typeof rule.cidrBlocks === "string"
            ? [rule.cidrBlocks]
            : Array.isArray(rule.cidrBlocks)
              ? rule.cidrBlocks
              : ["0.0.0.0/0"],
      };
      if (rule.type === "egress") {
        egressRules.push(formattedRule);
      } else {
        ingressRules.push(formattedRule);
      }
    }

    if (egressRules.length === 0) {
      egressRules.push({
        from_port: 0,
        to_port: 0,
        protocol: "-1",
        cidr_blocks: ["0.0.0.0/0"],
      });
    }

    compiler.addResource(
      "aws_security_group",
      name,
      {
        ...providerData,
        name: compiler.getRunNameEx(`sg-${config.name || name}`, config.region),
        description: config.description || "Managed security group",
        vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
        ingress: ingressRules,
        egress: egressRules,
        tags: {
          Name: compiler.getRunNameEx(
            `sg-${config.name || name}`,
            config.region,
          ),
        },
      },
      "sg",
      false,
      [`aws_vpc.${suffix}`, ...deps],
      ["ingress", "egress"],
    );
  }
}
