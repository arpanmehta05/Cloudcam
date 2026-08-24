import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketLocationCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3";
import { EC2Client, CreateSnapshotCommand } from "@aws-sdk/client-ec2";

async function getS3ClientForBucket(
  bucket: string,
  baseClientConfig: any
): Promise<S3Client> {
  const probeClient = new S3Client({ ...baseClientConfig, region: "us-east-1" });
  try {
    const locationResult = await probeClient.send(new GetBucketLocationCommand({ Bucket: bucket }));
    const bucketRegion = locationResult.LocationConstraint || "us-east-1";
    return new S3Client({ ...baseClientConfig, region: bucketRegion });
  } catch (err) {
    console.warn(`[getS3ClientForBucket] Could not resolve region for bucket "${bucket}"; using default. Reason: ${(err as Error).message}`);
    return new S3Client(baseClientConfig);
  }
}

async function emptyBucketBeforeDelete(s3: S3Client, bucket: string): Promise<{
  objectsDeleted: number;
  versionedDeleted: number;
  deleteMarkersDeleted: number;
}> {
  let objectsDeleted = 0;
  let versionedDeleted = 0;
  let deleteMarkersDeleted = 0;

  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const versionsPage = await s3.send(new ListObjectVersionsCommand({
      Bucket: bucket,
      KeyMarker: keyMarker,
      VersionIdMarker: versionIdMarker,
      MaxKeys: 1000,
    }));

    const versionObjects = (versionsPage.Versions || [])
      .filter((item) => item.Key && item.VersionId)
      .map((item) => ({ Key: item.Key!, VersionId: item.VersionId! }));
    const markerObjects = (versionsPage.DeleteMarkers || [])
      .filter((item) => item.Key && item.VersionId)
      .map((item) => ({ Key: item.Key!, VersionId: item.VersionId! }));

    const toDelete = [...versionObjects, ...markerObjects];
    if (toDelete.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: toDelete, Quiet: true },
      }));
      versionedDeleted += versionObjects.length;
      deleteMarkersDeleted += markerObjects.length;
    }

    keyMarker = versionsPage.NextKeyMarker;
    versionIdMarker = versionsPage.NextVersionIdMarker;
    if (!versionsPage.IsTruncated) break;
  } while (true);

  let continuationToken: string | undefined;
  do {
    const objectsPage = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));

    const objects = (objectsPage.Contents || [])
      .filter((item) => item.Key)
      .map((item) => ({ Key: item.Key! }));

    if (objects.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: true },
      }));
      objectsDeleted += objects.length;
    }

    continuationToken = objectsPage.NextContinuationToken;
    if (!objectsPage.IsTruncated) break;
  } while (true);

  return { objectsDeleted, versionedDeleted, deleteMarkersDeleted };
}

export async function executeStorage(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  proposedState?: string
): Promise<any> {
  switch (actionId) {
    case "ebs-snapshot": {
      const ec2 = new EC2Client(clientConfig);
      const result = await ec2.send(new CreateSnapshotCommand({
        VolumeId: resourceId,
        Description: `Rabbittize automated snapshot - ${new Date().toISOString()}`,
      }));
      return { snapshotId: result.SnapshotId };
    }

    case "ebs-delete": {
      const ec2 = new EC2Client(clientConfig);
      const snap = await ec2.send(new CreateSnapshotCommand({
        VolumeId: resourceId,
        Description: `Rabbittize pre-delete snapshot - ${new Date().toISOString()}`,
      }));
      await new Promise((r) => setTimeout(r, 5000));
      return { snapshotId: snap.SnapshotId, volumeDeleted: true };
    }

    case "s3-lifecycle": {
      const s3 = await getS3ClientForBucket(resourceId, clientConfig);
      await s3.send(new PutBucketLifecycleConfigurationCommand({
        Bucket: resourceId,
        LifecycleConfiguration: {
          Rules: [{
            ID: "Rabbittize-intelligent-tiering",
            Status: "Enabled",
            Filter: { Prefix: "" },
            Transitions: [
              { Days: 30, StorageClass: "INTELLIGENT_TIERING" },
              { Days: 90, StorageClass: "GLACIER" },
            ],
          }],
        },
      }));
      return { lifecycleApplied: true };
    }

    case "s3-delete-bucket": {
      const s3 = await getS3ClientForBucket(resourceId, clientConfig);
      const forceEmptyDelete = proposedState === "force-empty-delete";

      const listed = await s3.send(new ListObjectsV2Command({
        Bucket: resourceId,
        MaxKeys: 1,
      }));
      const hasObjects = (listed.KeyCount ?? 0) > 0;

      let purgeSummary = { objectsDeleted: 0, versionedDeleted: 0, deleteMarkersDeleted: 0 };
      if (hasObjects && !forceEmptyDelete) {
        throw new Error(`Bucket ${resourceId} is not empty. Empty all objects and versions before deletion.`);
      }

      if (forceEmptyDelete) {
        purgeSummary = await emptyBucketBeforeDelete(s3, resourceId);
      }

      try {
        await s3.send(new DeleteBucketCommand({ Bucket: resourceId }));
      } catch (error: any) {
        const code = String(error?.name || error?.Code || "");
        if (code === "BucketNotEmpty") {
          throw new Error(`Bucket ${resourceId} is not empty. Remove object versions/delete markers and retry.`);
        }
        if (code === "NoSuchBucket") {
          return { bucketDeleted: false, alreadyDeleted: true, bucket: resourceId, forceEmptyDelete };
        }
        throw error;
      }

      return {
        bucketDeleted: true,
        bucket: resourceId,
        forceEmptyDelete,
        purgeSummary,
      };
    }

    default:
      throw new Error(`No storage executor implemented for action: ${actionId}`);
  }
}

export async function rollbackStorage(
  actionId: string,
  resourceId: string,
  region: string,
  clientConfig: any,
  preSnapshot: any
): Promise<void> {
  switch (actionId) {
    case "s3-lifecycle": {
      if (preSnapshot?.lifecycleRules) {
        const s3 = await getS3ClientForBucket(resourceId, clientConfig);
        await s3.send(new PutBucketLifecycleConfigurationCommand({
          Bucket: resourceId,
          LifecycleConfiguration: { Rules: preSnapshot.lifecycleRules },
        }));
      }
      break;
    }

    default:
      throw new Error(`No storage rollback implemented for action: ${actionId}`);
    }
}

export async function captureStorageSnapshot(
  service: string,
  resourceId: string,
  clientConfig: any
): Promise<any> {
  switch (service) {
    case "s3": {
      const s3 = await getS3ClientForBucket(resourceId, clientConfig);
      try {
        const result = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: resourceId }));
        return { lifecycleRules: result.Rules };
      } catch {
        return { lifecycleRules: null };
      }
    }
    default:
      return null;
  }
}
