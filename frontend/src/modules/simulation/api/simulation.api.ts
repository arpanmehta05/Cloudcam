// ─── Simulation API Client ───
// Consolidates all simulation session, draft, deployment, and GitHub integration endpoints.

import { authFetch } from "@/lib/auth-fetch";

// Helper fetch wrapper
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await authFetch(url, options);
  if (!res.ok) {
    let errMessage = res.statusText;
    try {
      const errData = await res.json();
      if (errData && errData.message) errMessage = errData.message;
    } catch {
      // Ignore
    }
    throw new Error(errMessage || `API error: ${res.status}`);
  }
  const data = await res.json();
  return data as T;
}

export interface SimulationResponse {
  id: string;
  status: "provisioning" | "ready" | "error" | "timed_out" | "terminated";
  orchestrator?: string;
  steps?: Array<{ label: string; status: "pending" | "running" | "done" | "failed" }>;
}

export interface PersistentSimulation {
  _id: string;
  name: string;
  status: "active" | "destroyed" | "failed";
  provider?: "aws" | "azure" | "gcp";
  region: string;
  hasPrivateKey?: boolean;
  graph?: {
    nodes: any[];
    edges: any[];
  };
  deployments?: Array<{
    deploymentId: string;
    label: string;
    status: "active" | "destroyed" | "failed";
    provider?: "aws" | "azure" | "gcp";
    region: string;
    createdAt: string;
    destroyedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const simulationApi = {
  // ─── Simulation Draft CRUD ───
  listSimulations: async (): Promise<PersistentSimulation[]> => {
    const data = await fetchJson<{ success: boolean; simulations: PersistentSimulation[] }>("/api/simulations");
    return data.simulations || [];
  },

  getSimulation: async (id: string): Promise<PersistentSimulation> => {
    const data = await fetchJson<{ success: boolean; simulation: PersistentSimulation }>(`/api/simulations/${id}`);
    return data.simulation;
  },

  createSimulation: async (payload: any): Promise<PersistentSimulation> => {
    const data = await fetchJson<{ success: boolean; simulation: PersistentSimulation }>("/api/simulations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data.simulation;
  },

  updateSimulation: async (id: string, payload: any): Promise<PersistentSimulation> => {
    const data = await fetchJson<{ success: boolean; simulation: PersistentSimulation }>(`/api/simulations/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return data.simulation;
  },

  deleteSimulation: async (id: string): Promise<void> => {
    await fetchJson(`/api/simulations/${id}`, { method: "DELETE" });
  },

  destroySimulation: async (id: string, credentials: any): Promise<{ success: boolean; sessionId: string }> => {
    return await fetchJson<{ success: boolean; sessionId: string }>(`/api/simulations/${id}/destroy`, {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  // ─── Live Simulation Session ───
  createSession: async (): Promise<SimulationResponse> => {
    return await fetchJson<SimulationResponse>("/api/simulation/session", { method: "POST" });
  },

  getSession: async (sessionId: string): Promise<SimulationResponse> => {
    return await fetchJson<SimulationResponse>(`/api/simulation/session/${sessionId}`);
  },

  terminateSession: async (sessionId: string): Promise<void> => {
    await fetchJson(`/api/simulation/session/${sessionId}/terminate`, { method: "POST" });
  },

  // ─── Estimation & Code Generation ───
  estimateCost: async (payload: any): Promise<{ success: boolean; monthlyCost: number; hourlyCost: number; breakdown: any }> => {
    return await fetchJson<{ success: boolean; monthlyCost: number; hourlyCost: number; breakdown: any }>("/api/simulation/cost/estimate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  generateTerraform: async (payload: any): Promise<{ success: boolean; tfCode: string }> => {
    return await fetchJson<{ success: boolean; tfCode: string }>("/api/simulation/terraform", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // ─── Deployment Pipeline ───
  startDeployment: async (payload: any): Promise<{ success: boolean; deploymentId: string }> => {
    return await fetchJson<{ success: boolean; deploymentId: string }>("/api/deployment/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  validateCredentials: async (payload: any): Promise<{ success: boolean; error?: string }> => {
    return await fetchJson<{ success: boolean; error?: string }>("/api/deployment/validate-creds", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  runDeployment: async (deploymentId: string, payload: any): Promise<{ success: boolean }> => {
    return await fetchJson<{ success: boolean }>(`/api/deployment/${deploymentId}/run`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  resumeDeployment: async (deploymentId: string, payload: any): Promise<{ success: boolean }> => {
    return await fetchJson<{ success: boolean }>(`/api/deployment/${deploymentId}/resume`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getDeploymentStatus: async (deploymentId: string): Promise<any> => {
    return await fetchJson<any>(`/api/deployment/${deploymentId}/status`);
  },

  cancelDeployment: async (deploymentId: string): Promise<{ success: boolean }> => {
    return await fetchJson<{ success: boolean }>(`/api/deployment/${deploymentId}/cancel`);
  },

  // ─── GitHub Integrations ───
  getGithubStatus: async (): Promise<{ success: boolean; connected: boolean }> => {
    return await fetchJson<{ success: boolean; connected: boolean }>("/api/github/status");
  },

  getGithubRepos: async (): Promise<{ success: boolean; repos: any[] }> => {
    return await fetchJson<{ success: boolean; repos: any[] }>("/api/github/repos");
  },

  getGithubBranches: async (repoName: string): Promise<{ success: boolean; branches: any[] }> => {
    return await fetchJson<{ success: boolean; branches: any[] }>(`/api/github/branches?repo=${encodeURIComponent(repoName)}`);
  },

  disconnectGithub: async (): Promise<{ success: boolean }> => {
    return await fetchJson<{ success: boolean }>("/api/github/disconnect", { method: "POST" });
  },
};
