import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsAsgCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps, providerData } = args;
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

    const dbEnvVars = compiler.resolveDatabaseDependencies(node.id);
    const githubConfig = compiler.resolveGithubDependency(node.id);
    const dockerHubConfig = compiler.resolveDockerHubDependency(node.id);
    const ecrConfig = compiler.resolveEcrDependency(node.id);
    const mergedConfig = {
      ...config,
      ...(githubConfig || {}),
      ...(dockerHubConfig || {}),
      ...(ecrConfig || {}),
    };
    const ec2User = config.adminUsername || "ec2-user";
    let osType: "al2023" | "ubuntu" | "debian" = "al2023";
    if (ec2User === "ubuntu") {
      osType = "ubuntu";
    } else if (ec2User === "debian" || ec2User === "admin") {
      osType = "debian";
    }
    const bootstrapScript = compiler.generateBootstrapScript(
      mergedConfig,
      dbEnvVars,
      osType,
    );

    // ASG to S3 connections
    const connectedS3Nodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "s3" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    // ASG to ECR connections
    const connectedEcrNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "ecr" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    // ASG to Security Group connections
    const connectedSgNodes = compiler.req.nodes.filter(
      (n) =>
        n.serviceId === "sg" &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === node.id && e.target === n.id) ||
            (e.source === n.id && e.target === node.id),
        ) ??
          false),
    );

    let profileName: string | undefined;
    const templateDeps = [
      `aws_subnet.${suffix}_public`,
      `aws_subnet.${suffix}_public_b`,
      `aws_key_pair.${suffix}`,
      ...deps,
    ];
    if (connectedSgNodes.length === 0) {
      templateDeps.push(`aws_security_group.${suffix}`);
    }
    for (const ecrNode of connectedEcrNodes) {
      const schema = ServiceSchemas["ecr"];
      const ecrConfig = schema
        ? schema.parse(ecrNode.config || {})
        : ecrNode.config || {};
      const ecrName = `sim_${ecrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      if (ecrConfig.repositoryMode !== "existing") {
        templateDeps.push(`aws_ecr_repository.${ecrName}`);
      }
    }

    const hasS3 = connectedS3Nodes.length > 0;
    const hasEcr = connectedEcrNodes.length > 0;

    if (hasS3 || hasEcr) {
      const roleName = `role_${name}`;
      compiler.addResource(
        "aws_iam_role",
        roleName,
        {
          ...providerData,
          name: compiler
            .getRunNameEx(`asg-role-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`)
            .substring(0, 64),
          assume_role_policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Action: "sts:AssumeRole",
                Effect: "Allow",
                Principal: { Service: "ec2.amazonaws.com" },
              },
            ],
          }),
        },
        "iam",
        true,
      );

      if (hasS3) {
        const policyStatements = connectedS3Nodes
          .map((s3Node) => {
            const s3Name = `sim_${s3Node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
            const bucketArn = resolveInterpolation(
              "aws_s3_bucket",
              s3Name,
              "arn",
            );
            return [
              {
                Effect: "Allow",
                Action: ["s3:ListBucket", "s3:GetBucketLocation"],
                Resource: [bucketArn],
              },
              {
                Effect: "Allow",
                Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
                Resource: [`${bucketArn}/*`],
              },
            ];
          })
          .flat();

        const policyName = `policy_${name}`;
        compiler.addResource(
          "aws_iam_policy",
          policyName,
          {
            ...providerData,
            name: compiler
              .getRunNameEx(
                `asg-policy-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
              )
              .substring(0, 64),
            policy: JSON.stringify({
              Version: "2012-10-17",
              Statement: policyStatements,
            }),
          },
          "iam",
          true,
        );

        compiler.addResource(
          "aws_iam_role_policy_attachment",
          `attach_${name}`,
          {
            ...providerData,
            role: resolveInterpolation("aws_iam_role", roleName, "name"),
            policy_arn: resolveInterpolation(
              "aws_iam_policy",
              policyName,
              "arn",
            ),
          },
          "iam",
          true,
          [`aws_iam_role.${roleName}`, `aws_iam_policy.${policyName}`],
        );
      }

      if (hasEcr) {
        compiler.addResource(
          "aws_iam_role_policy_attachment",
          `attach_ecr_${name}`,
          {
            ...providerData,
            role: resolveInterpolation("aws_iam_role", roleName, "name"),
            policy_arn:
              "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
          },
          "iam",
          true,
          [`aws_iam_role.${roleName}`],
        );
      }

      profileName = `profile_${name}`;
      compiler.addResource(
        "aws_iam_instance_profile",
        profileName,
        {
          ...providerData,
          name: compiler
            .getRunNameEx(
              `asg-profile-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
            )
            .substring(0, 64),
          role: resolveInterpolation("aws_iam_role", roleName, "name"),
        },
        "iam",
        true,
        [`aws_iam_role.${roleName}`],
      );
    }

    const templateParams: any = {
      ...providerData,
      name_prefix: `${config.instanceName}-template-`,
      image_id: compiler.resolveEc2Ami(r, config.ami, osType),
      instance_type: config.instanceType,
      key_name: resolveInterpolation("aws_key_pair", suffix, "key_name"),
      vpc_security_group_ids: (() => {
        const sgs: string[] = [];
        if (connectedSgNodes.length > 0) {
          for (const sgNode of connectedSgNodes) {
            const sgName = `sim_${sgNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
            sgs.push(resolveInterpolation("aws_security_group", sgName, "id"));
            templateDeps.push(`aws_security_group.${sgName}`);
          }
        } else {
          sgs.push(resolveInterpolation("aws_security_group", suffix, "id"));
        }
        return sgs;
      })(),
      tag_specifications: [
        {
          resource_type: "instance",
          tags: {
            Name: `${config.instanceName}-instance`,
          },
        },
      ],
    };

    if (bootstrapScript) {
      const localKey = `asg_user_data_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      compiler.addLocal(localKey, bootstrapScript);
      templateParams.user_data = `\${base64encode(local.${localKey})}`;
    }

    if (profileName) {
      templateParams.iam_instance_profile = [
        {
          name: resolveInterpolation(
            "aws_iam_instance_profile",
            profileName,
            "name",
          ),
        },
      ];
      templateDeps.push(`aws_iam_instance_profile.${profileName}`);
    }

    const templateEcrDeps: string[] = [];
    for (const ecrNode of connectedEcrNodes) {
      const schema = ServiceSchemas["ecr"];
      const ecrConfig = schema
        ? schema.parse(ecrNode.config || {})
        : ecrNode.config || {};
      const ecrName = `sim_${ecrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      if (ecrConfig.repositoryMode !== "existing") {
        templateEcrDeps.push(`\${aws_ecr_repository.${ecrName}}`);
      }
    }
    if (templateEcrDeps.length > 0) {
      templateParams.depends_on = templateEcrDeps;
    }

    // Create Launch Template
    compiler.addResource(
      "aws_launch_template",
      `template_${name}`,
      templateParams,
      "instance_template",
      true,
      templateDeps,
      ["iam_instance_profile", "tag_specifications"],
    );

    // Find connected ALBs
    const connectedElbs = compiler.req.edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "elb");

    const targetGroupArns = connectedElbs.map((elb) => {
      const elbName = `sim_${elb.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      return resolveInterpolation("aws_lb_target_group", elbName, "arn");
    });

    const elbDeps = connectedElbs.map((elb) => {
      const elbName = `sim_${elb.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      return `aws_lb_target_group.${elbName}`;
    });

    const asgParams: any = {
      ...providerData,
      name: compiler.shortId
        ? `${config.instanceName}${compiler.shortId}`
            .substring(0, 32)
            .replace(/-+$/, "")
        : config.instanceName,
      vpc_zone_identifier: [subnet1, subnet2],
      min_size: Number(config.minSize || 1),
      max_size: Number(config.maxSize || 3),
      desired_capacity: Number(config.desiredCapacity || 1),
      launch_template: [
        {
          id: resolveInterpolation(
            "aws_launch_template",
            `template_${name}`,
            "id",
          ),
          version: "$Latest",
        },
      ],
    };

    if (targetGroupArns.length > 0) {
      asgParams.target_group_arns = targetGroupArns;
    }

    const asgDeps = [
      `aws_launch_template.template_${name}`,
      `aws_subnet.${suffix}_public`,
      `aws_subnet.${suffix}_public_b`,
      ...elbDeps,
    ];

    compiler.addResource(
      "aws_autoscaling_group",
      name,
      asgParams,
      "asg",
      false,
      asgDeps,
      ["launch_template"],
    );

    // Auto Scaling Policy (Target Tracking scaling based on CPU)
    const cpuTargetVal = Number(config.cpuTarget || 50);
    const policyParams: any = {
      ...providerData,
      name: `cpu-scaling-policy-${name}`,
      policy_type: "TargetTrackingScaling",
      autoscaling_group_name: resolveInterpolation(
        "aws_autoscaling_group",
        name,
        "name",
      ),
      target_tracking_configuration: {
        predefined_metric_specification: {
          predefined_metric_type: "ASGAverageCPUUtilization",
        },
        target_value: cpuTargetVal,
      },
    };

    compiler.addResource(
      "aws_autoscaling_policy",
      `policy_${name}_cpu`,
      policyParams,
      "asg",
      false,
      [`aws_autoscaling_group.${name}`],
      ["target_tracking_configuration", "predefined_metric_specification"],
    );
  }
}
