export interface JobLog {
  message: string;
  level: "info" | "warning" | "error";
  timestamp: string;
}

export interface MigrationTask {
  _id: string;
  key: string;
  title: string;
  description: string;
  status:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "skipped"
    | "retrying";
  order: number;
  startedAt?: string;
  completedAt?: string;
  logs: JobLog[];
  errorCode?: string;
  errorMessage?: string;
  fixSuggestion?: string;
  retryable: boolean;
  fallbackOptions: string[];
  aiExplanation?: {
    explanation: string;
    likelyCause: string;
    remediationSteps: string[];
    alternativeFallback: string;
  };
}

export interface MigrationJob {
  _id: string;
  provider: "aws" | "azure" | "gcp";
  region: string;
  sourceServerId: string;
  sourceServerName?: string;
  sourceServerType?: string;
  targetServerType: string;
  targetServerId?: string;
  targetServerName?: string;
  status: string;
  mode: string;
  cutoverMode: string;
  sourceSnapshotId?: string;
  sourceImageId?: string;
  logs: JobLog[];
  accessMode: "cloud_only" | "deep_inspection";
  accessConfig?: {
    method?: string;
    username?: string;
    port?: number;
  };
  metadata?: {
    classification?: {
      classification: string;
      confidence: "High" | "Medium" | "Low";
      signals: string[];
      confirmed?: boolean;
    };
    stopSourceAfterCutover?: boolean;
    sourceAccessProfile?: {
      keyPairName?: string | null;
      suggestedUsername?: string | null;
      imageId?: string | null;
      imageName?: string | null;
      platformDetails?: string | null;
      hasUserData?: boolean;
    };
    targetAccessProfile?: {
      keyPairName?: string | null;
      reusedSourceKeyPair?: boolean;
      suggestedUsername?: string | null;
      launchedFromImageId?: string | null;
      launchedFromImageName?: string | null;
      platformDetails?: string | null;
      userDataCopied?: boolean;
      publicIp?: string | null;
      privateIp?: string | null;
      publicDnsName?: string | null;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface SourceServer {
  id: string;
  name: string;
  type: string;
  state: string;
  region: string;
  privateIp?: string;
  publicIp?: string;
}

export interface TargetSize {
  instanceType: string;
  vCpu: number;
  memoryGb: number;
  architecture: string;
  category: string;
}

export type ChecklistItem = {
  label: string;
  detail: string;
  state: "done" | "pending" | "undone" | "manual";
};
