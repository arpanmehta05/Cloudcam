import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsDynamoDbCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, deps, providerData } = args;
    compiler.addResource(
      "aws_dynamodb_table",
      name,
      {
        ...providerData,
        name: config.tableName || "sim-table",
        billing_mode: config.billingMode || "PAY_PER_REQUEST",
        hash_key: config.hashKey || "id",
        attribute: [
          {
            name: config.hashKey || "id",
            type: config.hashKeyType || "S",
          },
        ],
      },
      "dynamodb",
      false,
      deps,
      ["attribute"],
    );
  }
}
