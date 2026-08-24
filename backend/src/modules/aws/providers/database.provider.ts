import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBSnapshotsCommand,
} from "@aws-sdk/client-rds";
import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import {
  ElastiCacheClient,
  DescribeCacheClustersCommand,
} from "@aws-sdk/client-elasticache";
import {
  RedshiftClient,
  DescribeClustersCommand as RedshiftDescribeClustersCommand,
} from "@aws-sdk/client-redshift";
import { shouldLogResourceDiscoveryError } from "./resources.provider";

export async function discoverRds(cfg: any, region: string): Promise<any[]> {
  const client = new RDSClient(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeDBInstancesCommand({ Marker: marker, MaxRecords: 100 }),
      );
      res.DBInstances?.forEach((db) => {
        items.push({
          id: db.DBInstanceIdentifier,
          engine: db.Engine,
          status: db.DBInstanceStatus,
          class: db.DBInstanceClass,
          region,
        });
      });
      marker = res.Marker;
    } while (marker);

    // Discover orphaned/stale snapshots
    marker = undefined;
    do {
      const snapRes: any = await client.send(
        new DescribeDBSnapshotsCommand({ Marker: marker, MaxRecords: 100 }),
      );
      snapRes.DBSnapshots?.forEach((snap: any) => {
        items.push({
          id: snap.DBSnapshotIdentifier,
          type: "snapshot",
          engine: snap.Engine,
          status: snap.Status,
          allocatedStorage: snap.AllocatedStorage,
          snapshotCreateTime: snap.SnapshotCreateTime,
          region,
        });
      });
      marker = snapRes.Marker;
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

export async function discoverDynamoDB(cfg: any, region: string): Promise<any[]> {
  const client = new DynamoDBClient(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new ListTablesCommand({ ExclusiveStartTableName: nextToken }),
      );
      res.TableNames?.forEach((name) => items.push({ name, region }));
      nextToken = res.LastEvaluatedTableName;
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

export async function discoverElastiCache(cfg: any, region: string): Promise<any[]> {
  const client = new ElastiCacheClient(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeCacheClustersCommand({ Marker: marker, MaxRecords: 100 }),
      );
      res.CacheClusters?.forEach((c) => {
        items.push({
          id: c.CacheClusterId,
          engine: c.Engine,
          nodeType: c.CacheNodeType,
          status: c.CacheClusterStatus,
          numNodes: c.NumCacheNodes,
          region,
        });
      });
      marker = res.Marker;
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

export async function discoverRedshift(cfg: any, region: string): Promise<any[]> {
  const client = new RedshiftClient(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new RedshiftDescribeClustersCommand({ Marker: marker, MaxRecords: 100 }),
      );
      res.Clusters?.forEach((c) => {
        items.push({
          id: c.ClusterIdentifier,
          nodeType: c.NodeType,
          status: c.ClusterStatus,
          numNodes: c.NumberOfNodes,
          region,
        });
      });
      marker = res.Marker;
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
