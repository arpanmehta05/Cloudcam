import { CloudModule } from "@/lib/cloud/setup";

export interface AwsConnectionMeta {
  roleArn: string | null;
  connectedAt: string | null;
  enabledModules?: string[];
}

export interface AzureConnectionMeta {
  tenantId: string | null;
  subscriptionId: string | null;
  billingAccountId: string | null;
  clientId: string | null;
  connectedAt: string | null;
}

export interface GcpConnectionMeta {
  projectId: string | null;
  clientEmail: string | null;
  billingDatasetId: string | null;
  billingTableId: string | null;
  connectedAt: string | null;
}

export interface KeyStatus {
  connected: boolean;
  connectedAt: string | null;
}

export interface KeyStatuses {
  openai: KeyStatus;
  anthropic: KeyStatus;
  gemini: KeyStatus;
  nvidia: KeyStatus;
}

export interface OpenAIBucket {
  object: string;
  start_time: number;
  end_time: number;
  results: Array<{
    input_tokens?: number;
    output_tokens?: number;
    input_cached_tokens?: number;
    num_model_requests?: number;
    model?: string;
    amount?: { value: number; currency: string };
    line_item?: string;
    num_images?: number;
    num_tokens?: number;
  }>;
}

export interface GithubRepo {
  id?: string | number;
  name: string;
  fullName: string;
  owner?: string;
  cloneUrl?: string;
  private?: boolean;
  description?: string | null;
  defaultBranch?: string;
}

export type ReportFrequency = "weekly" | "monthly";

export type ReportType = "usage" | "insight";

export interface PreferenceSet {
  enabled: boolean;
  frequency: ReportFrequency;
  lastSentAt?: string | null;
  nextSendAt?: string | null;
  dayOfWeek: number;
  dayOfMonth: number;
  timeOfDay: string;
  sections: string[];
}

export interface AllPreferences {
  usage: PreferenceSet;
  insight: PreferenceSet;
}
