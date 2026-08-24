import { fetchMetrics } from "../../providers/cloudwatch.provider";
import { CloudWatchMetricQuery } from "../../../../models/metrics.model";
import { getResources } from "../resources/resources.service";
import { S3_SIZE_STORAGE_TYPES, aggregateTimeSeries } from "./s3-aggregator";

export async function getS3Metrics(
  workspaceId: string,
  range: string,
  region?: string,
  roleArn?: string,
  externalId?: string,
  forceRefresh: boolean = false
) {
  const inventory = await getResources(workspaceId, region, roleArn, externalId, forceRefresh);
  const bucketNames: string[] = Array.from(new Set(inventory.s3.map((b: any) => b.name).filter(Boolean)));

  if (bucketNames.length === 0) {
    return {
      service: "s3",
      metrics: {
        size: { displayName: "BucketSizeBytes", unit: "bytes", data: [] },
        objects: { displayName: "NumberOfObjects", unit: "count", data: [] },
      },
      buckets: [],
    };
  }

  const queries: CloudWatchMetricQuery[] = [];
  const bucketQueryMap: { bucket: string; metricName: string; storageType?: string; index: number }[] = [];

  for (const bucket of bucketNames) {
    for (const storageType of S3_SIZE_STORAGE_TYPES) {
      queries.push({
        namespace: "AWS/S3",
        metricName: "BucketSizeBytes",
        stat: "Average",
        dimensions: [
          { Name: "BucketName", Value: bucket },
          { Name: "StorageType", Value: storageType },
        ],
        period: 86400,
      });
      bucketQueryMap.push({ bucket, metricName: "size", storageType, index: queries.length - 1 });
    }

    queries.push({
      namespace: "AWS/S3",
      metricName: "NumberOfObjects",
      stat: "Average",
      dimensions: [
        { Name: "BucketName", Value: bucket },
        { Name: "StorageType", Value: "AllStorageTypes" },
      ],
      period: 86400,
    });
    bucketQueryMap.push({ bucket, metricName: "objects", index: queries.length - 1 });
  }

  const s3Range = range === "1h" || range === "6h" || range === "24h" ? "7d" : range;

  // S3 metrics are global — query from us-east-1
  let allResults: any[] = [];
  const BATCH_SIZE = 480;
  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const batchResults = await fetchMetrics(workspaceId, batch, s3Range, "us-east-1", roleArn, externalId);
    allResults.push(...batchResults);
  }

  const bucketData: Record<string, { sizeBytes: number; objectCount: number }> = {};

  for (const entry of bucketQueryMap) {
    const series = allResults[entry.index];
    const latestValue = series?.datapoints?.length
      ? series.datapoints[series.datapoints.length - 1].value
      : 0;

    if (!bucketData[entry.bucket]) {
      bucketData[entry.bucket] = { sizeBytes: 0, objectCount: 0 };
    }

    if (entry.metricName === "size") {
      bucketData[entry.bucket].sizeBytes += latestValue;
    } else {
      bucketData[entry.bucket].objectCount = latestValue;
    }
  }

  const buckets = Object.entries(bucketData)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes);

  const totalSize = buckets.reduce((sum, b) => sum + (b.sizeBytes || 0), 0);
  const totalObjects = buckets.reduce((sum, b) => sum + (b.objectCount || 0), 0);

  const sizeIndices = bucketQueryMap.filter((e) => e.metricName === "size").map((e) => e.index);
  const objectIndices = bucketQueryMap.filter((e) => e.metricName === "objects").map((e) => e.index);

  return {
    service: "s3",
    metrics: {
      size: { displayName: "BucketSizeBytes", unit: "bytes", data: aggregateTimeSeries(allResults, sizeIndices) },
      objects: { displayName: "NumberOfObjects", unit: "count", data: aggregateTimeSeries(allResults, objectIndices) },
    },
    buckets,
    summary: { totalBuckets: bucketNames.length, totalSizeBytes: totalSize, totalObjects },
  };
}
