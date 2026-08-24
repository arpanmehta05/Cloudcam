// AWS CloudWatch Logs Provider
import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  DescribeLogGroupsCommand,
  QueryStatus,
} from "@aws-sdk/client-cloudwatch-logs";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";
import { LogQueryResult } from "../models/aws.model";

export async function queryLogs(
  workspaceId: string,
  query: string,
  logGroupNames: string[],
  timeRangeSeconds: number = 3600,
  region: string = DEFAULT_REGION,
  roleArn?: string,
  externalId?: string,
): Promise<LogQueryResult[]> {
  const clientConfig = await getClientConfig(
    workspaceId,
    region,
    roleArn,
    externalId,
  );
  const client = new CloudWatchLogsClient(clientConfig);

  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - timeRangeSeconds;

  const { queryId } = await client.send(
    new StartQueryCommand({
      logGroupNames,
      queryString: query,
      startTime,
      endTime,
      limit: 100,
    }),
  );
  if (!queryId) throw new Error("Failed to start log query");

  let results: any[] = [];
  let isComplete = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await client.send(new GetQueryResultsCommand({ queryId }));
    const status = response.status || QueryStatus.Unknown;

    if (response.results && response.results.length > 0) {
      results = response.results;
    }

    if (status === QueryStatus.Complete) {
      isComplete = true;
      break;
    }
    if (status === QueryStatus.Failed || status === QueryStatus.Cancelled) {
      throw new Error(`Log query ${status.toLowerCase()}`);
    }
  }

  if (!isComplete && results.length === 0) {
    console.warn(
      `[Logs] Query ${queryId} timed out after 30s. Returning empty.`,
    );
  } else if (!isComplete) {
    console.log(
      `[Logs] Query ${queryId} timed out after 30s, returning ${results.length} partial results.`,
    );
  }

  return results.map((fields) => {
    const item: LogQueryResult = { timestamp: "", message: "" };
    fields.forEach((f: any) => {
      if (f.field === "@timestamp") item.timestamp = f.value;
      else if (f.field === "@message") item.message = f.value;
      else if (f.field) item[f.field.replace("@", "")] = f.value;
    });
    return item;
  });
}

export async function listActiveLogGroups(
  workspaceId: string,
  region: string = DEFAULT_REGION,
  roleArn?: string,
  externalId?: string,
) {
  const clientConfig = await getClientConfig(
    workspaceId,
    region,
    roleArn,
    externalId,
  );
  const client = new CloudWatchLogsClient(clientConfig);
  const response = await client.send(new DescribeLogGroupsCommand({ limit: 50 }));
  return (
    response.logGroups?.map((lg) => ({
      name: lg.logGroupName,
      storedBytes: lg.storedBytes,
      retention: lg.retentionInDays,
      updated: lg.creationTime,
    })) || []
  );
}

export async function describeLogGroupsByPrefix(
  workspaceId: string,
  prefix: string,
  region: string = DEFAULT_REGION,
  roleArn?: string,
  externalId?: string,
): Promise<string[]> {
  const clientConfig = await getClientConfig(
    workspaceId,
    region,
    roleArn,
    externalId,
  );
  const client = new CloudWatchLogsClient(clientConfig);
  try {
    const response = await client.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: prefix,
        limit: 50,
      }),
    );
    return (response.logGroups || []).map((lg) => lg.logGroupName!).filter(Boolean);
  } catch {
    return [];
  }
}
