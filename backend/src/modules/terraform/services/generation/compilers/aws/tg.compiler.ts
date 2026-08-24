import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsTgCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, suffix, deps, providerData } = args;

    let targetType = config.targetType || "instance";

    // Auto-coerce targetType to "ip" if connected to a FARGATE ECS service
    const connectedEcs = compiler.req.edges
      ?.filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .find((n): n is TfNodeInput => !!n && (n.serviceId as string) === "ecs");

    if (connectedEcs) {
      const ecsLaunchType = connectedEcs.config?.launchType || "FARGATE";
      if (ecsLaunchType === "FARGATE") {
        targetType = "ip";
      }
    }

    // 1. Create Target Group
    const nodeSuffix = node.id.split("_").pop() || "";
    const tgNameConfig = config.name || "sim-tg";
    const rawTgName = `${tgNameConfig}-${nodeSuffix}${compiler.shortId}`;
    const cleanTgName = rawTgName
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .substring(0, 32)
      .replace(/^-|-$/g, "");

    compiler.addResource(
      "aws_lb_target_group",
      name,
      {
        ...providerData,
        name: cleanTgName,
        port: Number(config.port || 80),
        protocol: config.protocol || "HTTP",
        vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
        target_type: targetType,
        health_check: {
          path: "/",
          port: "traffic-port",
        },
      },
      "target_group",
      false,
      [`aws_vpc.${suffix}`, ...deps],
      ["health_check"],
    );

    // 2. Attach connected targets (EC2 / ASG)
    const connectedTargets = compiler.req.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n);

    for (const targetNode of connectedTargets) {
      const targetName = `sim_${targetNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      if (targetNode.serviceId === "ec2") {
        const ec2Count = Number(targetNode.config?.count || 1);
        const githubConfig = compiler.resolveGithubDependency(targetNode.id);
        const dockerHubConfig = compiler.resolveDockerHubDependency(
          targetNode.id,
        );
        const ecrConfig = compiler.resolveEcrDependency(targetNode.id);
        const appConfig = dockerHubConfig || githubConfig || ecrConfig;
        const targetPort = appConfig
          ? Number(
              appConfig.appPort || (dockerHubConfig || ecrConfig ? 8080 : 80),
            )
          : Number(targetNode.config?.appPort || 80);

        if (ec2Count > 1) {
          compiler.addResource(
            "aws_lb_target_group_attachment",
            `attach_${name}_${targetName}`,
            {
              ...providerData,
              count: ec2Count,
              target_group_arn: resolveInterpolation(
                "aws_lb_target_group",
                name,
                "arn",
              ),
              target_id: `\${aws_instance.${targetName}[count.index].id}`,
              port: targetPort,
            },
            "attachment",
            true,
            [`aws_lb_target_group.${name}`, `aws_instance.${targetName}`],
          );
        } else {
          compiler.addResource(
            "aws_lb_target_group_attachment",
            `attach_${name}_${targetName}`,
            {
              ...providerData,
              target_group_arn: resolveInterpolation(
                "aws_lb_target_group",
                name,
                "arn",
              ),
              target_id: resolveInterpolation("aws_instance", targetName, "id"),
              port: targetPort,
            },
            "attachment",
            true,
            [`aws_lb_target_group.${name}`, `aws_instance.${targetName}`],
          );
        }
      } else if (targetNode.serviceId === "asg") {
        compiler.addResource(
          "aws_autoscaling_attachment",
          `attach_${name}_${targetName}`,
          {
            ...providerData,
            autoscaling_group_name: resolveInterpolation(
              "aws_autoscaling_group",
              targetName,
              "id",
            ),
            lb_target_group_arn: resolveInterpolation(
              "aws_lb_target_group",
              name,
              "arn",
            ),
          },
          "autoscaling_attachment",
          true,
          [
            `aws_lb_target_group.${name}`,
            `aws_autoscaling_group.${targetName}`,
          ],
        );
      }
    }
  }
}
