import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpStorageCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { config, name, deps } = args;
    compiler.addResource(
      "google_storage_bucket",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `${config.bucketName}${compiler.shortId}`
            : config.bucketName,
        ),
        location: config.location,
        storage_class: config.storageClass,
        uniform_bucket_level_access: true,
        versioning: {
          enabled: config.versioning,
        },
      },
      "gcp_storage",
      false,
      deps,
      ["versioning"],
    );
    if (config.policy) {
      compiler.addResource(
        "google_storage_bucket_iam_policy",
        `${name}_policy`,
        {
          bucket: resolveInterpolation("google_storage_bucket", name, "name"),
          policy_data: config.policy,
        },
        "gcp_storage_policy",
        true,
        [`google_storage_bucket.${name}`],
      );
    }
  }
}
