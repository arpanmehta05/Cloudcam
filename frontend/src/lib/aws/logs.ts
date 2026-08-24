// AWS CloudWatch Logs Insights Helpers
import {
    CloudWatchLogsClient,
    StartQueryCommand,
    GetQueryResultsCommand,
    DescribeLogGroupsCommand,
    QueryStatus
} from "@aws-sdk/client-cloudwatch-logs";
import { getClientConfig, DEFAULT_REGION } from "./client-factory";

export interface LogQueryResult {
    timestamp: string;
    message: string;
    [key: string]: string;
}

/**
 * Run a CloudWatch Logs Insights query and wait for results.
 * 
 * @param query - The Insights query string (e.g., "fields @timestamp, @message | sort @timestamp desc | limit 20")
 * @param logGroupNames - Array of log group names to search
 * @param timeRangeSeconds - How far back to search
 */
export async function queryLogs(
    workspaceId: string,
    query: string,
    logGroupNames: string[],
    timeRangeSeconds: number = 3600,
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
): Promise<LogQueryResult[]> {
    const config = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new CloudWatchLogsClient(config);

    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - timeRangeSeconds;

    // 1. Start the query
    const startCommand = new StartQueryCommand({
        logGroupNames,
        queryString: query,
        startTime,
        endTime,
        limit: 100
    });

    const { queryId } = await client.send(startCommand);
    if (!queryId) throw new Error("Failed to start log query");

    // 2. Poll for results (max 10 retries)
    let results: any[] = [];
    let status: QueryStatus | string = QueryStatus.Scheduled;

    for (let i = 0; i < 10; i++) {
        // Wait 1s between polls
        await new Promise(resolve => setTimeout(resolve, 1500));

        const getResultsCommand = new GetQueryResultsCommand({ queryId });
        const response = await client.send(getResultsCommand);

        status = response.status || QueryStatus.Unknown;

        if (status === QueryStatus.Complete) {
            results = response.results || [];
            break;
        } else if (status === QueryStatus.Failed || status === QueryStatus.Cancelled) {
            throw new Error(`Log query ${status.toLowerCase()}`);
        }
    }

    // 3. Transform complex AWS result format into simple objects
    return results.map(fields => {
        const item: LogQueryResult = { timestamp: "", message: "" };
        fields.forEach((f: any) => {
            if (f.field === "@timestamp") item.timestamp = f.value;
            else if (f.field === "@message") item.message = f.value;
            else if (f.field) item[f.field.replace("@", "")] = f.value;
        });
        return item;
    });
}

/**
 * Get the most active log groups in the account.
 */
export async function listActiveLogGroups(
    workspaceId: string,
    region: string = DEFAULT_REGION,
    roleArn?: string,
    externalId?: string
) {
    const config = await getClientConfig(workspaceId, region, roleArn, externalId);
    const client = new CloudWatchLogsClient(config);

    const command = new DescribeLogGroupsCommand({ limit: 50 });
    const response = await client.send(command);

    return response.logGroups?.map(lg => ({
        name: lg.logGroupName,
        storedBytes: lg.storedBytes,
        retention: lg.retentionInDays,
        updated: lg.creationTime
    })) || [];
}
