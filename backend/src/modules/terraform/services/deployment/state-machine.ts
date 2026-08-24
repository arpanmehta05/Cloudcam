import { PersistentSimulationModel } from "../../../../models/simulation-persistent.model";

export async function markPersistentSimulationFailed(
  simulationId: any,
  failedDeployment?: {
    deploymentId: string;
    label: string;
    provider?: "aws" | "azure" | "gcp";
    region: string;
    hcl: string;
    state?: any;
    outputs?: any;
  }
): Promise<void> {
  const sim = await PersistentSimulationModel.findById(simulationId).select("deployments").lean();
  const activeDeployments = (sim?.deployments || []).filter((deployment: any) => deployment.status === "active");
  const updateDoc: any = {
    $set: {
      status: activeDeployments.length > 0 ? "active" : "failed",
    },
  };

  if (failedDeployment) {
    const deploymentId = failedDeployment.deploymentId;
    const existingDep = (sim?.deployments || []).some((d: any) => d.deploymentId === deploymentId);
    if (existingDep) {
      // Update existing
      await PersistentSimulationModel.updateOne(
        { _id: simulationId, "deployments.deploymentId": deploymentId },
        {
          $set: {
            status: activeDeployments.length > 0 ? "active" : "failed",
            "deployments.$.status": "failed",
            "deployments.$.state": failedDeployment.state,
            "deployments.$.outputs": failedDeployment.outputs || {},
          }
        }
      );
      return;
    } else {
      updateDoc.$push = {
        deployments: {
          deploymentId: failedDeployment.deploymentId,
          label: failedDeployment.label,
          status: "failed",
          provider: failedDeployment.provider,
          region: failedDeployment.region,
          hcl: failedDeployment.hcl,
          state: failedDeployment.state,
          outputs: failedDeployment.outputs || {},
          createdAt: new Date(),
        },
      };
    }
  }

  await PersistentSimulationModel.findByIdAndUpdate(simulationId, updateDoc);
}
