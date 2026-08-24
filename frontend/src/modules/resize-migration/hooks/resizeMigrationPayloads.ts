import { MigrationJob, SourceServer } from "../types";

type CloudProvider = MigrationJob["provider"];
type AccessMode = "cloud_only" | "deep_inspection";
type AccessMethod = "ssh" | "ssm";

type CreateJobPlanInput = {
  provider: CloudProvider;
  region: string;
  source: SourceServer | undefined;
  selectedSourceId: string;
  selectedTargetType: string;
  cutoverMode: "manual" | "elastic_ip" | "dns";
  accessMode: AccessMode;
  accessMethod: AccessMethod;
  sshUsername: string;
  sshPort: number;
  sshKey: string;
  isScheduled: boolean;
  scheduledTime: string;
  dnsHostedZoneId: string;
  dnsZoneName: string;
  dnsResourceGroupName: string;
  dnsDomainName: string;
  dnsRecordType: string;
  dnsTtl: number;
};

type AccessConfigurationInput = {
  accessMode: AccessMode;
  accessMethod: AccessMethod;
  sshUsername: string;
  sshPort: number;
  sshKey: string;
};

export function buildCreateJobPlanBody(input: CreateJobPlanInput) {
  const metadata = buildCreateJobMetadata(input);
  const body: Record<string, unknown> = {
    provider: input.provider,
    region: input.region,
    sourceServerId: input.selectedSourceId,
    sourceServerName: input.source?.name,
    sourceServerType: input.source?.type,
    targetServerType: input.selectedTargetType,
    cutoverMode: input.cutoverMode,
    accessMode: input.accessMode,
    metadata,
  };

  if (input.accessMode === "deep_inspection") {
    body.accessConfig = buildAccessConfig(input);
  }

  return body;
}

export function buildAccessConfigurationBody(input: AccessConfigurationInput) {
  const body: Record<string, unknown> = {
    accessMode: input.accessMode,
  };

  if (input.accessMode === "deep_inspection") {
    body.accessConfig = buildAccessConfig(input);
  }

  return body;
}

export function buildClassificationConfirmationBody(
  activeJob: MigrationJob,
  bucket: string
) {
  return {
    classification: bucket,
    signals: activeJob.metadata?.classification?.signals || [],
    confidence: activeJob.metadata?.classification?.confidence || "Medium",
  };
}

function buildCreateJobMetadata(input: CreateJobPlanInput) {
  const metadata: Record<string, unknown> = {};

  if (input.isScheduled && input.scheduledTime) {
    metadata.scheduledExecutionTime = new Date(
      input.scheduledTime
    ).toISOString();
  }

  if (input.cutoverMode === "dns") {
    metadata.dnsConfig =
      input.provider === "aws"
        ? {
            hostedZoneId: input.dnsHostedZoneId,
            domainName: input.dnsDomainName,
            recordType: input.dnsRecordType,
            ttl: Number(input.dnsTtl),
          }
        : {
            zoneName: input.dnsZoneName,
            resourceGroupName: input.dnsResourceGroupName,
            domainName: input.dnsDomainName,
            recordType: input.dnsRecordType,
            ttl: Number(input.dnsTtl),
          };
  }

  return metadata;
}

function buildAccessConfig(input: AccessConfigurationInput) {
  return {
    method: input.accessMethod,
    username: input.sshUsername,
    port: input.sshPort,
    privateKey: input.sshKey,
  };
}
