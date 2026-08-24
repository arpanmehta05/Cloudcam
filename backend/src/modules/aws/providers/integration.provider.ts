import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";
import { SNSClient, ListTopicsCommand } from "@aws-sdk/client-sns";
import {
  KinesisClient,
  ListStreamsCommand,
  DescribeStreamSummaryCommand,
} from "@aws-sdk/client-kinesis";
import { SFNClient, ListStateMachinesCommand } from "@aws-sdk/client-sfn";
import { EventBridgeClient, ListRulesCommand } from "@aws-sdk/client-eventbridge";
import {
  ECRClient,
  DescribeRepositoriesCommand,
  DescribeImagesCommand,
} from "@aws-sdk/client-ecr";
import { shouldLogResourceDiscoveryError } from "./resources.provider";

export async function discoverSQS(cfg: any, region: string): Promise<any[]> {
  const client = new SQSClient(cfg);
  const items: any[] = [];
  try {
    const res = await client.send(new ListQueuesCommand({}));
    res.QueueUrls?.forEach((url) => {
      const name = url.split("/").pop();
      items.push({ name, url, region });
    });
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverSNS(cfg: any, region: string): Promise<any[]> {
  const client = new SNSClient(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(new ListTopicsCommand({ NextToken: nextToken }));
      res.Topics?.forEach((t) => {
        const arn = t.TopicArn || "";
        const name = arn.split(":").pop() || arn;
        items.push({ arn, name, region });
      });
      nextToken = res.NextToken;
    } while (nextToken);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverKinesis(cfg: any, region: string): Promise<any[]> {
  const client = new KinesisClient(cfg);
  const items: any[] = [];
  try {
    const res = await client.send(new ListStreamsCommand({ Limit: 100 }));
    for (const name of res.StreamNames || []) {
      try {
        const desc = await client.send(
          new DescribeStreamSummaryCommand({ StreamName: name }),
        );
        items.push({
          name,
          status: desc.StreamDescriptionSummary?.StreamStatus,
          shardCount: desc.StreamDescriptionSummary?.OpenShardCount,
          region,
        });
      } catch {
        items.push({ name, status: "UNKNOWN", region });
      }
    }
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverStepFunctions(cfg: any, region: string): Promise<any[]> {
  const client = new SFNClient(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new ListStateMachinesCommand({ nextToken, maxResults: 100 }),
      );
      res.stateMachines?.forEach((sm) => {
        items.push({
          name: sm.name,
          arn: sm.stateMachineArn,
          type: sm.type,
          region,
        });
      });
      nextToken = res.nextToken;
    } while (nextToken);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverEventBridge(cfg: any, region: string): Promise<any[]> {
  const client = new EventBridgeClient(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new ListRulesCommand({ NextToken: nextToken, Limit: 100 }),
      );
      res.Rules?.forEach((r) => {
        items.push({
          name: r.Name,
          state: r.State,
          arn: r.Arn,
          region,
        });
      });
      nextToken = res.NextToken;
    } while (nextToken);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ${region} error:`,
        e?.message || e,
      );
    }
  }
  return items;
}

export async function discoverEcr(cfg: any, region: string): Promise<any[]> {
  const client = new ECRClient(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeRepositoriesCommand({ nextToken }),
      );
      const repos = res.repositories || [];
      for (const repo of repos) {
        const name = repo.repositoryName;
        const arn = repo.repositoryArn;
        const uri = repo.repositoryUri;

        let images: any[] = [];
        try {
          const imgRes = await client.send(
            new DescribeImagesCommand({
              repositoryName: name,
              maxResults: 50,
            }),
          );
          images = (imgRes.imageDetails || []).map((img) => ({
            digest: img.imageDigest,
            tags: img.imageTags || [],
            pushedAt: img.imagePushedAt,
            size: img.imageSizeInBytes,
          }));
        } catch (imgErr: any) {
          if (shouldLogResourceDiscoveryError(imgErr)) {
            console.warn(
              `[ResourceDiscovery] ECR images error for repo ${name} in ${region}:`,
              imgErr?.message || imgErr,
            );
          }
        }

        items.push({
          id: name,
          name,
          arn,
          uri,
          region,
          images,
        });
      }
      nextToken = res.nextToken;
    } while (nextToken);
  } catch (e: any) {
    if (shouldLogResourceDiscoveryError(e)) {
      console.warn(
        `[ResourceDiscovery] ECR error in ${region}:`,
        e?.message || e,
      );
    }
  }
  return items;
}
