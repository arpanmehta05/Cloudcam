import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import crypto from "crypto";
import { validateAzureCredentials } from "../../../azure";
import { getCredentials } from "../../../../store/workspace-credentials";

export { validateAzureCredentials };

export async function validateAwsCredentials(
  accessKeyId: string,
  secretAccessKey: string,
  sessionToken: string,
  region: string
): Promise<{ accountId: string; arn: string }> {
  const sts = new STSClient({
    region,
    credentials: { accessKeyId, secretAccessKey, sessionToken },
  });
  const result = await sts.send(new GetCallerIdentityCommand({}));
  return {
    accountId: result.Account || "",
    arn: result.Arn || "",
  };
}

export async function resolveGcpCredentialPayload(
  userId: string,
  body: any,
): Promise<{
  projectId: string;
  clientEmail: string;
  privateKey: string;
}> {
  const credentialVaultId =
    typeof body?.credentialVaultId === "string"
      ? body.credentialVaultId.trim()
      : "";

  if (credentialVaultId === "saved") {
    const creds = await getCredentials(userId, "gcp");
    if (!creds?.projectId || !creds?.clientEmail || !creds?.privateKey) {
      throw new Error(
        "No saved GCP integration credentials found for this workspace.",
      );
    }
    return {
      projectId: creds.projectId,
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey.replace(/\\n/g, "\n"),
    };
  }

  const projectId =
    typeof body?.projectId === "string" ? body.projectId.trim() : "";
  const clientEmail =
    typeof body?.clientEmail === "string" ? body.clientEmail.trim() : "";
  const privateKey =
    typeof body?.privateKey === "string" ? body.privateKey.trim() : "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing manual GCP credential parameters (projectId, clientEmail, privateKey).",
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function validateGcpCredentials(creds: {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}): Promise<{ accountId: string; arn: string }> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: creds.clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const normalizedKey = creds.privateKey
    ? creds.privateKey.replace(/\\n/g, "\n")
    : "";
  const signature = base64Url(signer.sign(normalizedKey));
  const assertion = `${unsigned}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text().catch(() => "");
    throw new Error(
      `GCP service account authentication failed${errorText ? `: ${errorText}` : ""}`,
    );
  }

  return {
    accountId: creds.projectId,
    arn: `GCP Service Account: ${creds.clientEmail}`,
  };
}
