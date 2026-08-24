import { EventEmitter } from "events";
import { DeploymentSessionModel, type IDeploymentSession } from "../../../../models/deployment.model";
import { ActionRequest, AuditLog } from "../../../../models/action.model";

export const deploymentEmitter = new EventEmitter();
deploymentEmitter.setMaxListeners(200);
const recentLogFingerprints = new Map<string, Map<string, number>>();
const LOG_FINGERPRINT_TTL_MS = 30 * 60 * 1000;

function shouldAppendLog(id: string, line: string, source: "stdout" | "stderr"): boolean {
  const now = Date.now();
  let sessionLogs = recentLogFingerprints.get(id);
  if (!sessionLogs) {
    sessionLogs = new Map<string, number>();
    recentLogFingerprints.set(id, sessionLogs);
  }

  for (const [fingerprint, createdAt] of sessionLogs) {
    if (now - createdAt > LOG_FINGERPRINT_TTL_MS) {
      sessionLogs.delete(fingerprint);
    }
  }

  const fingerprint = `${source}:${line}`;
  if (sessionLogs.has(fingerprint)) return false;

  sessionLogs.set(fingerprint, now);
  return true;
}

export async function createSession(
  id: string,
  userId: string,
  nodes: any[],
  edges: any[],
  region: string,
  name?: string,
  draftId?: string,
  hcl?: string
): Promise<IDeploymentSession> {
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h TTL

  const session = new DeploymentSessionModel({
    _id: id,
    userId,
    name,
    draftId,
    nodes,
    edges,
    region,
    hcl,
    status: "waiting_creds",
    logs: [],
    expiresAt,
  });

  await session.save();
  return session;
}

export async function getSession(id: string): Promise<IDeploymentSession | null> {
  return await DeploymentSessionModel.findById(id);
}

export async function updateSession(id: string, updates: Partial<IDeploymentSession>): Promise<IDeploymentSession | null> {
  const session = await DeploymentSessionModel.findByIdAndUpdate(
    id,
    { $set: updates },
    { returnDocument: "after" }
  );
  if (session) {
    deploymentEmitter.emit(`update:${id}`, session);
    
    // Auto-log to ActionRequest for Actions Tab integration
    if (updates.status) {
      try {
        if (updates.status === "running") {
          const targets = (session.nodes || []).map((n: any) => ({
            resourceId: n.id,
            resourceName: n.data?.label || n.id,
            region: session.region || "us-east-1"
          }));
          
          const actionReq = await ActionRequest.create({
            userId: session.userId,
            actionId: "terraform-deploy",
            displayName: `Deploy: ${session.name || "Simulation"}`,
            service: "terraform",
            targets: targets.length > 0 ? targets : [{ resourceId: session.region || "us-east-1", region: session.region || "us-east-1" }],
            status: "executing",
            riskLevel: "high",
            simulationMode: false,
            executedAt: new Date(),
            postActionResult: { deploymentId: id }
          });
          
          await AuditLog.create({
            event: "executed",
            userId: session.userId,
            actionId: "terraform-deploy",
            requestId: actionReq._id.toString(),
            targets: actionReq.targets.map(t => t.resourceId),
            changes: [{ message: `Deployment ${id} started` }],
            timestamp: new Date()
          });
        } else if (["complete", "failed", "timed_out", "cancelled"].includes(updates.status)) {
          const actionReq = await ActionRequest.findOne({ "postActionResult.deploymentId": id });
          if (actionReq) {
            actionReq.status = updates.status === "complete" ? "completed" : "failed";
            if (updates.status === "complete") actionReq.completedAt = new Date();
            else actionReq.failedAt = new Date();
            if (updates.errorMessage) actionReq.errorMessage = updates.errorMessage;
            
            await actionReq.save();
            await AuditLog.create({
              event: updates.status === "complete" ? "executed" : "failed",
              userId: session.userId,
              actionId: "terraform-deploy",
              requestId: actionReq._id.toString(),
              targets: actionReq.targets.map(t => t.resourceId),
              changes: [{ message: `Deployment ${id} ${updates.status}${updates.errorMessage ? ': ' + updates.errorMessage : ''}` }],
              timestamp: new Date()
            });
          }
        }
      } catch (err) {
        console.error(`[deployment] Failed to log ActionRequest for ${id}:`, err);
      }
    }
  }
  return session;
}

export async function appendDeploymentLog(
  id: string,
  line: string,
  source: "stdout" | "stderr" = "stdout"
): Promise<void> {
  const trimmedLine = sanitizeDeploymentLogLine(line.trim());
  if (!trimmedLine || !shouldAppendLog(id, trimmedLine, source)) return;

  const log = { line: trimmedLine, source, timestamp: new Date() };
  
  // Emit immediately for live UI feedback
  deploymentEmitter.emit(`log:${id}`, log);

  // Update DB in background to avoid blocking the execution thread
  DeploymentSessionModel.findByIdAndUpdate(
    id,
    { 
      $push: { 
        logs: { 
          $each: [log],
          $slice: -5000 
        } 
      } 
    }
  ).catch(err => console.error(`[deployment] Failed to save log for ${id}:`, err));
}

function sanitizeDeploymentLogLine(line: string): string {
  if (!line) return line;
  const redactedLine = line.replace(
    /https:\/\/(?:x-access-token:)?[^@\s"'`]+@github\.com/gi,
    "https://[redacted-github-token]@github.com"
  );
  line = redactedLine;
  const lower = line.toLowerCase();
  if (
    lower.includes("private_key") ||
    lower.includes("private-key") ||
    lower.includes("private key") ||
    line.includes("-----BEGIN RSA PRIVATE KEY-----") ||
    line.includes("-----BEGIN OPENSSH PRIVATE KEY-----") ||
    line.includes("-----BEGIN PRIVATE KEY-----") ||
    line.includes("-----END RSA PRIVATE KEY-----") ||
    line.includes("-----END OPENSSH PRIVATE KEY-----") ||
    line.includes("-----END PRIVATE KEY-----")
  ) {
    return "[redacted sensitive Terraform key material]";
  }
  return line;
}

export async function getUserDeployments(userId: string): Promise<IDeploymentSession[]> {
  return await DeploymentSessionModel.find({ userId }).sort({ createdAt: -1 });
}

export async function getAllSessions(): Promise<IDeploymentSession[]> {
  return await DeploymentSessionModel.find({});
}

export function onDeploymentUpdate(id: string, cb: (session: IDeploymentSession) => void): () => void {
  const eventName = `update:${id}`;
  deploymentEmitter.on(eventName, cb);
  return () => deploymentEmitter.off(eventName, cb);
}

export function onDeploymentLog(id: string, cb: (log: any) => void): () => void {
  const eventName = `log:${id}`;
  deploymentEmitter.on(eventName, cb);
  return () => deploymentEmitter.off(eventName, cb);
}
