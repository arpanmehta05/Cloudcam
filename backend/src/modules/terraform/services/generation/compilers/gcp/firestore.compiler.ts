import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpFirestoreCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;

    // Google Cloud Firestore Database (Native mode)
    compiler.addResource(
      "google_firestore_database",
      name,
      {
        name: config.tableName ? config.tableName.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 30) : "sim-db",
        location_id: r,
        type: "FIRESTORE_NATIVE",
        deletion_protection: false,
      },
      "dynamodb",
      false,
      deps,
    );
  }
}
