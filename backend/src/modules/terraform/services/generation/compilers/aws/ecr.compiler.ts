import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsEcrCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, deps, providerData } = args;

    if (config.repositoryMode === "existing") {
      // Do not create a repository resource for existing repositories.
      return;
    }

    compiler.addResource(
      "aws_ecr_repository",
      name,
      {
        ...providerData,
        name: config.repositoryName || "sim-repo",
        image_tag_mutability: config.imageMutability || "MUTABLE",
        force_delete: true,
        image_scanning_configuration: {
          scan_on_push:
            config.scanOnPush !== undefined ? config.scanOnPush : true,
        },
      },
      "ecr",
      false,
      deps,
      ["image_scanning_configuration"],
    );
  }
}
