import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsS3Compiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, deps, providerData } = args;
    compiler.addResource(
      "aws_s3_bucket",
      name,
      {
        ...providerData,
        bucket_prefix: config.bucketName
          ? config.bucketName
              .toLowerCase()
              .replace(/[^a-z0-9.-]/g, "-")
              .substring(0, 37) + "-"
          : "sim-",
        tags: { Name: config.bucketName },
      },
      "s3",
      false,
      deps,
    );

    if (config.versioning) {
      compiler.addResource(
        "aws_s3_bucket_versioning",
        `${name}_v`,
        {
          ...providerData,
          bucket: resolveInterpolation("aws_s3_bucket", name, "id"),
          versioning_configuration: { status: "Enabled" },
        },
        "s3",
        true,
        [`aws_s3_bucket.${name}`],
        ["versioning_configuration"],
      );
    }

    const pabName = `${name}_pab`;
    compiler.addResource(
      "aws_s3_bucket_public_access_block",
      pabName,
      {
        ...providerData,
        bucket: resolveInterpolation("aws_s3_bucket", name, "id"),
        block_public_acls: !config.publicAccess,
        block_public_policy: !config.publicAccess,
        ignore_public_acls: !config.publicAccess,
        restrict_public_buckets: !config.publicAccess,
      },
      "s3",
      true,
      [`aws_s3_bucket.${name}`],
    );

    if (config.policy) {
      let policyStr = config.policy;

      // Replace invalid wildcard bucket resources with the correct dynamic resource ARN
      policyStr = policyStr
        .split("arn:aws:s3:::*/*")
        .join(`arn:aws:s3:::\${aws_s3_bucket.${name}.id}/*`);
      policyStr = policyStr
        .split("arn:aws:s3:::*")
        .join(`arn:aws:s3:::\${aws_s3_bucket.${name}.id}`);

      if (config.bucketName) {
        const cleanName = config.bucketName
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, "-");
        policyStr = policyStr
          .split(config.bucketName)
          .join(`\${aws_s3_bucket.${name}.id}`);
        if (cleanName !== config.bucketName) {
          policyStr = policyStr
            .split(cleanName)
            .join(`\${aws_s3_bucket.${name}.id}`);
        }
      }
      policyStr = policyStr
        .split("${BUCKET_NAME}")
        .join(`\${aws_s3_bucket.${name}.id}`);
      policyStr = policyStr
        .split("BUCKET_NAME")
        .join(`\${aws_s3_bucket.${name}.id}`);

      compiler.addResource(
        "aws_s3_bucket_policy",
        `${name}_policy`,
        {
          ...providerData,
          bucket: resolveInterpolation("aws_s3_bucket", name, "id"),
          policy: policyStr,
          depends_on: [
            `aws_s3_bucket.${name}`,
            `aws_s3_bucket_public_access_block.${pabName}`,
          ],
        },
        "s3_policy",
        true,
        [
          `aws_s3_bucket.${name}`,
          `aws_s3_bucket_public_access_block.${pabName}`,
        ],
      );
    }
  }
}
