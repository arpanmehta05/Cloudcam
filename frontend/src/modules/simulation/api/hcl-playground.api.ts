import { authFetch } from "@/lib/auth-fetch";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    let errMessage = res.statusText;
    try {
      const errData = await res.json();
      if (errData && errData.error) errMessage = errData.error;
    } catch {
      // Ignore
    }
    throw new Error(errMessage || `API error: ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface ParseHclResponse {
  success: boolean;
  nodes: any[];
  edges: any[];
  provider: "aws" | "gcp" | "azure";
  providers?: string[];
}

export interface DeployHclResponse {
  success: boolean;
  deploymentId: string;
  status: string;
  provider: "aws" | "gcp" | "azure";
  region: string;
}

export const hclPlaygroundApi = {
  parseHcl: async (hcl: string): Promise<ParseHclResponse> => {
    return await fetchJson<ParseHclResponse>("/api/simulation/hcl-playground/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hcl }),
    });
  },

  deployHcl: async (hcl: string, region?: string, name?: string): Promise<DeployHclResponse> => {
    return await fetchJson<DeployHclResponse>("/api/simulation/hcl-playground/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hcl, region, name }),
    });
  },
};
