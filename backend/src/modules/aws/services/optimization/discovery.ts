import { S3Client, ListObjectsV2Command, ListObjectVersionsCommand, GetBucketLocationCommand } from "@aws-sdk/client-s3";
import { AWS_DISCOVERY_REGIONS } from "../constants";

export const MAX_PARALLEL_REGION_SCANS = 4;

export async function isBucketEmpty(clientConfig: any, bucketName: string): Promise<boolean> {
    try {
        let s3: S3Client;
        const probeS3 = new S3Client({ ...clientConfig, region: "us-east-1" });
        const locationResult = await probeS3.send(new GetBucketLocationCommand({ Bucket: bucketName }));
        const bucketRegion = locationResult.LocationConstraint || "us-east-1";
        s3 = new S3Client({ ...clientConfig, region: bucketRegion });

        const listed = await s3.send(new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 1,
        }));

        const versions = await s3.send(new ListObjectVersionsCommand({
            Bucket: bucketName,
            MaxKeys: 1,
        }));

        const hasObjects = (listed.KeyCount ?? 0) > 0;
        const hasVersions = (versions.Versions?.length ?? 0) > 0;
        const hasDeleteMarkers = (versions.DeleteMarkers?.length ?? 0) > 0;

        return !hasObjects && !hasVersions && !hasDeleteMarkers;
    } catch (err) {
        console.warn(`[isBucketEmpty] Could not check if bucket "${bucketName}" is empty:`, err);
        return false;
    }
}

export function regionsForOptimizationScan(region?: string): string[] {
    if (region && region !== "all" && AWS_DISCOVERY_REGIONS.includes(region)) {
        return [region];
    }
    return AWS_DISCOVERY_REGIONS;
}

export async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            try {
                results[currentIndex] = {
                    status: "fulfilled",
                    value: await mapper(items[currentIndex]),
                };
            } catch (reason) {
                results[currentIndex] = { status: "rejected", reason };
            }
        }
    }

    const workerCount = Math.min(Math.max(1, limit), items.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}
