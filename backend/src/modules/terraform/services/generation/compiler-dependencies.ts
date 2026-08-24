import { ServiceSchemas } from "../../../../config/terraform-schemas";
import { resolveInterpolation } from "./graph-resolver";
import type { TerraformCompiler } from "./compiler";

export function resolveDatabaseDependencies(
  compiler: TerraformCompiler,
  nodeId: string
): Array<{ name: string; value: string }> {
  const envVars: Array<{ name: string; value: string }> = [];
  const incomingEdges =
    compiler.req.edges?.filter((edge) => edge.target === nodeId) || [];

  for (const edge of incomingEdges) {
    const sourceNode = compiler.req.nodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;
    const sourceName = `sim_${sourceNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
    addDbEnvVars(sourceNode, sourceName, envVars);
  }

  const outgoingEdges =
    compiler.req.edges?.filter((edge) => edge.source === nodeId) || [];
  for (const edge of outgoingEdges) {
    const targetNode = compiler.req.nodes.find((n) => n.id === edge.target);
    if (!targetNode) continue;
    const targetName = `sim_${targetNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
    addDbEnvVars(targetNode, targetName, envVars);
  }

  return envVars;
}

function addDbEnvVars(
  node: any,
  name: string,
  envVars: Array<{ name: string; value: string }>
) {
  // AWS RDS
  if (node.serviceId === "rds") {
    envVars.push(
      { name: "DB_HOST", value: `\${aws_db_instance.${name}.address}` },
      { name: "DB_PORT", value: `\${aws_db_instance.${name}.port}` },
      { name: "DB_NAME", value: `\${aws_db_instance.${name}.db_name}` },
      { name: "DB_USER", value: `\${aws_db_instance.${name}.username}` }
    );
  }
  // AWS S3
  if (node.serviceId === "s3") {
    envVars.push({
      name: "S3_BUCKET_NAME",
      value: `\${aws_s3_bucket.${name}.id}`,
    });
  }
  // AWS DynamoDB
  if (node.serviceId === "dynamodb") {
    envVars.push({
      name: "DYNAMODB_TABLE_NAME",
      value: `\${aws_dynamodb_table.${name}.name}`,
    });
  }
  // Azure SQL
  if (node.serviceId === "azure_sql") {
    envVars.push(
      {
        name: "DB_HOST",
        value: `\${azurerm_mssql_server.server_${name}.fully_qualified_domain_name}`,
      },
      { name: "DB_NAME", value: `\${azurerm_mssql_database.${name}.name}` },
      { name: "DB_USER", value: "sqladmin" }
    );
  }
  // Azure Storage
  if (node.serviceId === "azure_storage") {
    envVars.push({
      name: "AZURE_STORAGE_ACCOUNT",
      value: `\${azurerm_storage_account.${name}.name}`,
    });
  }
  // GCP SQL
  if (node.serviceId === "gcp_sql") {
    envVars.push(
      {
        name: "DB_HOST",
        value: `\${google_sql_database_instance.instance_${name}.public_ip_address}`,
      },
      { name: "DB_NAME", value: `\${google_sql_database.${name}.name}` },
      { name: "DB_USER", value: "sqladmin" }
    );
  }
  // GCP Storage
  if (node.serviceId === "gcp_storage") {
    envVars.push({
      name: "GCP_STORAGE_BUCKET",
      value: `\${google_storage_bucket.${name}.name}`,
    });
  }
}

export function resolveGithubDependency(
  compiler: TerraformCompiler,
  nodeId: string
): any | null {
  const incomingEdges =
    compiler.req.edges?.filter((edge) => edge.target === nodeId) || [];
  for (const edge of incomingEdges) {
    const sourceNode = compiler.req.nodes.find((n) => n.id === edge.source);
    if (sourceNode && sourceNode.serviceId === "github") {
      const schema = ServiceSchemas["github"];
      if (schema) {
        return schema.parse(sourceNode.config);
      }
    }
  }
  const outgoingEdges =
    compiler.req.edges?.filter((edge) => edge.source === nodeId) || [];
  for (const edge of outgoingEdges) {
    const targetNode = compiler.req.nodes.find((n) => n.id === edge.target);
    if (targetNode && targetNode.serviceId === "github") {
      const schema = ServiceSchemas["github"];
      if (schema) {
        return schema.parse(targetNode.config);
      }
    }
  }
  return null;
}

export function resolveDockerHubDependency(
  compiler: TerraformCompiler,
  nodeId: string
): any | null {
  const incomingEdges =
    compiler.req.edges?.filter((edge) => edge.target === nodeId) || [];
  for (const edge of incomingEdges) {
    const sourceNode = compiler.req.nodes.find((n) => n.id === edge.source);
    if (sourceNode && sourceNode.serviceId === "dockerhub") {
      const schema = ServiceSchemas["dockerhub"];
      if (schema) {
        return schema.parse(sourceNode.config);
      }
    }
  }
  const outgoingEdges =
    compiler.req.edges?.filter((edge) => edge.source === nodeId) || [];
  for (const edge of outgoingEdges) {
    const targetNode = compiler.req.nodes.find((n) => n.id === edge.target);
    if (targetNode && targetNode.serviceId === "dockerhub") {
      const schema = ServiceSchemas["dockerhub"];
      if (schema) {
        return schema.parse(targetNode.config);
      }
    }
  }
  return null;
}

export function resolveEcrDependency(
  compiler: TerraformCompiler,
  nodeId: string
): any | null {
  const registryServiceIds = ["ecr", "azure_acr", "gcp_artifact_registry"];

  const resolveRegistryNode = (registryNode: any): any | null => {
    const schemaKey = registryNode.serviceId as keyof typeof ServiceSchemas;
    const schema = ServiceSchemas[schemaKey];
    if (!schema) return null;

    const parsed = schema.parse(registryNode.config || {});
    const name = `sim_${registryNode.id.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
    const isExisting = parsed.repositoryMode === "existing";

    let repository: string;
    if (isExisting) {
      repository = parsed.existingRepositoryUrl || "";
    } else if (registryNode.serviceId === "azure_acr") {
      repository = `\${azurerm_container_registry.${name}.login_server}`;
    } else if (registryNode.serviceId === "gcp_artifact_registry") {
      repository = `\${google_artifact_registry_repository.${name}.location}-docker.pkg.dev/\${google_artifact_registry_repository.${name}.project}/\${google_artifact_registry_repository.${name}.repository_id}`;
    } else {
      repository = `\${aws_ecr_repository.${name}.repository_url}`;
    }

    return {
      ...parsed,
      isEcr: true,
      registryProvider: registryNode.serviceId,
      nodeName: name,
      repository,
      tag: parsed.imageTag || "latest",
    };
  };

  const incomingEdges =
    compiler.req.edges?.filter((edge) => edge.target === nodeId) || [];
  for (const edge of incomingEdges) {
    const sourceNode = compiler.req.nodes.find((n) => n.id === edge.source);
    if (sourceNode && registryServiceIds.includes(sourceNode.serviceId)) {
      const result = resolveRegistryNode(sourceNode);
      if (result) return result;
    }
  }
  const outgoingEdges =
    compiler.req.edges?.filter((edge) => edge.source === nodeId) || [];
  for (const edge of outgoingEdges) {
    const targetNode = compiler.req.nodes.find((n) => n.id === edge.target);
    if (targetNode && registryServiceIds.includes(targetNode.serviceId)) {
      const result = resolveRegistryNode(targetNode);
      if (result) return result;
    }
  }
  return null;
}
