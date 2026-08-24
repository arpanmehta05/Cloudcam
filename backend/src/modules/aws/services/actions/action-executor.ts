// Action Executor — Dispatcher routing to service-specific executors
import { getClientConfig, DEFAULT_REGION } from "../../providers/client-factory";

import {
  executeCompute,
  rollbackCompute,
  captureComputeSnapshot,
} from "./executors/compute";
import {
  executeDatabase,
  rollbackDatabase,
  captureDatabaseSnapshot,
} from "./executors/database";
import {
  executeStorage,
  rollbackStorage,
  captureStorageSnapshot,
} from "./executors/storage";
import {
  executeNetworking,
  rollbackNetworking,
  captureNetworkingSnapshot,
} from "./executors/networking";

// Re-export orchestration methods
export { previewAction, executeAction, rollbackAction } from "./action-runner";

// ─── Target-level Execution ───
export async function executeActionForTarget(
  actionId: string,
  resourceId: string,
  region: string,
  userId: string,
  roleArn?: string,
  externalId?: string,
  proposedState?: string
): Promise<any> {
  const clientConfig = await getClientConfig(userId, region || DEFAULT_REGION, roleArn, externalId);

  if (["ec2-stop-idle", "ec2-stop", "ec2-terminate", "ec2-rightsize", "lambda-optimize", "asg-spot-migration", "purchase-savings-plan"].includes(actionId)) {
    return executeCompute(actionId, resourceId, region, clientConfig, proposedState);
  }
  if (["rds-stop", "dynamodb-autoscale"].includes(actionId)) {
    return executeDatabase(actionId, resourceId, region, clientConfig, proposedState);
  }
  if (["ebs-snapshot", "ebs-delete", "s3-lifecycle", "s3-delete-bucket"].includes(actionId)) {
    return executeStorage(actionId, resourceId, region, clientConfig, proposedState);
  }
  return executeNetworking(actionId, resourceId, region, clientConfig, proposedState);
}

// ─── Rollback per Target ───
export async function rollbackTarget(
  actionId: string,
  resourceId: string,
  region: string,
  preSnapshot: any,
  userId: string,
  roleArn?: string,
  externalId?: string
): Promise<void> {
  const clientConfig = await getClientConfig(userId, region || DEFAULT_REGION, roleArn, externalId);

  if (["ec2-stop-idle", "ec2-stop", "ec2-rightsize", "lambda-optimize"].includes(actionId)) {
    return rollbackCompute(actionId, resourceId, region, clientConfig, preSnapshot);
  }
  if (["rds-stop"].includes(actionId)) {
    return rollbackDatabase(actionId, resourceId, region, clientConfig, preSnapshot);
  }
  if (["s3-lifecycle"].includes(actionId)) {
    return rollbackStorage(actionId, resourceId, region, clientConfig, preSnapshot);
  }
  return rollbackNetworking(actionId, resourceId, region, clientConfig, preSnapshot);
}

// ─── Snapshot Capture ───
export async function captureSnapshot(
  service: string,
  resourceId: string,
  region: string,
  userId: string,
  roleArn?: string,
  externalId?: string
): Promise<any> {
  const clientConfig = await getClientConfig(userId, region || DEFAULT_REGION, roleArn, externalId);

  if (["ec2", "lambda"].includes(service)) {
    return captureComputeSnapshot(service, resourceId, clientConfig);
  }
  if (["rds"].includes(service)) {
    return captureDatabaseSnapshot(service, resourceId, clientConfig);
  }
  if (["s3"].includes(service)) {
    return captureStorageSnapshot(service, resourceId, clientConfig);
  }
  const net = await captureNetworkingSnapshot(service, resourceId, clientConfig);
  if (net) return net;
  return { resourceId, service, captured: new Date().toISOString() };
}
