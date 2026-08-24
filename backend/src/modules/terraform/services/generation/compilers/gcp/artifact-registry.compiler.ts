import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpArtifactRegistryCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;

    compiler.addResource(
      "google_artifact_registry_repository",
      name,
      {
        location: r,
        repository_id: config.repositoryId || config.repositoryName || "sim-repo",
        format: config.format || "DOCKER",
        description: config.description || "Simulation Artifact Registry",
      },
      "gcp_artifact_registry",
      false,
      deps,
    );
  }
}
