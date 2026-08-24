import { ServiceSchemas } from "../../../../../config/terraform-schemas";
import { resolveInterpolation } from "../graph-resolver";
import type { TerraformCompiler } from "../compiler";

export function injectAwsSecurity(
  compiler: TerraformCompiler,
  baseName: string,
  shortId: string,
  ec2Regions: Set<string>,
  lambdaRegions: Set<string>,
  vpcRegions: Set<string>
) {
  // Key Pairs
  let tlsCreated = false;
  for (const r of ec2Regions) {
    if (!tlsCreated) {
      compiler.addResource(
        "tls_private_key",
        "simulation",
        {
          algorithm: "RSA",
          rsa_bits: 4096,
        },
        "tls",
        true
      );
      tlsCreated = true;
    }

    const suffix = compiler.getInfraSuffix(r);

    // Find if any EC2 or ASG node in this region has a user-configured keyName
    let customKeyName: string | undefined;
    for (const n of compiler.req.nodes) {
      if (n.serviceId === "ec2" || n.serviceId === "asg") {
        const schema = ServiceSchemas[n.serviceId];
        const nConfig = schema ? schema.parse(n.config) : n.config;
        const nodeRegion = nConfig.region || compiler.req.region;
        if (nodeRegion === r && nConfig.keyName) {
          customKeyName = nConfig.keyName;
          break;
        }
      }
    }

    const keyPairParams: any = {
      ...compiler.getProviderData(r),
      public_key: resolveInterpolation(
        "tls_private_key",
        "simulation",
        "public_key_openssh"
      ),
    };

    if (customKeyName) {
      keyPairParams.key_name = customKeyName;
    } else {
      keyPairParams.key_name_prefix =
        compiler.getRunName(baseName, shortId, "key", r).substring(0, 240) +
        "-";
    }

    compiler.addResource(
      "aws_key_pair",
      suffix,
      keyPairParams,
      "keypair",
      true,
      ["tls_private_key.simulation"]
    );
  }

  // Security Groups
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

    const hasCustomSg = compiler.req.nodes.some(
      (n) =>
        n.serviceId === "sg" &&
        (n.config.region || compiler.req.region) === r &&
        (compiler.req.edges?.some(
          (e) =>
            (e.source === n.id || e.target === n.id) &&
            compiler.req.nodes.some(
              (targetNode) =>
                (targetNode.id === e.source ||
                  targetNode.id === e.target) &&
                (targetNode.serviceId === "ec2" ||
                  targetNode.serviceId === "asg")
            )
        ) ??
          false)
    );
    const hasRdsOrElb = compiler.req.nodes.some(
      (n) =>
        (n.serviceId === "rds" || n.serviceId === "elb") &&
        (n.config.region || compiler.req.region) === r
    );

    if (!hasCustomSg || hasRdsOrElb) {
      const sshPortVal =
        explicitVpcConfig && explicitVpcConfig.sshPort !== undefined
          ? Number(explicitVpcConfig.sshPort)
          : 22;
      const httpPortVal =
        explicitVpcConfig && explicitVpcConfig.httpPort !== undefined
          ? Number(explicitVpcConfig.httpPort)
          : 80;
      const httpsPortVal =
        explicitVpcConfig && explicitVpcConfig.httpsPort !== undefined
          ? Number(explicitVpcConfig.httpsPort)
          : 443;

      const ingressRules = [
        {
          from_port: sshPortVal,
          to_port: sshPortVal,
          protocol: "tcp",
          cidr_blocks: ["0.0.0.0/0"],
        },
        {
          from_port: httpPortVal,
          to_port: httpPortVal,
          protocol: "tcp",
          cidr_blocks: ["0.0.0.0/0"],
        },
        {
          from_port: httpsPortVal,
          to_port: httpsPortVal,
          protocol: "tcp",
          cidr_blocks: ["0.0.0.0/0"],
        },
      ];

      for (const n of compiler.req.nodes) {
        if (n.serviceId === "ec2") {
          const schema = ServiceSchemas["ec2"];
          const nConfig = schema ? schema.parse(n.config) : n.config;
          const nodeRegion = nConfig.region || compiler.req.region;
          if (nodeRegion === r) {
            const githubConfig = compiler.resolveGithubDependency(n.id);
            const appPort =
              nConfig.appPort || (githubConfig && githubConfig.appPort);
            if (
              appPort &&
              Number(appPort) !== httpPortVal &&
              Number(appPort) !== httpsPortVal &&
              Number(appPort) !== sshPortVal
            ) {
              ingressRules.push({
                from_port: Number(appPort),
                to_port: Number(appPort),
                protocol: "tcp",
                cidr_blocks: ["0.0.0.0/0"],
              });
            }
          }
        }
        if (n.serviceId === "rds") {
          const schema = ServiceSchemas["rds"];
          const nConfig = schema ? schema.parse(n.config) : n.config;
          const nodeRegion = nConfig.region || compiler.req.region;
          if (nodeRegion === r) {
            ingressRules.push({
              from_port: Number(nConfig.port || 5432),
              to_port: Number(nConfig.port || 5432),
              protocol: "tcp",
              self: true,
            } as any);
          }
        }
      }

      compiler.addResource(
        "aws_security_group",
        suffix,
        {
          ...compiler.getProviderData(r),
          name: compiler.getRunName(baseName, shortId, "sg", r),
          vpc_id: resolveInterpolation("aws_vpc", suffix, "id"),
          ingress: ingressRules,
          egress: [
            {
              from_port: 0,
              to_port: 0,
              protocol: "-1",
              cidr_blocks: ["0.0.0.0/0"],
            },
          ],
          tags: { Name: compiler.getRunName(baseName, shortId, "sg", r) },
        },
        "sg",
        true,
        [`aws_vpc.${suffix}`]
      );
    }
  }

  // IAM Role
  if (lambdaRegions.size > 0) {
    compiler.addResource(
      "aws_iam_role",
      "lambda_exec",
      {
        name: compiler.getRunName(baseName, shortId, "lambda-role"),
        assume_role_policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: { Service: "lambda.amazonaws.com" },
            },
          ],
        }),
      },
      "iam",
      true
    );

    compiler.addResource(
      "aws_iam_role_policy_attachment",
      "lambda_logs",
      {
        role: resolveInterpolation("aws_iam_role", "lambda_exec", "name"),
        policy_arn:
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
      },
      "iam",
      true,
      ["aws_iam_role.lambda_exec"]
    );

    // Inline policy for Lambda storage integrations
    const lambdaPolicyStatements: any[] = [];

    // Check S3 connections
    const lambdaS3Edges =
      compiler.req.edges?.filter((e) => {
        const src = compiler.req.nodes.find((n) => n.id === e.source);
        const tgt = compiler.req.nodes.find((n) => n.id === e.target);
        return (
          (src?.serviceId === "lambda" && tgt?.serviceId === "s3") ||
          (src?.serviceId === "s3" && tgt?.serviceId === "lambda")
        );
      }) || [];

    if (lambdaS3Edges.length > 0) {
      const s3Resources: string[] = [];
      for (const edge of lambdaS3Edges) {
        const s3Node = compiler.req.nodes.find(
          (n) =>
            (n.id === edge.source || n.id === edge.target) &&
            n.serviceId === "s3"
        );
        if (s3Node) {
          const s3Name = `sim_${s3Node.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
          const bucketArn = resolveInterpolation(
            "aws_s3_bucket",
            s3Name,
            "arn"
          );
          s3Resources.push(bucketArn, `${bucketArn}/*`);
        }
      }
      if (s3Resources.length > 0) {
        lambdaPolicyStatements.push({
          Effect: "Allow",
          Action: [
            "s3:ListBucket",
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
          ],
          Resource: s3Resources,
        });
      }
    }

    // Check DynamoDB connections
    const lambdaDynamoEdges =
      compiler.req.edges?.filter((e) => {
        const src = compiler.req.nodes.find((n) => n.id === e.source);
        const tgt = compiler.req.nodes.find((n) => n.id === e.target);
        return (
          (src?.serviceId === "lambda" && tgt?.serviceId === "dynamodb") ||
          (src?.serviceId === "dynamodb" && tgt?.serviceId === "lambda")
        );
      }) || [];

    if (lambdaDynamoEdges.length > 0) {
      const dynamoResources: string[] = [];
      for (const edge of lambdaDynamoEdges) {
        const ddbNode = compiler.req.nodes.find(
          (n) =>
            (n.id === edge.source || n.id === edge.target) &&
            n.serviceId === "dynamodb"
        );
        if (ddbNode) {
          const ddbName = `sim_${ddbNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
          const tableArn = resolveInterpolation(
            "aws_dynamodb_table",
            ddbName,
            "arn"
          );
          dynamoResources.push(tableArn);
        }
      }
      if (dynamoResources.length > 0) {
        lambdaPolicyStatements.push({
          Effect: "Allow",
          Action: [
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:UpdateItem",
            "dynamodb:DeleteItem",
            "dynamodb:Scan",
            "dynamodb:Query",
          ],
          Resource: dynamoResources,
        });
      }
    }

    if (lambdaPolicyStatements.length > 0) {
      compiler.addResource(
        "aws_iam_role_policy",
        "lambda_connections",
        {
          name: compiler.getRunName(
            baseName,
            shortId,
            "lambda-connections-policy"
          ),
          role: resolveInterpolation("aws_iam_role", "lambda_exec", "id"),
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: lambdaPolicyStatements,
          }),
        },
        "iam",
        true,
        ["aws_iam_role.lambda_exec"]
      );
    }
  }
}
