import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsElbCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, suffix, deps, providerData } = args;
    // ALB requires at least 2 subnets
    const subnet1 = resolveInterpolation(
      "aws_subnet",
      `${suffix}_public`,
      "id",
    );
    const subnet2 = resolveInterpolation(
      "aws_subnet",
      `${suffix}_public_b`,
      "id",
    );

    const nodeSuffix = node.id.split("_").pop() || "";
    const lbNameConfig = config.lbName || "sim-elb";
    const formattedLbName = compiler.shortId
      ? `${lbNameConfig}-${nodeSuffix}${compiler.shortId}`
      : `${lbNameConfig}-${nodeSuffix}`;
    const cleanLbName = formattedLbName
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 32)
      .replace(/^-|-$/g, "");

    // Application Load Balancer
    compiler.addResource(
      "aws_lb",
      name,
      {
        ...providerData,
        name: cleanLbName,
        internal: false,
        load_balancer_type: "application",
        security_groups: [
          resolveInterpolation("aws_security_group", suffix, "id"),
        ],
        subnets: [subnet1, subnet2],
      },
      "elb",
      false,
      [
        `aws_security_group.${suffix}`,
        `aws_subnet.${suffix}_public`,
        `aws_subnet.${suffix}_public_b`,
      ],
    );

    // Check if an explicit target group node is connected to the load balancer
    const connectedTgNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "tg" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let targetGroupArn: string;
    let listenerDeps: string[];

    if (connectedTgNodes.length > 0) {
      const tgNode = connectedTgNodes[0];
      const tgName = `sim_${tgNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      targetGroupArn = resolveInterpolation(
        "aws_lb_target_group",
        tgName,
        "arn",
      );
      listenerDeps = [`aws_lb.${name}`, `aws_lb_target_group.${tgName}`];
    } else {
      // Fallback: Create implicit target group
      const tgName = name;
      compiler.addResource(
        "aws_lb_target_group",
        tgName,
        {
          ...providerData,
          name: `tg-${cleanLbName}`.substring(0, 32).replace(/-+$/, ""),
          port: config.port,
          protocol: config.protocol || "HTTP",
          vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
          health_check: {
            path: "/",
            port: "traffic-port",
          },
        },
        "target_group",
        true,
        [`aws_vpc.${suffix}`],
        ["health_check"],
      );
      targetGroupArn = resolveInterpolation(
        "aws_lb_target_group",
        tgName,
        "arn",
      );
      listenerDeps = [`aws_lb.${name}`, `aws_lb_target_group.${tgName}`];

      // Target Group Attachments for each connected EC2 instance (implicit fallback)
      const connectedEc2s = compiler.req.edges
        .filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => compiler.req.nodes.find((n) => n.id === id))
        .filter((n): n is TfNodeInput => !!n && n.serviceId === "ec2");

      for (const ec2Node of connectedEc2s) {
        const ec2Name = `sim_${ec2Node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        const ec2Count = Number(ec2Node.config?.count || 1);
        const githubConfig = compiler.resolveGithubDependency(ec2Node.id);
        const dockerHubConfig = compiler.resolveDockerHubDependency(ec2Node.id);
        const ecrConfig = compiler.resolveEcrDependency(ec2Node.id);
        const appConfig = dockerHubConfig || githubConfig || ecrConfig;
        const targetPort = appConfig
          ? Number(
              appConfig.appPort || (dockerHubConfig || ecrConfig ? 8080 : 80),
            )
          : Number(ec2Node.config?.appPort || 80);

        if (ec2Count > 1) {
          compiler.addResource(
            "aws_lb_target_group_attachment",
            `attach_${name}_${ec2Name}`,
            {
              ...providerData,
              count: ec2Count,
              target_group_arn: targetGroupArn,
              target_id: `\${aws_instance.${ec2Name}[count.index].id}`,
              port: targetPort,
            },
            "attachment",
            true,
            [`aws_lb_target_group.${tgName}`, `aws_instance.${ec2Name}`],
          );
        } else {
          compiler.addResource(
            "aws_lb_target_group_attachment",
            `attach_${name}_${ec2Name}`,
            {
              ...providerData,
              target_group_arn: targetGroupArn,
              target_id: resolveInterpolation("aws_instance", ec2Name, "id"),
              port: targetPort,
            },
            "attachment",
            true,
            [`aws_lb_target_group.${tgName}`, `aws_instance.${ec2Name}`],
          );
        }
      }
    }

    // Listener
    compiler.addResource(
      "aws_lb_listener",
      name,
      {
        ...providerData,
        load_balancer_arn: resolveInterpolation("aws_lb", name, "arn"),
        port: config.port,
        protocol: config.protocol || "HTTP",
        default_action: [
          {
            type: "forward",
            target_group_arn: targetGroupArn,
          },
        ],
      },
      "listener",
      true,
      listenerDeps,
      ["default_action"],
    );
  }
}
