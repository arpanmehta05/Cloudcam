import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpIpCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;

    compiler.addResource(
      "google_compute_address",
      name,
      {
        name: config.name || "sim-ip",
        region: r,
      },
      "gcp_ip",
      false,
      deps,
    );
  }
}
