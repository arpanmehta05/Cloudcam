import { TfNodeInput, TerraformCompiler } from "../../index";
import { ResourceCompiler, CompilerArgs } from "../base.compiler";
import { resolveInterpolation } from "../../graph-resolver";

export class AzureApiGatewayCompiler implements ResourceCompiler {
  compile(args: CompilerArgs, compiler: TerraformCompiler): void {
    const { node, config, name, r, deps, rgNameVal, rgDep } = args;
    const activeRgDep = rgDep || [];
    const activeRgNameVal = rgNameVal || "";

    const apimName = compiler.shortId
      ? `${config.name}${compiler.shortId}`
      : config.name;

    // 1. Create API Management Service (APIM)
    compiler.addResource(
      "azurerm_api_management",
      name,
      {
        name: apimName.toLowerCase().replace(/[^a-z0-9-]/g, "").substring(0, 50),
        location: r,
        resource_group_name: activeRgNameVal,
        publisher_name: "Simulation Publisher",
        publisher_email: "sim@rabbittwatch.local",
        sku_name: "Developer_1",
      },
      "apigateway",
      false,
      [...activeRgDep, ...deps],
    );

    // 2. Find connected Azure Function nodes
    const connectedFunctions = compiler.req.edges
      ?.filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
      .map((id) => compiler.req.nodes.find((n) => n.id === id))
      .filter((n): n is TfNodeInput => !!n && n.serviceId === "azure_function") ?? [];

    for (const funcNode of connectedFunctions) {
      const funcName = `sim_${funcNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const apiName = `api_${name}_${funcName}`;
      const operationName = `op_${name}_${funcName}`;
      const backendName = `back_${name}_${funcName}`;
      const policyName = `policy_${name}_${funcName}`;

      // 3. API
      compiler.addResource(
        "azurerm_api_management_api",
        apiName,
        {
          name: `${apiName.substring(0, 40)}`,
          resource_group_name: activeRgNameVal,
          api_management_name: resolveInterpolation("azurerm_api_management", name, "name"),
          revision: "1",
          display_name: `Sim API for ${funcName}`,
          path: funcName,
          protocols: ["https"],
        },
        "apigateway",
        true,
        [`azurerm_api_management.${name}`],
      );

      // 4. Operation
      compiler.addResource(
        "azurerm_api_management_api_operation",
        operationName,
        {
          operation_id: `post-${funcName}`.substring(0, 40),
          api_name: resolveInterpolation("azurerm_api_management_api", apiName, "name"),
          api_management_name: resolveInterpolation("azurerm_api_management", name, "name"),
          resource_group_name: activeRgNameVal,
          display_name: `Post ${funcName}`,
          method: "POST",
          url_template: "/",
        },
        "apigateway",
        true,
        [
          `azurerm_api_management.${name}`,
          `azurerm_api_management_api.${apiName}`,
        ],
      );

      // 5. Backend
      compiler.addResource(
        "azurerm_api_management_backend",
        backendName,
        {
          name: `${backendName.substring(0, 40)}`,
          resource_group_name: activeRgNameVal,
          api_management_name: resolveInterpolation("azurerm_api_management", name, "name"),
          protocol: "http",
          url: `https://\${azurerm_linux_function_app.${funcName}.default_hostname}/api`,
        },
        "apigateway",
        true,
        [
          `azurerm_api_management.${name}`,
          `azurerm_linux_function_app.${funcName}`,
        ],
      );

      // 6. Policy
      compiler.addResource(
        "azurerm_api_management_api_policy",
        policyName,
        {
          api_name: resolveInterpolation("azurerm_api_management_api", apiName, "name"),
          api_management_name: resolveInterpolation("azurerm_api_management", name, "name"),
          resource_group_name: activeRgNameVal,
          xml_content: `\n        <policies>\n          <inbound>\n            <base />\n            <set-backend-service backend-id="\${azurerm_api_management_backend.${backendName}.name}" />\n          </inbound>\n        </policies>\n      `,
        },
        "apigateway",
        true,
        [
          `azurerm_api_management.${name}`,
          `azurerm_api_management_api.${apiName}`,
          `azurerm_api_management_backend.${backendName}`,
        ],
      );
    }
  }
}
