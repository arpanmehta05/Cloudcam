/* eslint-disable import/no-restricted-paths */
// GCP Live Action Controller — canonical location: modules/gcp/controllers/live-action.controller.ts
import { Request, Response } from "express";
import { createSession } from "../../../store/deployment-store";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { GcpInventoryCacheModel } from "../models/gcp-inventory-cache.model";
import { getCredentials } from "../../../store/workspace-credentials";
import crypto from "crypto";

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getGcpAccessToken(creds: {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: creds.clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const normalizedKey = creds.privateKey ? creds.privateKey.replace(/\\n/g, "\n") : "";
  const signature = base64Url(signer.sign(normalizedKey));
  const assertion = `${unsigned}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => "");
    throw new Error(`GCP service account authentication failed: ${errorText}`);
  }

  const tokenData = (await tokenResponse.json()) as any;
  return tokenData.access_token;
}

async function findResourceInCache(userId: string, resourceId: string) {
  try {
    const caches = await GcpInventoryCacheModel.find({ workspaceId: new mongoose.Types.ObjectId(userId) });
    for (const cache of caches) {
      const inventory = cache.inventory || {};
      for (const key of ["ec2", "rds", "s3", "lambda", "eks"]) {
        const items = inventory[key] || [];
        const found = items.find((item: any) => item.id === resourceId || item.name === resourceId);
        if (found) return { item: found, type: key };
      }
    }
  } catch (error) {
    console.error("[gcp/live-action] Error searching cache:", error);
  }
  return null;
}

export async function gcpLiveActionPost(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const resourceIdRaw = req.params.id;
    const resourceId = (Array.isArray(resourceIdRaw) ? resourceIdRaw[0] : resourceIdRaw) as string;
    if (!resourceId) return res.status(400).json({ success: false, error: "Missing resource ID" });

    let { action, service, region } = req.body;
    if (!action || !service || !region) return res.status(400).json({ success: false, error: "Missing required fields" });
    if (region === "all") region = "us-central1";

    const creds = await getCredentials(userId, "gcp");
    if (!creds || !creds.projectId || !creds.clientEmail || !creds.privateKey) {
      return res.status(400).json({ success: false, error: "GCP connection not connected. Please connect the project first." });
    }

    let accessToken = "";
    try {
      accessToken = await getGcpAccessToken({ projectId: creds.projectId, clientEmail: creds.clientEmail, privateKey: creds.privateKey });
    } catch (authErr: any) {
      return res.status(400).json({ success: false, error: authErr.message || "Failed to authenticate with GCP" });
    }

    const projectId = creds.projectId;
    const cachedInfo = await findResourceInCache(userId, resourceId);

    let name = resourceId;
    let zone = region;

    if (cachedInfo) {
      name = cachedInfo.item.name || resourceId;
      if (cachedInfo.item.zone) zone = cachedInfo.item.zone;
      else if (cachedInfo.item.region) zone = cachedInfo.item.region;
    }

    if (resourceId.includes("/")) {
      const parts = resourceId.split("/");
      const zoneIndex = parts.indexOf("zones");
      if (zoneIndex !== -1 && zoneIndex + 1 < parts.length) zone = parts[zoneIndex + 1];
      const regionIndex = parts.indexOf("locations");
      if (regionIndex !== -1 && regionIndex + 1 < parts.length) zone = parts[regionIndex + 1];
      name = parts[parts.length - 1];
    }

    let method = "POST";
    let url = "";

    if (service === "gcp_compute") {
      if (action === "start") { method = "POST"; url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/instances/${name}/start`; }
      else if (action === "stop") { method = "POST"; url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/instances/${name}/stop`; }
      else if (action === "restart") { method = "POST"; url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/instances/${name}/reset`; }
      else if (action === "terminate" || action === "delete") { method = "DELETE"; url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/zones/${zone}/instances/${name}`; }
      else return res.status(400).json({ success: false, error: `Action ${action} not supported for VM` });
    } else if (service === "gcp_storage" && action === "delete") {
      method = "DELETE"; url = `https://storage.googleapis.com/storage/v1/b/${name}`;
    } else if (service === "gcp_sql" && action === "delete") {
      method = "DELETE"; url = `https://sqladmin.googleapis.com/sql/v1beta4/projects/${projectId}/instances/${name}`;
    } else if (service === "gcp_function" && action === "delete") {
      if (resourceId.includes("/services/")) { method = "DELETE"; url = `https://run.googleapis.com/v1/projects/${projectId}/locations/${zone}/services/${name}`; }
      else { method = "DELETE"; url = `https://cloudfunctions.googleapis.com/v1/projects/${projectId}/locations/${zone}/functions/${name}`; }
    } else if (service === "gcp_gke" && action === "delete") {
      method = "DELETE"; url = `https://container.googleapis.com/v1/projects/${projectId}/locations/${zone}/clusters/${name}`;
    } else if ((service === "gcp_artifact_registry" || service === "ecr") && action === "delete") {
      method = "DELETE"; url = `https://artifactregistry.googleapis.com/v1/projects/${projectId}/locations/${zone}/repositories/${name}`;
    } else if ((service === "gcp_firestore" || service === "dynamodb") && action === "delete") {
      method = "DELETE"; url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${name}`;
    } else if ((service === "gcp_apigateway" || service === "apigateway") && action === "delete") {
      method = "DELETE"; url = `https://apigateway.googleapis.com/v1/projects/${projectId}/locations/${zone}/gateways/${name}`;
    } else if ((service === "gcp_cloud_run" || service === "ecs") && action === "delete") {
      method = "DELETE"; url = `https://run.googleapis.com/v2/projects/${projectId}/locations/${zone}/services/${name}`;
    } else if ((service === "gcp_vpc" || service === "vpc") && action === "delete") {
      method = "DELETE"; url = `https://compute.googleapis.com/compute/v1/projects/${projectId}/global/networks/${name}`;
    } else {
      return res.status(400).json({ success: false, error: `Action/Service combination (${action}/${service}) not supported.` });
    }

    const hcl = `
resource "null_resource" "gcp_action" {
  provisioner "local-exec" {
    interpreter = ["/bin/bash", "-c"]
    command     = <<EOF
echo "Executing GCP REST API request: ${method} ${url}"
STATUS_CODE=$(curl -s -o response.json -w "%%{http_code}" -X ${method} -H "Authorization: Bearer ${accessToken}" -H "Content-Length: 0" "${url}")
cat response.json
if [ "$STATUS_CODE" -lt 200 ] || [ "$STATUS_CODE" -ge 300 ]; then
  echo "GCP API request failed with status code $STATUS_CODE"
  exit 1
fi
EOF
  }
}
`;

    const deploymentId = `live-${randomUUID()}`;
    await createSession(deploymentId, userId, [], [], region, `Live Action: ${action} ${service} ${name}`, undefined, hcl);
    res.json({ success: true, deploymentId });
  } catch (error: any) {
    console.error("[gcpLiveActionPost]", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
