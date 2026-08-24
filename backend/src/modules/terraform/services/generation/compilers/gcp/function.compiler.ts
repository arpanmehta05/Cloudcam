import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpFunctionCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { config, name, r, deps } = args;
    compiler.addResource(
      "google_storage_bucket",
      `function_src_${name}`,
      {
        name: `${compiler.getRunNameEx("fn-src", r)}-${name}`
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, "-")
          .substring(0, 63),
        location: r,
        uniform_bucket_level_access: true,
      },
      "gcp_storage",
      true,
    );

    compiler.addResource(
      "google_storage_bucket_object",
      `function_zip_${name}`,
      {
        name: "function-source.zip",
        bucket: resolveInterpolation(
          "google_storage_bucket",
          `function_src_${name}`,
          "name",
        ),
        source: "/dev/null",
      },
      "gcp_storage",
      true,
      [`google_storage_bucket.function_src_${name}`],
    );

    compiler.addResource(
      "google_cloudfunctions2_function",
      name,
      {
        name: compiler.sanitizeGcpResourceName(
          compiler.shortId
            ? `${config.functionName}${compiler.shortId}`
            : config.functionName,
        ),
        location: r,
        build_config: {
          runtime: config.runtime,
          entry_point: config.entryPoint,
          source: {
            storage_source: {
              bucket: resolveInterpolation(
                "google_storage_bucket",
                `function_src_${name}`,
                "name",
              ),
              object: resolveInterpolation(
                "google_storage_bucket_object",
                `function_zip_${name}`,
                "name",
              ),
            },
          },
        },
        service_config: {
          available_memory: "256M",
          timeout_seconds: 60,
        },
      },
      "gcp_function",
      false,
      [`google_storage_bucket_object.function_zip_${name}`, ...deps],
      ["build_config", "source", "storage_source", "service_config"],
    );
  }
}
