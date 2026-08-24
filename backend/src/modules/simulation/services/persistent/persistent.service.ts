// Simulation Persistent Service — holds Mongoose-based persistent record operations.

import { PersistentSimulationModel } from "../../models/simulation-persistent.model";
import { DeploymentSessionModel } from "../../../../models/deployment.model";
import { decrypt } from "../../../../shared/crypto/encryption";
import { resolveSimulationKeyName } from "../../../../utils/simulation-key-name";
import {
  resolveGcpCredentialPayload,
  startPersistentSimulationDestroy,
  validateAwsCredentials,
  validateGcpCredentials,
} from "../../../terraform";
import { resolveCredentialPayload } from "../../../../services/aws-credential-vault.service";
import { getCredentials } from "../../../../store/workspace-credentials";
import { config } from "../../../../config/env";
import { validateAzureCredentials } from "../../../azure";

export function findPrivateKeyInTerraformState(state: any): string | null {
  const rootResources = state?.values?.root_module?.resources;
  if (Array.isArray(rootResources)) {
    const keyResource = rootResources.find(
      (resource: any) => resource?.type === "tls_private_key",
    );
    const privateKey = keyResource?.values?.private_key_pem;
    if (typeof privateKey === "string" && privateKey.includes("BEGIN"))
      return privateKey;
  }

  const rawResources = state?.resources;
  if (Array.isArray(rawResources)) {
    for (const resource of rawResources) {
      if (resource?.type !== "tls_private_key") continue;
      const instances = Array.isArray(resource.instances)
        ? resource.instances
        : [];
      for (const instance of instances) {
        const privateKey = instance?.attributes?.private_key_pem;
        if (typeof privateKey === "string" && privateKey.includes("BEGIN"))
          return privateKey;
      }
    }
  }

  return null;
}

export function inferSimulationProvider(
  sim: any,
  deployment?: any,
): "aws" | "azure" | "gcp" {
  if (deployment?.provider) return deployment.provider;
  const hcl = `${deployment?.hcl || sim?.terraform?.hcl || ""}`;
  if (hcl.includes("azurerm_") || hcl.includes('provider "azurerm"'))
    return "azure";
  if (hcl.includes("google_") || hcl.includes('provider "google"'))
    return "gcp";
  const firstService =
    sim?.graph?.nodes?.[0]?.serviceId ||
    sim?.graph?.nodes?.[0]?.data?.serviceId ||
    "";
  if (firstService.startsWith("azure_")) return "azure";
  if (firstService.startsWith("gcp_")) return "gcp";
  return "aws";
}

export async function resolveAzureDestroyCredentials(userId: string, body: any) {
  const credentialVaultId =
    typeof body?.credentialVaultId === "string"
      ? body.credentialVaultId.trim()
      : "";
  if (credentialVaultId === "saved") {
    const creds = await getCredentials(userId, "azure");
    const tenantId = creds?.tenantId;
    const subscriptionId = creds?.subscriptionId;
    const clientId = creds?.clientId || config.azure.clientId;
    const clientSecret = creds?.clientSecret || config.azure.clientSecret;
    if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
      throw new Error(
        "No saved Azure deployment credentials found for this workspace.",
      );
    }
    return { tenantId, subscriptionId, clientId, clientSecret };
  }

  const tenantId =
    typeof body?.tenantId === "string" ? body.tenantId.trim() : "";
  const subscriptionId =
    typeof body?.subscriptionId === "string" ? body.subscriptionId.trim() : "";
  const clientId =
    typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret =
    typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
  if (!tenantId || !subscriptionId || !clientId || !clientSecret) {
    throw new Error(
      "Missing Azure credential parameters for destroy (tenantId, subscriptionId, clientId, clientSecret).",
    );
  }
  return { tenantId, subscriptionId, clientId, clientSecret };
}

/**
 * Creates a new persistent simulation record.
 */
export async function createSimulationService(
  userId: string,
  name: string,
  region: string,
  provider?: string,
  nodes: any[] = [],
  edges: any[] = [],
) {
  if (!name || !region) {
    throw new Error("Name and region are required");
  }

  return await PersistentSimulationModel.create({
    userId,
    name,
    status: "draft",
    region,
    provider,
    graph: { nodes, edges },
    terraform: { hcl: "" },
  });
}

/**
 * Updates an existing persistent simulation.
 */
export async function updateSimulationService(
  id: string,
  userId: string,
  updateBody: { name?: string; region?: string; provider?: string; nodes?: any[]; edges?: any[] },
) {
  const updateData: any = {};
  if (updateBody.name !== undefined) updateData.name = updateBody.name;
  if (updateBody.region !== undefined) updateData.region = updateBody.region;
  if (updateBody.provider !== undefined) updateData.provider = updateBody.provider;
  if (updateBody.nodes !== undefined || updateBody.edges !== undefined) {
    updateData.graph = {};
    if (updateBody.nodes !== undefined) updateData.graph.nodes = updateBody.nodes;
    if (updateBody.edges !== undefined) updateData.graph.edges = updateBody.edges;
  }

  const sim = await PersistentSimulationModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: updateData },
    { returnDocument: "after" },
  );

  if (!sim) {
    throw new Error("Simulation not found");
  }

  return sim;
}

/**
 * Lists all simulations for a user, normalizing their status and provider info.
 */
export async function listSimulationsService(userId: string) {
  const simulations = await PersistentSimulationModel.find({ userId })
    .select(
      "name status region provider graph.nodes deployments.deploymentId deployments.label deployments.status deployments.provider deployments.region deployments.outputs.private_key deployments.createdAt deployments.destroyedAt terraform.outputs.private_key createdAt updatedAt",
    )
    .sort({ createdAt: -1 })
    .lean();

  return simulations.map((simulation: any) => {
    const deployments = simulation.deployments || [];

    // Deduplicate deployments by deploymentId
    const uniqueDeploymentsMap = new Map<string, any>();
    for (const dep of deployments) {
      if (!dep.deploymentId) continue;
      const existing = uniqueDeploymentsMap.get(dep.deploymentId);
      if (!existing) {
        uniqueDeploymentsMap.set(dep.deploymentId, dep);
      } else {
        const statusPriority: Record<string, number> = {
          destroyed: 4,
          active: 3,
          failed: 2,
        };
        const pExisting = statusPriority[existing.status] || 1;
        const pCurrent = statusPriority[dep.status] || 1;
        if (pCurrent > pExisting) {
          uniqueDeploymentsMap.set(dep.deploymentId, dep);
        }
      }
    }
    const uniqueDeployments = Array.from(uniqueDeploymentsMap.values());

    const provider = inferSimulationProvider(simulation);
    const mappedDeployments = uniqueDeployments.map((deployment: any) => ({
      ...deployment,
      provider: inferSimulationProvider(simulation, deployment),
    }));
    const hasPrivateKey =
      !!simulation.terraform?.outputs?.private_key ||
      uniqueDeployments.some((d: any) => !!d.outputs?.private_key);

    const base = {
      ...simulation,
      provider,
      deployments: mappedDeployments,
      hasPrivateKey,
      graph: undefined,
    };
    if (
      mappedDeployments.some(
        (deployment: any) => deployment.status === "active",
      )
    ) {
      return { ...base, status: "active" };
    }
    if (
      mappedDeployments.length > 0 &&
      mappedDeployments.every(
        (deployment: any) => deployment.status === "destroyed",
      )
    ) {
      return { ...base, status: "destroyed" };
    }
    return base;
  });
}

/**
 * Retrieves the full simulation details, resolving secrets and backporting session outputs.
 */
export async function getSimulationDetailService(id: string, userId: string) {
  const sim = await PersistentSimulationModel.findOne({ _id: id, userId });
  if (!sim) {
    throw new Error("Simulation not found");
  }

  const simObj = sim.toObject();

  // Deduplicate deployments by deploymentId
  if (simObj.deployments) {
    const uniqueDeploymentsMap = new Map<string, any>();
    for (const dep of simObj.deployments) {
      if (!dep.deploymentId) continue;
      const existing = uniqueDeploymentsMap.get(dep.deploymentId);
      if (!existing) {
        uniqueDeploymentsMap.set(dep.deploymentId, dep);
      } else {
        const statusPriority: Record<string, number> = {
          destroyed: 4,
          active: 3,
          failed: 2,
        };
        const pExisting = statusPriority[existing.status] || 1;
        const pCurrent = statusPriority[dep.status] || 1;
        if (pCurrent > pExisting) {
          uniqueDeploymentsMap.set(dep.deploymentId, dep);
        }
      }
    }
    simObj.deployments = Array.from(uniqueDeploymentsMap.values());
  }

  // Backport missing outputs (like lb_info_*) from DeploymentSession
  if (simObj.deployments) {
    for (const dep of simObj.deployments) {
      if (dep.deploymentId) {
        try {
          const session = await DeploymentSessionModel.findById(dep.deploymentId).lean();
          if (session?.outputs) {
            dep.outputs = dep.outputs || {};
            for (const key of Object.keys(session.outputs)) {
              if (
                (key.startsWith("lb_info_") || key.startsWith("vm_info_") || key.startsWith("apigateway_url_")) &&
                !dep.outputs[key]
              ) {
                dep.outputs[key] = session.outputs[key];
              }
            }
            // If this is the active deployment, also merge into top-level terraform.outputs
            if (dep.status === "active") {
              simObj.terraform = simObj.terraform || {};
              simObj.terraform.outputs = simObj.terraform.outputs || {};
              for (const key of Object.keys(session.outputs)) {
                if (
                  (key.startsWith("lb_info_") || key.startsWith("vm_info_") || key.startsWith("apigateway_url_")) &&
                  !simObj.terraform.outputs[key]
                ) {
                  simObj.terraform.outputs[key] = session.outputs[key];
                }
              }
            }
          }
        } catch (err) {
          console.error(`Failed to backport outputs for deployment ${dep.deploymentId}:`, err);
        }
      }
    }
  }

  // Decrypt private key if it exists
  if (simObj.terraform?.outputs?.private_key) {
    try {
      const decrypted = decrypt(simObj.terraform.outputs.private_key);
      simObj.terraform.outputs.private_key = {
        value: decrypted,
        sensitive: true,
        type: "string",
      };
    } catch (err) {
      console.error("Failed to decrypt private key:", err);
      simObj.terraform.outputs.private_key = {
        value: "ERROR: Failed to decrypt",
        sensitive: true,
        type: "string",
      };
    }
  }

  // Decrypt private key in individual deployments
  if (simObj.deployments) {
    for (const dep of simObj.deployments) {
      if (dep.outputs?.private_key) {
        try {
          const decrypted = decrypt(dep.outputs.private_key);
          dep.outputs.private_key = {
            value: decrypted,
            sensitive: true,
            type: "string",
          };
        } catch (err) {
          console.error("Failed to decrypt deployment private key:", err);
          dep.outputs.private_key = {
            value: "ERROR: Failed to decrypt",
            sensitive: true,
            type: "string",
          };
        }
      }
    }
  }

  const provider = simObj.provider || inferSimulationProvider(simObj);
  const hasPrivateKey =
    !!simObj.terraform?.outputs?.private_key ||
    (simObj.deployments || []).some((d: any) => !!d.outputs?.private_key);

  return {
    ...simObj,
    provider,
    hasPrivateKey,
  };
}

/**
 * Extracts and decrypts the PEM private key file for download.
 */
export async function downloadPemService(id: string, userId: string, requestedDeploymentId: string | null) {
  const sim = await PersistentSimulationModel.findOne({ _id: id, userId });
  if (!sim) {
    throw new Error("Simulation not found");
  }

  const deploymentsWithKeys = (sim.deployments || [])
    .filter((deployment: any) => deployment.outputs?.private_key)
    .sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  const deployment = requestedDeploymentId
    ? deploymentsWithKeys.find(
        (item: any) => item.deploymentId === requestedDeploymentId,
      )
    : deploymentsWithKeys[0];

  const encryptedKey =
    deployment?.outputs?.private_key || sim.terraform?.outputs?.private_key;
  const stateKey =
    findPrivateKeyInTerraformState(deployment?.state) ||
    findPrivateKeyInTerraformState(sim.terraform?.state);

  if (!encryptedKey && !stateKey) {
    throw new Error("PEM key not found for this simulation");
  }

  const decryptedKey = encryptedKey ? decrypt(encryptedKey) : stateKey!;
  const keyName = resolveSimulationKeyName({
    outputKeyName:
      deployment?.outputs?.key_name || sim.terraform?.outputs?.key_name,
    hcl: deployment?.hcl || sim.terraform?.hcl,
    simulationName: sim.name,
    deploymentId: deployment?.deploymentId,
  });

  return {
    decryptedKey,
    filename: `${keyName}.pem`,
  };
}

/**
 * Deletes a persistent simulation record.
 */
export async function deleteSimulationService(id: string, userId: string) {
  const sim = await PersistentSimulationModel.findOneAndDelete({ _id: id, userId });
  if (!sim) {
    throw new Error("Simulation not found");
  }
}

/**
 * Triggers the teardown/destroy run for a simulation deployment.
 */
export async function destroySimulationService(id: string, userId: string, body: any) {
  const { deploymentId } = body || {};
  if (!deploymentId) {
    throw new Error("deploymentId is required so only the selected deployment is destroyed");
  }

  const sim = await PersistentSimulationModel.findOne({ _id: id, userId });
  if (!sim) {
    throw new Error("Simulation not found");
  }

  const deployments = sim.deployments || [];
  const deployment = deployments.find(
    (item: any) => item.deploymentId === String(deploymentId),
  );
  const provider = body?.provider || inferSimulationProvider(sim, deployment);
  const targetRegion =
    body?.region ||
    deployment?.region ||
    sim.region ||
    (provider === "azure" ? "centralindia" : "us-east-1");

  let accessKeyId = "";
  let secretAccessKey = "";
  let sessionToken = "";
  let providerOptions: any = { provider };

  if (provider === "azure") {
    const azureCreds = await resolveAzureDestroyCredentials(userId, body || {});
    const isValid = await validateAzureCredentials(azureCreds);
    if (!isValid) {
      throw new Error("Invalid Azure credentials or insufficient subscription access permissions.");
    }
    providerOptions.azure = azureCreds;
  } else if (provider === "gcp") {
    const gcpCreds = await resolveGcpCredentialPayload(userId, body || {});
    await validateGcpCredentials(gcpCreds);
    providerOptions.gcp = gcpCreds;
  } else {
    const resolvedCreds = await resolveCredentialPayload(userId, body || {});
    accessKeyId = resolvedCreds.accessKeyId;
    secretAccessKey = resolvedCreds.secretAccessKey;
    sessionToken = resolvedCreds.sessionToken || "";
    await validateAwsCredentials(
      accessKeyId,
      secretAccessKey,
      sessionToken,
      targetRegion,
    );
  }

  return await startPersistentSimulationDestroy(
    userId,
    id,
    String(deploymentId),
    accessKeyId,
    secretAccessKey,
    sessionToken,
    targetRegion,
    providerOptions,
  );
}
