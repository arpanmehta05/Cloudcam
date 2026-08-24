import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsEc2Compiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, suffix, deps, providerData } = args;
    const instanceCount = Number(config.count || 1);
    let subnetIdVal: string;
    if (instanceCount > 1) {
      const subnetA = resolveInterpolation(
        "aws_subnet",
        `${suffix}_public`,
        "id",
      );
      const subnetB = resolveInterpolation(
        "aws_subnet",
        `${suffix}_public_b`,
        "id",
      );
      subnetIdVal = `\${count.index % 2 == 0 ? ${subnetA.slice(2, -1)} : ${subnetB.slice(2, -1)}}`;
    } else {
      subnetIdVal = resolveInterpolation(
        "aws_subnet",
        `${suffix}_public`,
        "id",
      );
    }

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

    // EC2 to S3 connections
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

    // EC2 to ECR connections
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

    // EC2 to Security Group connections
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
    const ec2Deps = [
      `aws_subnet.${suffix}_public`,
      `aws_key_pair.${suffix}`,
      `aws_route_table_association.${suffix}_public`,
      ...deps,
    ];
    if (connectedSgNodes.length === 0) {
      ec2Deps.push(`aws_security_group.${suffix}`);
    }
    if (instanceCount > 1) {
      ec2Deps.push(`aws_subnet.${suffix}_public_b`);
      ec2Deps.push(`aws_route_table_association.${suffix}_public_b`);
    }
    for (const ecrNode of connectedEcrNodes) {
      const schema = ServiceSchemas["ecr"];
      const ecrConfig = schema
        ? schema.parse(ecrNode.config || {})
        : ecrNode.config || {};
      const ecrName = `sim_${ecrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      if (ecrConfig.repositoryMode !== "existing") {
        ec2Deps.push(`aws_ecr_repository.${ecrName}`);
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
            .getRunNameEx(`ec2-role-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`)
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
                `ec2-policy-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
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
              `ec2-profile-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`,
            )
            .substring(0, 64),
          role: resolveInterpolation("aws_iam_role", roleName, "name"),
        },
        "iam",
        true,
        [`aws_iam_role.${roleName}`],
      );
    }

    const ec2Params: any = {
      ...providerData,
      ami: compiler.resolveEc2Ami(r, config.ami, osType),
      instance_type: config.instanceType,
      key_name: resolveInterpolation("aws_key_pair", suffix, "key_name"),
      subnet_id: subnetIdVal,
      vpc_security_group_ids: (() => {
        const sgs: string[] = [];
        if (connectedSgNodes.length > 0) {
          for (const sgNode of connectedSgNodes) {
            const sgName = `sim_${sgNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
            sgs.push(resolveInterpolation("aws_security_group", sgName, "id"));
            ec2Deps.push(`aws_security_group.${sgName}`);
          }
        } else {
          sgs.push(resolveInterpolation("aws_security_group", suffix, "id"));
        }
        return sgs;
      })(),
      tags: {
        Name:
          instanceCount > 1
            ? `${config.instanceName}-\${count.index + 1}`
            : config.instanceName,
      },
    };

    if (instanceCount > 1) {
      ec2Params.count = instanceCount;
    }

    if (bootstrapScript) {
      ec2Params.user_data = bootstrapScript;
    }

    if (profileName) {
      ec2Params.iam_instance_profile = resolveInterpolation(
        "aws_iam_instance_profile",
        profileName,
        "name",
      );
      ec2Deps.push(`aws_iam_instance_profile.${profileName}`);
    }

    const ec2EcrDeps: string[] = [];
    for (const ecrNode of connectedEcrNodes) {
      const schema = ServiceSchemas["ecr"];
      const ecrConfig = schema
        ? schema.parse(ecrNode.config || {})
        : ecrNode.config || {};
      const ecrName = `sim_${ecrNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      if (ecrConfig.repositoryMode !== "existing") {
        ec2EcrDeps.push(`\${aws_ecr_repository.${ecrName}}`);
      }
    }
    if (ec2EcrDeps.length > 0) {
      ec2Params.depends_on = ec2EcrDeps;
    }

    compiler.addResource(
      "aws_instance",
      name,
      ec2Params,
      "ec2",
      false,
      ec2Deps,
    );
  }
}
