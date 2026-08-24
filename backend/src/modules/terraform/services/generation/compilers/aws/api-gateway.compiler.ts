import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class AwsApiGatewayCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, providerData } = args;

    // 1. HTTP API Gateway
    compiler.addResource(
      "aws_apigatewayv2_api",
      name,
      {
        ...providerData,
        name: compiler.shortId
          ? `${config.name}${compiler.shortId}`
          : config.name,
        protocol_type: config.protocolType || "HTTP",
      },
      "apigateway",
      false,
      deps,
    );

    // 2. Stage ($default Stage with auto_deploy)
    compiler.addResource(
      "aws_apigatewayv2_stage",
      `${name}_default`,
      {
        ...providerData,
        api_id: resolveInterpolation("aws_apigatewayv2_api", name, "id"),
        name: "$default",
        auto_deploy: true,
      },
      "apigateway",
      true,
      [`aws_apigatewayv2_api.${name}`],
    );

    // 3. Find connected Lambda nodes
    const connectedLambdas =
      compiler.req.edges
        ?.filter((e) => e.source === node.id || e.target === node.id)
        .map((e) => (e.source === node.id ? e.target : e.source))
        .map((id) => compiler.req.nodes.find((n) => n.id === id))
        .filter((n): n is TfNodeInput => !!n && n.serviceId === "lambda") ?? [];

    for (const lambdaNode of connectedLambdas) {
      const lambdaName = `sim_${lambdaNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const integrationName = `int_${name}_${lambdaName}`;
      const routeName = `route_${name}_${lambdaName}`;
      const permissionName = `perm_${name}_${lambdaName}`;

      // 4. Integration
      compiler.addResource(
        "aws_apigatewayv2_integration",
        integrationName,
        {
          ...providerData,
          api_id: resolveInterpolation("aws_apigatewayv2_api", name, "id"),
          integration_type: "AWS_PROXY",
          integration_method: "POST",
          integration_uri: resolveInterpolation(
            "aws_lambda_function",
            lambdaName,
            "invoke_arn",
          ),
        },
        "apigateway",
        true,
        [`aws_apigatewayv2_api.${name}`, `aws_lambda_function.${lambdaName}`],
      );

      // 5. Route (ANY /{proxy+})
      compiler.addResource(
        "aws_apigatewayv2_route",
        routeName,
        {
          ...providerData,
          api_id: resolveInterpolation("aws_apigatewayv2_api", name, "id"),
          route_key: "ANY /{proxy+}",
          target: `integrations/\${aws_apigatewayv2_integration.${integrationName}.id}`,
        },
        "apigateway",
        true,
        [
          `aws_apigatewayv2_api.${name}`,
          `aws_apigatewayv2_integration.${integrationName}`,
        ],
      );

      // 6. Lambda Permission
      compiler.addResource(
        "aws_lambda_permission",
        permissionName,
        {
          ...providerData,
          statement_id: `AllowExecutionFromAPIGateway-${lambdaName}`.substring(
            0,
            100,
          ),
          action: "lambda:InvokeFunction",
          function_name: resolveInterpolation(
            "aws_lambda_function",
            lambdaName,
            "function_name",
          ),
          principal: "apigateway.amazonaws.com",
          source_arn: `\${aws_apigatewayv2_api.${name}.execution_arn}/*/*`,
        },
        "lambda_permission",
        true,
        [`aws_apigatewayv2_api.${name}`, `aws_lambda_function.${lambdaName}`],
      );
    }
  }
}
