import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsLambdaCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, deps, providerData } = args;
    const lambdaEnvVars = compiler.resolveDatabaseDependencies(node.id);
    const lambdaEnv: Record<string, string> = {};
    for (const ev of lambdaEnvVars) {
      lambdaEnv[ev.name] = ev.value;
    }

    const lambdaParams: any = {
      ...providerData,
      function_name: config.functionName,
      runtime: config.runtime,
      handler: config.handler,
      memory_size: config.memoryMb,
      timeout: config.timeoutSec,
      role: resolveInterpolation("aws_iam_role", "lambda_exec", "arn"),
    };

    const lambdaDeps = ["aws_iam_role.lambda_exec", ...deps];

    if (config.code) {
      const handlerParts = (config.handler || "index.handler").split(".");
      const fileName =
        handlerParts[0] +
        (config.runtime && config.runtime.startsWith("python") ? ".py" : ".js");
      const zipName = `zip_${name}`;

      compiler.addDataSource(
        "archive_file",
        zipName,
        {
          type: "zip",
          output_path: `\${path.module}/${name}.zip`,
          source: [
            {
              content: config.code,
              filename: fileName,
            },
          ],
        },
        [],
        ["source"],
      );

      lambdaParams.filename = `\${data.archive_file.${zipName}.output_path}`;
      lambdaParams.source_code_hash = `\${data.archive_file.${zipName}.output_base64sha256}`;
      lambdaDeps.push(`data.archive_file.${zipName}`);
    } else {
      lambdaParams.filename = "/dev/null";
    }

    if (Object.keys(lambdaEnv).length > 0) {
      lambdaParams.environment = {
        variables: lambdaEnv,
      };
    }

    compiler.addResource(
      "aws_lambda_function",
      name,
      lambdaParams,
      "lambda",
      false,
      lambdaDeps,
      Object.keys(lambdaEnv).length > 0 ? ["environment"] : [],
    );
  }
}
