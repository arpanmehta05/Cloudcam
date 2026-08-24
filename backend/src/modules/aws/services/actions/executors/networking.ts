export async function executeNetworking(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  proposedState?: string
): Promise<any> {
  throw new Error(`No networking executor implemented for action: ${actionId}`);
}

export async function rollbackNetworking(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  preSnapshot: any
): Promise<void> {
  throw new Error(`No networking rollback implemented for action: ${actionId}`);
}

export async function captureNetworkingSnapshot(
  service: string,
  resourceId: string,
  clientConfig: any
): Promise<any> {
  return null;
}
