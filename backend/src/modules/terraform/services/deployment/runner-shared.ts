export const DEPLOYMENT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const TERMINAL_DEPLOYMENT_STATUSES = ["complete", "failed", "cancelled", "timed_out"];
export const DOCKER_UNAVAILABLE_MESSAGE =
  "Docker Desktop is not running or the Docker daemon is unreachable. Start Docker Desktop, wait until it says the engine is running, then try the deployment again.";

export type DestroyProviderOptions = {
  provider?: "aws" | "azure" | "gcp";
  azure?: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
    subscriptionId: string;
  };
  gcp?: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
};

export function extractErrorMessage(logs: string[], fallback: string): string {
  if (!logs || logs.length === 0) return fallback;
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i].trim();
    if (line.includes("Error:") || line.includes("Error ")) {
      const cleanLine = line.replace(/^\s*[│╷╵╶─•]*\s*/, "").trim();
      let msg = cleanLine;
      for (let j = i + 1; j < Math.min(i + 5, logs.length); j++) {
        const nextLine = logs[j].replace(/^\s*[│╷╵╶─•]*\s*/, "").trim();
        if (nextLine && !nextLine.startsWith("with ") && !nextLine.startsWith("on ")) {
          msg += " " + nextLine;
        } else {
          break;
        }
      }
      return msg.length > 300 ? msg.substring(0, 300) + "..." : msg;
    }
  }
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i].trim();
    if (line.includes("SkuNotAvailable") || line.includes("AuthorizationFailed") || line.includes("403 Forbidden") || line.includes("Capacity Restrictions")) {
      const clean = line.replace(/^\s*[│╷╵╶─•]*\s*/, "").trim();
      return clean.length > 300 ? clean.substring(0, 300) + "..." : clean;
    }
  }
  return fallback;
}

