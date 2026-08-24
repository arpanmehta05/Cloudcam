// S3 BucketSizeBytes is emitted per StorageType. Summing these gives a closer
// approximation of true bucket size than querying only StandardStorage.
export const S3_SIZE_STORAGE_TYPES = [
    "StandardStorage",
    "StandardIAStorage",
    "OneZoneIAStorage",
    "ReducedRedundancyStorage",
    "IntelligentTieringFAStorage",
    "IntelligentTieringIAStorage",
    "IntelligentTieringAAStorage",
    "IntelligentTieringAIAStorage",
    "IntelligentTieringDAAStorage",
    "GlacierInstantRetrievalStorage",
    "GlacierStorage",
    "DeepArchiveStorage",
    "GlacierObjectOverhead",
    "GlacierS3ObjectOverhead",
    "GlacierStagingStorage",
    "GlacierIRSizeOverhead",
    "DeepArchiveObjectOverhead",
    "DeepArchiveS3ObjectOverhead",
    "DeepArchiveStagingStorage",
    "ExpressOneZoneStorage",
];

export function aggregateTimeSeries(results: any[], indices: number[]) {
    const timeMap = new Map<string, number>();
    for (const idx of indices) {
        const datapoints = results[idx]?.datapoints || [];
        for (const dp of datapoints) {
            const existing = timeMap.get(dp.timestamp) || 0;
            timeMap.set(dp.timestamp, existing + dp.value);
        }
    }
    return Array.from(timeMap.entries())
        .map(([timestamp, value]) => ({ timestamp, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
