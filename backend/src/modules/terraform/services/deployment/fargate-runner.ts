import { ECSClient, RunTaskCommand, DescribeTasksCommand, StopTaskCommand } from "@aws-sdk/client-ecs";
import { CloudWatchLogsClient, GetLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { GetObjectCommand, PutObjectCommand, S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../../../../config/env";
import { ContainerInfo } from "../container-manager";

const ecsClient = new ECSClient({ region: config.fargate.region });
const cwClient = new CloudWatchLogsClient({ region: config.fargate.region });
const s3Client = new S3Client({ region: config.fargate.region });
const fargateArtifacts = new Map<string, { outputsKey: string; stateKey: string; bucket: string }>();
const FARGATE_LOG_POLL_MS = 2000;

export function isFargateMode(): boolean {
  return config.isProduction || config.fargate.useEcs;
}

async function streamToString(body: any): Promise<string> {
  if (!body) return "";
  if (typeof body.transformToString === "function") return body.transformToString();

  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function getS3Json(bucket: string, key: string): Promise<any | null> {
  try {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    const raw = await streamToString(result.Body);
    return raw ? JSON.parse(raw) : null;
  } catch (err: any) {
    const code = err?.name || err?.Code || err?.code || "UnknownError";
    if (code !== "NoSuchKey" && code !== "NotFound" && code !== "NoSuchBucket") {
      console.error(`[fargate] Failed to read artifact s3://${bucket}/${key}: ${err?.message || code}`);
    }
    return null;
  }
}

async function resolveFargateKey(
  bucket: string,
  defaultKey: string,
  fileName: "outputs.json" | "state.json"
): Promise<string> {
  const lastSlashIndex = defaultKey.lastIndexOf("/");
  if (lastSlashIndex === -1) return defaultKey;
  const parentPrefix = defaultKey.substring(0, lastSlashIndex + 1);

  try {
    const listResult = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: parentPrefix,
    }));

    if (listResult.Contents && listResult.Contents.length > 0) {
      const directMatch = listResult.Contents.find(item => item.Key === defaultKey);
      if (directMatch && directMatch.Key) {
        return directMatch.Key;
      }

      const matches = listResult.Contents
        .filter(item => item.Key && item.Key.endsWith(`/${fileName}`))
        .map(item => item.Key as string);

      if (matches.length > 0) {
        if (matches.length === 1) {
          return matches[0];
        }
        const itemsWithDate = listResult.Contents
          .filter(item => item.Key && item.Key.endsWith(`/${fileName}`))
          .map(item => ({
            key: item.Key as string,
            lastModified: item.LastModified ? new Date(item.LastModified).getTime() : 0
          }));
        itemsWithDate.sort((a, b) => b.lastModified - a.lastModified);
        return itemsWithDate[0].key;
      }
    }
  } catch (err: any) {
    console.error(`[fargate] Failed to list S3 objects in bucket ${bucket} for prefix ${parentPrefix}:`, err.message);
  }

  return defaultKey;
}

async function createFargateArtifacts(deploymentId: string, hcl: string, state: any, bucket: string): Promise<{
  payloadUrl: string;
  outputsPutUrl: string;
  statePutUrl: string;
  outputsKey: string;
  stateKey: string;
}> {
  if (!bucket) {
    throw new Error("FARGATE_ARTIFACT_BUCKET (or FARGATE_GCP_ARTIFACT_BUCKET for GCP) is required to pass Terraform payloads to Fargate.");
  }

  const safeDeploymentId = deploymentId.replace(/[^a-zA-Z0-9-]/g, "");
  const prefix = `${config.fargate.artifactPrefix}/${safeDeploymentId}`;
  const payloadKey = `${prefix}/payload.json`;
  const outputsKey = `${prefix}/outputs.json`;
  const stateKey = `${prefix}/state.json`;

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: payloadKey,
    Body: JSON.stringify({ hcl, state: state || null }),
    ContentType: "application/json",
  }));

  const expiresIn = 60 * 60;
  return {
    payloadUrl: await getSignedUrl(s3Client, new GetObjectCommand({
      Bucket: bucket,
      Key: payloadKey,
    }), { expiresIn }),
    outputsPutUrl: await getSignedUrl(s3Client, new PutObjectCommand({
      Bucket: bucket,
      Key: outputsKey,
      ContentType: "application/json",
    }), { expiresIn }),
    statePutUrl: await getSignedUrl(s3Client, new PutObjectCommand({
      Bucket: bucket,
      Key: stateKey,
      ContentType: "application/json",
    }), { expiresIn }),
    outputsKey,
    stateKey,
  };
}

function createRunnerEnvironment(
  deploymentId: string,
  artifacts: { payloadUrl: string; outputsPutUrl: string; statePutUrl: string },
  hcl: string,
  state: any,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsSessionToken: string,
  region: string,
  action: "apply" | "destroy" | "plan",
  provider?: "aws" | "azure" | "gcp",
  azure?: { clientId: string; clientSecret: string; tenantId: string; subscriptionId: string },
  gcp?: { projectId: string; clientEmail: string; privateKey: string }
): Array<{ name: string; value: string }> {
  const environment = [
    { name: "TF_RUN_ID", value: deploymentId },
    { name: "TF_ACTION", value: action },
    { name: "TF_PAYLOAD_URL", value: artifacts.payloadUrl },
    { name: "TF_OUTPUTS_PUT_URL", value: artifacts.outputsPutUrl },
    { name: "TF_STATE_PUT_URL", value: artifacts.statePutUrl },
  ];

  if (provider === "azure" && azure) {
    environment.push(
      { name: "ARM_CLIENT_ID", value: azure.clientId },
      { name: "ARM_CLIENT_SECRET", value: azure.clientSecret },
      { name: "ARM_TENANT_ID", value: azure.tenantId },
      { name: "ARM_SUBSCRIPTION_ID", value: azure.subscriptionId }
    );
  } else if (provider === "gcp" && gcp) {
    environment.push(
      { name: "GOOGLE_PROJECT", value: gcp.projectId },
      { name: "GOOGLE_CREDENTIALS", value: JSON.stringify({
        type: "service_account",
        project_id: gcp.projectId,
        client_email: gcp.clientEmail,
        private_key: gcp.privateKey,
      }) }
    );
  } else {
    environment.push(
      { name: "AWS_ACCESS_KEY_ID", value: awsAccessKeyId },
      { name: "AWS_SECRET_ACCESS_KEY", value: awsSecretAccessKey },
      { name: "AWS_SESSION_TOKEN", value: awsSessionToken || "" },
      { name: "AWS_DEFAULT_REGION", value: region }
    );
  }

  return environment;
}

export async function startFargateTask(
  deploymentId: string,
  hcl: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsSessionToken: string,
  region: string,
  options: any
): Promise<ContainerInfo> {
  console.log(`[fargate] Starting task for deployment ${deploymentId}`);
  const artifactBucket = options.provider === "gcp"
    ? config.fargate.gcpArtifactBucket
    : config.fargate.artifactBucket;
  console.log(`[fargate] Using artifact bucket: ${artifactBucket} (provider: ${options.provider || "aws"})`);

  const artifacts = await createFargateArtifacts(deploymentId, hcl, options.state, artifactBucket);
  const action = options.action || "apply";
  const environment = createRunnerEnvironment(
    deploymentId,
    artifacts,
    hcl,
    options.state,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsSessionToken,
    region,
    action,
    options.provider,
    options.azure,
    options.gcp
  );

  const resolvedTaskDef = options.provider === "gcp"
    ? config.fargate.gcpTaskDefinition
    : config.fargate.taskDefinition;

  console.log(`[fargate] Using task definition: ${resolvedTaskDef} (provider: ${options.provider || "aws"})`);

  const command = new RunTaskCommand({
    cluster: config.fargate.cluster,
    taskDefinition: resolvedTaskDef,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: config.fargate.subnets,
        securityGroups: config.fargate.securityGroups,
        assignPublicIp: config.fargate.assignPublicIp ? "ENABLED" : "DISABLED",
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: config.fargate.containerName,
          environment,
        },
      ],
    },
  });

  const response = await ecsClient.send(command);
  if (!response.tasks || response.tasks.length === 0) {
    const reason = response.failures?.map(failure => `${failure.arn || failure.reason}: ${failure.detail || failure.reason}`).join("; ");
    throw new Error(`Failed to start Fargate task${reason ? `: ${reason}` : ""}`);
  }

  const taskArn = response.tasks[0].taskArn!;
  fargateArtifacts.set(taskArn, {
    outputsKey: artifacts.outputsKey,
    stateKey: artifacts.stateKey,
    bucket: artifactBucket,
  });
  console.log(`[fargate] Started task ${taskArn} for deployment ${deploymentId}`);
  return { containerId: taskArn, name: taskArn, isFargate: true };
}

export async function stopFargateTask(containerId: string): Promise<void> {
  await ecsClient.send(new StopTaskCommand({
    cluster: config.fargate.cluster,
    task: containerId,
    reason: "User requested stop"
  }));
}

export async function getFargateTaskStatus(containerId: string): Promise<string> {
  try {
    const res = await ecsClient.send(new DescribeTasksCommand({
      cluster: config.fargate.cluster,
      tasks: [containerId]
    }));
    return res.tasks?.[0]?.lastStatus || "gone";
  } catch {
    return "gone";
  }
}

export async function getFargateTaskExitCode(containerId: string): Promise<number> {
  try {
    const res = await ecsClient.send(new DescribeTasksCommand({
      cluster: config.fargate.cluster,
      tasks: [containerId]
    }));
    return res.tasks?.[0]?.containers?.[0]?.exitCode ?? -1;
  } catch {
    return -1;
  }
}

export async function getFargateTaskLogs(containerId: string): Promise<string[]> {
  const taskId = containerId.split("/").pop();
  try {
    const result = await cwClient.send(new GetLogEventsCommand({
      logGroupName: config.fargate.logGroup,
      logStreamName: `${config.fargate.logStreamPrefix}/${config.fargate.containerName}/${taskId}`,
      startFromHead: true
    }));
    const seen = new Set<string>();
    return (result.events || [])
      .map(e => (e.message || "").trim())
      .filter(line => {
        if (!line || seen.has(line)) return false;
        seen.add(line);
        return true;
      });
  } catch (err: any) {
    if (err.name !== "ResourceNotFoundException") {
      console.error(`[fargate] Failed to read CloudWatch logs for ${containerId}:`, err.message);
    }
    return [];
  }
}

export async function getFargateOutputs(
  containerId: string,
  deploymentId?: string,
  provider?: "aws" | "azure" | "gcp",
  parseMarkedJsonCallback?: (logs: string[], start: string, end: string) => any
): Promise<any> {
  const keys = fargateArtifacts.get(containerId);
  let bucket = keys?.bucket;
  let outputsKey = keys?.outputsKey;

  if (!keys && deploymentId) {
    bucket = provider === "gcp" ? config.fargate.gcpArtifactBucket : config.fargate.artifactBucket;
    const safeDeploymentId = deploymentId.replace(/[^a-zA-Z0-9-]/g, "");
    outputsKey = `${config.fargate.artifactPrefix}/${safeDeploymentId}/outputs.json`;
  }

  if (bucket && outputsKey) {
    const resolvedKey = await resolveFargateKey(bucket, outputsKey, "outputs.json");
    const outputs = await getS3Json(bucket, resolvedKey);
    if (outputs) return outputs;
  }

  if (parseMarkedJsonCallback) {
    try {
      return parseMarkedJsonCallback(await getFargateTaskLogs(containerId), "---BEGIN-OUTPUTS---", "---END-OUTPUTS---") || {};
    } catch (err: any) {
      console.error(`[fargate] Failed to parse outputs from logs for ${containerId}:`, err.message);
    }
  }
  return {};
}

export async function getFargateState(
  containerId: string,
  deploymentId?: string,
  provider?: "aws" | "azure" | "gcp",
  parseMarkedJsonCallback?: (logs: string[], start: string, end: string) => any
): Promise<any> {
  const keys = fargateArtifacts.get(containerId);
  let bucket = keys?.bucket;
  let stateKey = keys?.stateKey;

  if (!keys && deploymentId) {
    bucket = provider === "gcp" ? config.fargate.gcpArtifactBucket : config.fargate.artifactBucket;
    const safeDeploymentId = deploymentId.replace(/[^a-zA-Z0-9-]/g, "");
    stateKey = `${config.fargate.artifactPrefix}/${safeDeploymentId}/state.json`;
  }

  if (bucket && stateKey) {
    const resolvedKey = await resolveFargateKey(bucket, stateKey, "state.json");
    const state = await getS3Json(bucket, resolvedKey);
    if (state) return state;
  }

  if (parseMarkedJsonCallback) {
    try {
      return parseMarkedJsonCallback(await getFargateTaskLogs(containerId), "---BEGIN-STATE---", "---END-STATE---");
    } catch (err: any) {
      console.error(`[fargate] Failed to parse state from logs for ${containerId}:`, err.message);
    }
  }
  return null;
}

export function streamFargateLogs(
  containerId: string,
  onLine: (line: string, source: "stdout" | "stderr") => void,
  onEnd: () => void,
  onError: (err: Error) => void,
  getStatusCallback: (id: string) => Promise<string>,
  isTerminalStatusCallback: (status: string) => boolean
): () => void {
  let isStopped = false;
  const taskId = containerId.split("/").pop();
  const logGroupName = config.fargate.logGroup;
  const logStreamName = `${config.fargate.logStreamPrefix}/${config.fargate.containerName}/${taskId}`;
  let nextToken: string | undefined;
  const seenEvents = new Set<string>();
  let endEmitted = false;

  const poll = async () => {
    while (!isStopped) {
      try {
        const result = await cwClient.send(new GetLogEventsCommand({
          logGroupName,
          logStreamName,
          startFromHead: true,
          nextToken
        }));
        
        if (result.events) {
          for (const event of result.events) {
            const message = (event.message || "").trim();
            if (!message) continue;
            const eventKey = `${event.timestamp || ""}:${event.ingestionTime || ""}:${message}`;
            if (seenEvents.has(eventKey)) continue;
            seenEvents.add(eventKey);
            onLine(message, "stdout");
          }
        }

        const status = await getStatusCallback(containerId);
        if (isTerminalStatusCallback(status)) {
          if (!endEmitted) {
            endEmitted = true;
            onEnd();
          }
          break;
        }

        if (result.nextForwardToken && result.nextForwardToken !== nextToken) {
          nextToken = result.nextForwardToken;
        }
        
        await new Promise(r => setTimeout(r, FARGATE_LOG_POLL_MS));
      } catch (err: any) {
        if (err.name === "ResourceNotFoundException") {
          await new Promise(r => setTimeout(r, FARGATE_LOG_POLL_MS));
          continue;
        }
        onError(err);
        break;
      }
    }
  };
  poll();
  return () => { isStopped = true; };
}
