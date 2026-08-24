import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";
import { ServiceSchemas } from "../../../../../../config/terraform-schemas";

export class GcpApiGatewayCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps } = args;

    const apiId = `api-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 50);

    // 1. Create API Registry resource
    compiler.addResource(
      "google_api_gateway_api",
      name,
      {
        api_id: apiId,
      },
      "apigateway",
      false,
      deps,
    );

    // 2. Find connected GCP cloud function nodes
    const connectedFunctions = compiler.req.edges
      ?.filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "gcp_function") ?? [];

    let pathsYaml = "";
    const configDeps = [`google_api_gateway_api.${name}`];

    for (const funcNode of connectedFunctions) {
      const funcName = `sim_${funcNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      configDeps.push(`google_cloudfunctions2_function.${funcName}`);

      pathsYaml += `
  /${funcName}:
    post:
      summary: "Post route to ${funcName}"
      operationId: "post-${funcName}"
      x-google-backend:
        address: "\${google_cloudfunctions2_function.${funcName}.service_config[0].uri}"
      responses:
        '200':
          description: "Success"`;
    }

    // Fallback if no functions are connected to keep OpenAPI valid
    if (connectedFunctions.length === 0) {
      pathsYaml += `
  /ping:
    get:
      summary: "Ping route"
      operationId: "ping"
      x-google-backend:
        address: "https://mock.localhost"
      responses:
        '200':
          description: "Success"`;
    }

    const openapiContent = `swagger: '2.0'
info:
  title: "${config.name || "sim-api"}"
  version: "1.0.0"
schemes:
  - "https"
produces:
  - "application/json"
paths:${pathsYaml}
`;

    // 3. API Config
    compiler.addResource(
      "google_api_gateway_api_config",
      `config_${name}`,
      {
        api: resolveInterpolation("google_api_gateway_api", name, "api_id"),
        api_config_id: `cfg-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 50),
        openapi_documents: [
          {
            document: {
              path: "openapi.yaml",
              contents: openapiContent,
            },
          },
        ],
      },
      "apigateway",
      true,
      configDeps,
      ["openapi_documents"],
    );

    // 4. API Gateway Deployment
    compiler.addResource(
      "google_api_gateway_gateway",
      `gw_${name}`,
      {
        api_config: resolveInterpolation("google_api_gateway_api_config", `config_${name}`, "id"),
        gateway_id: `gw-${name}`.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 50),
        region: r,
      },
      "apigateway",
      true,
      [`google_api_gateway_api_config.config_${name}`],
    );
  }
}
