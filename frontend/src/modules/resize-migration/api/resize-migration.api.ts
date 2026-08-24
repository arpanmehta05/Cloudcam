import { authFetch } from "@/lib/auth-fetch";
import {
  MigrationJob,
  MigrationTask,
  SourceServer,
  TargetSize,
} from "../types";

export const resizeMigrationApi = {
  getJobs: async () => {
    const res = await authFetch("/api/resize-migration/jobs");
    const data = await res.json();
    return data as { success: boolean; jobs?: MigrationJob[]; error?: string };
  },

  getJobDetails: async (jobId: string) => {
    const res = await authFetch(`/api/resize-migration/${jobId}`);
    const data = await res.json();
    return data as {
      success: boolean;
      job: MigrationJob;
      tasks: MigrationTask[];
      error?: string;
    };
  },

  getSources: async (provider: string) => {
    const res = await authFetch(
      `/api/resize-migration/sources?provider=${provider}&region=all`
    );
    const data = await res.json();
    return data as { success: boolean; sources?: SourceServer[]; error?: string };
  },

  getTargetSizes: async (provider: string, region: string, sourceId: string) => {
    const res = await authFetch(
      `/api/resize-migration/target-sizes?provider=${provider}&region=${region}&sourceId=${sourceId}`
    );
    const data = await res.json();
    return data as { success: boolean; targetSizes?: TargetSize[]; error?: string };
  },

  createJobPlan: async (body: any) => {
    const res = await authFetch("/api/resize-migration/plan", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data as { success: boolean; job: MigrationJob; error?: string };
  },

  resumeJob: async (jobId: string) => {
    const res = await authFetch(`/api/resize-migration/${jobId}/resume`, {
      method: "POST",
    });
    const data = await res.json();
    return data as {
      success: boolean;
      job: MigrationJob;
      tasks?: MigrationTask[];
      error?: string;
    };
  },

  downloadReport: async (jobId: string) => {
    const res = await authFetch(`/api/resize-migration/${jobId}/report`);
    if (!res.ok) {
      throw new Error("Failed to download PDF report.");
    }
    return res.blob();
  },

  deleteJob: async (jobId: string) => {
    const res = await authFetch(`/api/resize-migration/${jobId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    return data as { success: boolean; error?: string };
  },

  explainTask: async (jobId: string, taskKey: string) => {
    const res = await authFetch(
      `/api/resize-migration/${jobId}/explain/${taskKey}`
    );
    const data = await res.json();
    return data as {
      success: boolean;
      explanation?: MigrationTask["aiExplanation"];
      error?: string;
    };
  },

  configureAccess: async (jobId: string, body: any) => {
    const res = await authFetch(
      `/api/resize-migration/${jobId}/configure-access`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    return data as { success: boolean; error?: string };
  },

  confirmClassification: async (jobId: string, body: { classification: string; signals: string[]; confidence: string }) => {
    const res = await authFetch(
      `/api/resize-migration/${jobId}/confirm-classification`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    return data as { success: boolean; error?: string };
  },

  transitionStatus: async (jobId: string, nextStatus: string, metadata?: any) => {
    const res = await authFetch(`/api/resize-migration/${jobId}/transition`, {
      method: "POST",
      body: JSON.stringify({ status: nextStatus, metadata }),
    });
    const data = await res.json();
    return data as { success: boolean; error?: string };
  },
};
