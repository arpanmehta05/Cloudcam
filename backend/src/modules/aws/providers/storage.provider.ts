import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3";
import { EC2Client, DescribeVolumesCommand } from "@aws-sdk/client-ec2";
import { EFSClient, DescribeFileSystemsCommand } from "@aws-sdk/client-efs";
import { shouldLogResourceDiscoveryError } from "./resources.provider";

function normalizeS3BucketRegion(locationConstraint?: string): string {
  if (!locationConstraint) return "us-east-1";
  if (locationConstraint === "EU") return "eu-west-1";
  return locationConstraint;
}

export async function discoverS3(cfg: any): Promise<any[]> {
  const client = new S3Client(cfg);
  const res = await client.send(new ListBucketsCommand({}));
  const allBuckets = res.Buckets || [];

  const located = await Promise.allSettled(
    allBuckets.map(async (bucket) => {
      if (!bucket.Name) return null;
      try {
        const loc = await client.send(
          new GetBucketLocationCommand({ Bucket: bucket.Name }),
        );
        const bucketRegion = normalizeS3BucketRegion(loc.LocationConstraint);
        return {
          name: bucket.Name,
          creationDate: bucket.CreationDate,
          region: bucketRegion,
        };
      } catch (err: any) {
        console.warn(
          `[Resources] S3 GetBucketLocation error for ${bucket.Name}: ${err.message}`,
        );
        return {
          name: bucket.Name,
          creationDate: bucket.CreationDate,
          region: "us-east-1",
        };
      }
    }),
  );

  const items: any[] = [];
  for (const r of located) {
    if (r.status === "fulfilled" && r.value) {
      items.push(r.value);
    }
  }
  return items;
}

export async function discoverEBS(cfg: any, region: string): Promise<any[]> {
  const client = new EC2Client(cfg);
  const items: any[] = [];
  let nextToken: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeVolumesCommand({ NextToken: nextToken, MaxResults: 100 }),
      );
      res.Volumes?.forEach((vol) => {
        const tags = vol.Tags || [];
        items.push({
          id: vol.VolumeId,
          name: tags.find((t) => t.Key === "Name")?.Value || vol.VolumeId,
          size: vol.Size,
          type: vol.VolumeType,
          state: vol.State,
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

export async function discoverEFS(cfg: any, region: string): Promise<any[]> {
  const client = new EFSClient(cfg);
  const items: any[] = [];
  let marker: string | undefined;
  try {
    do {
      const res = await client.send(
        new DescribeFileSystemsCommand({ Marker: marker, MaxItems: 100 }),
      );
      res.FileSystems?.forEach((fs) => {
        items.push({
          id: fs.FileSystemId,
          name: fs.Name || fs.FileSystemId,
          sizeBytes: fs.SizeInBytes?.Value || 0,
          state: fs.LifeCycleState,
          region,
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
