"use client";

import { authFetch } from "@/lib/auth-fetch";

export type SavedAwsCredential = {
  id: string;
  name: string;
  accessKeyIdLast4: string;
  defaultRegion: string;
  hasSessionToken: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CredentialMode = "manual" | "saved";

export type CredentialSelection = {
  mode: CredentialMode;
  credentialVaultId?: string;
  userPresenceVerified?: boolean;
};

export async function loadSavedAwsCredentials(): Promise<SavedAwsCredential[]> {
  const res = await authFetch("/api/aws/credential-vault");
  const data = await res.json();
  return data.credentials || [];
}

export async function saveAwsCredential(input: {
  name: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  defaultRegion: string;
}): Promise<SavedAwsCredential> {
  const res = await authFetch("/api/aws/credential-vault", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to save credential");
  return data.credential;
}

export async function deleteAwsCredential(id: string): Promise<void> {
  const res = await authFetch(`/api/aws/credential-vault/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Failed to delete credential");
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

export async function unlockWithDevicePasskey(label: string): Promise<boolean> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window) || !navigator.credentials) {
    const confirmed = window.confirm(
      `Use saved AWS key "${label}" for this action?\n\nThis browser does not expose a passkey prompt here, so Cloudcam will require this confirmation before continuing.`
    );
    if (!confirmed) throw new Error("Saved key use was cancelled");
    return true;
  }

  try {
    const LOCAL_CRED_ID_KEY = "cw_local_passkey_id";
    let credentialIdStr = localStorage.getItem(LOCAL_CRED_ID_KEY);
    let credentialId: Uint8Array | null = null;

    if (credentialIdStr) {
      const binaryString = window.atob(credentialIdStr);
      credentialId = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        credentialId[i] = binaryString.charCodeAt(i);
      }
    }

    if (!credentialId) {
      // First time: Create a local passkey to act as our local presence check
      const createResult = (await navigator.credentials.create({
        publicKey: {
          challenge: randomChallenge(),
          rp: { name: "Cloudcam" },
          user: {
            id: randomChallenge(), // random dummy user id
            name: "local-auth",
            displayName: "Local Authenticator",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Forces Windows Hello / Touch ID
            userVerification: "required",
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential;

      if (createResult && createResult.rawId) {
        const rawIdArray = new Uint8Array(createResult.rawId);
        let binaryString = "";
        for (let i = 0; i < rawIdArray.byteLength; i++) {
          binaryString += String.fromCharCode(rawIdArray[i]);
        }
        localStorage.setItem(LOCAL_CRED_ID_KEY, window.btoa(binaryString));
      }
    } else {
      // Subsequent times: Verify using the created passkey
      await navigator.credentials.get({
        publicKey: {
          challenge: randomChallenge(),
          allowCredentials: [
            {
              id: credentialId,
              type: "public-key",
            },
          ],
          timeout: 60000,
          userVerification: "required",
        },
        mediation: "optional",
      } as CredentialRequestOptions);
    }
    return true;
  } catch (err: any) {
    console.error("Local auth error:", err);
    const LOCAL_CRED_ID_KEY = "cw_local_passkey_id";
    if (
      err &&
      (err.name === "NotFoundError" ||
        err.name === "InvalidStateError" ||
        err.message?.includes("NotFoundError"))
    ) {
      console.warn(
        "Stored passkey not found or invalid on this device. Clearing stored passkey ID to allow re-registration."
      );
      localStorage.removeItem(LOCAL_CRED_ID_KEY);
    }
    const confirmed = window.confirm(
      `Device verification was not completed. Continue with saved AWS key "${label}" after confirming this is you?`
    );
    if (!confirmed) throw new Error("Saved key use was cancelled");
    return true;
  }
}
