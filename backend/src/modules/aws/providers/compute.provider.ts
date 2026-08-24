import {
  EC2Client,
  DescribeInstancesCommand,
} from "@aws-sdk/client-ec2";
import { LambdaClient, ListFunctionsCommand } from "@aws-sdk/client-lambda";
import {
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import {
  EKSClient,
  ListClustersCommand as EKSListClustersCommand,
  DescribeClusterCommand,
} from "@aws-sdk/client-eks";
import {
  AutoScalingClient,
  DescribeAutoScalingGroupsCommand,
} from "@aws-sdk/client-auto-scaling";
import { AmplifyClient, ListAppsCommand } from "@aws-sdk/client-amplify";
import { shouldLogResourceDiscoveryError } from "./resources.provider";

export async function discoverEc2(cfg: any, region: string): Promise<any[]> {
  const client = new EC2Client(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeInstancesCommand({ NextToken: nextToken }),
      );
      res.Reservations?.forEach((r) => {
        r.Instances?.forEach((inst) => {
          const tags = inst.Tags || [];
          const asgTag = tags.find((t) => t.Key === "aws:autoscaling:groupName");
          const asgName = asgTag?.Value || null;

          const statefulTag = tags.find(
            (t) =>
              t.Key?.toLowerCase() === "stateful" &&
              t.Value?.toLowerCase() === "true",
          );
          const hasLargeEbs = (inst.BlockDeviceMappings || []).some(
            (bdm: any) => bdm.Ebs && (bdm.Ebs.VolumeSize || 0) > 100,
          );
          const isStateful = !!statefulTag || hasLargeEbs;

          const purchaseType =
            inst.InstanceLifecycle === "spot"
              ? "spot"
              : inst.InstanceLifecycle === "scheduled"
                ? "reserved"
                : "on_demand";

          items.push({
            id: inst.InstanceId,
            name: tags.find((t) => t.Key === "Name")?.Value || inst.InstanceId,
            state: inst.State?.Name,
            type: inst.InstanceType,
            region,
            launchTime: inst.LaunchTime,
            asgName,
            isStateful,
            purchaseType,
            publicIp: inst.PublicIpAddress || null,
            keyName: inst.KeyName || null,
          });
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

export async function discoverLambda(cfg: any, region: string): Promise<any[]> {
  const client = new LambdaClient(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new ListFunctionsCommand({ Marker: marker, MaxItems: 100 }),
      );
      res.Functions?.forEach((fn) => {
        items.push({
          name: fn.FunctionName,
          runtime: fn.Runtime,
          memory: fn.MemorySize,
          timeout: fn.Timeout,
          region,
          lastModified: fn.LastModified,
        });
      });
      marker = res.NextMarker;
    } while (marker);
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

export async function discoverEcs(cfg: any, region: string): Promise<any[]> {
  const client = new ECSClient(cfg);
  const items: any[] = [];
  try {
    const clustersRes = await client.send(new ListClustersCommand({}));
    const clusterArns = clustersRes.clusterArns || [];

    for (const clusterArn of clusterArns) {
      const clusterName = clusterArn.split("/").pop() || clusterArn;
      let serviceArns: string[] = [];
      let svcToken: string | undefined;
      do {
        const res = await client.send(
          new ListServicesCommand({ cluster: clusterArn, nextToken: svcToken }),
        );
        if (res.serviceArns) serviceArns.push(...res.serviceArns);
        svcToken = res.nextToken;
      } while (svcToken);

      if (serviceArns.length === 0) {
        items.push({
          cluster: clusterName,
          name: clusterName,
          status: "ACTIVE",
          type: "Cluster",
          region,
        });
        continue;
      }

      for (let i = 0; i < serviceArns.length; i += 10) {
        const batch = serviceArns.slice(i, i + 10);
        const desc = await client.send(
          new DescribeServicesCommand({ cluster: clusterArn, services: batch }),
        );
        desc.services?.forEach((svc) => {
          items.push({
            id: svc.serviceArn,
            cluster: clusterName,
            name: svc.serviceName,
            status: svc.status,
            region,
          });
        });
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

export async function discoverEKS(cfg: any, region: string): Promise<any[]> {
  const client = new EKSClient(cfg);
  const items: any[] = [];
  try {
    const res = await client.send(new EKSListClustersCommand({}));
    for (const name of res.clusters || []) {
      try {
        const desc = await client.send(new DescribeClusterCommand({ name }));
        items.push({
          name,
          status: desc.cluster?.status,
          version: desc.cluster?.version,
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

export async function discoverAutoScaling(cfg: any, region: string): Promise<any[]> {
  const client = new AutoScalingClient(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeAutoScalingGroupsCommand({
          NextToken: nextToken,
          MaxRecords: 100,
        }),
      );
      res.AutoScalingGroups?.forEach((asg) => {
        items.push({
          name: asg.AutoScalingGroupName,
          desired: asg.DesiredCapacity,
          min: asg.MinSize,
          max: asg.MaxSize,
          instances: asg.Instances?.length || 0,
          status: "ACTIVE",
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

export async function discoverAmplify(cfg: any, region: string): Promise<any[]> {
  const client = new AmplifyClient(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new ListAppsCommand({ nextToken, maxResults: 100 }),
      );
      res.apps?.forEach((app) => {
        items.push({ id: app.appId, name: app.name, region });
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
