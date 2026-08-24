import { ServiceConfig } from "../../service-registry";

export const awsStorageRegistry: Record<string, ServiceConfig> = {
  s3: {
    displayName: "S3 Buckets",
    category: "storage",
    icon: "FolderOpen",
    metrics: [
      {
        name: "size",
        namespace: "AWS/S3",
        metricName: "BucketSizeBytes",
        stat: "Average",
        unit: "bytes",
        dimensionNames: ["BucketName", "StorageType"],
        period: 86400,
      },
      {
        name: "objects",
        namespace: "AWS/S3",
        metricName: "NumberOfObjects",
        stat: "Average",
        unit: "count",
        dimensionNames: ["BucketName", "StorageType"],
        period: 86400,
      },
    ],
    costRules: [
      {
        condition: "size > 100GB",
        savings: 0.7,
        reason: "Large bucket — consider Glacier for archival",
      },
    ],
    logGroup: null,
  },
  ecr: {
    displayName: "ECR Repositories",
    category: "storage",
    icon: "FolderGit",
    metrics: [],
    costRules: [],
    logGroup: null,
  },
  ecr_image: {
    displayName: "ECR Container Images",
    category: "storage",
    icon: "Container",
    metrics: [],
    costRules: [],
    logGroup: null,
  },

  efs: {
    displayName: "Elastic File System",
    category: "storage",
    icon: "FileVolume",
    metrics: [
      {
        name: "total_io_bytes",
        namespace: "AWS/EFS",
        metricName: "TotalIOBytes",
        stat: "Sum",
        unit: "bytes",
        dimensionNames: ["FileSystemId"],
        period: 300,
      },
      {
        name: "client_connections",
        namespace: "AWS/EFS",
        metricName: "ClientConnections",
        stat: "Sum",
        unit: "count",
        dimensionNames: ["FileSystemId"],
        period: 300,
      },
      {
        name: "permitted_throughput",
        namespace: "AWS/EFS",
        metricName: "PermittedThroughput",
        stat: "Average",
        unit: "bytes/s",
        dimensionNames: ["FileSystemId"],
        period: 300,
      },
    ],
    costRules: [],
    logGroup: null,
  },
};
